#!/usr/bin/env node
/**
 * aggregate — the figures of an analysis, computed, never estimated: filter
 * the rows, group them, and compute sums, means, medians, counts per group,
 * with each group's share of the total and the grand total.
 *
 * Usage: node scripts/aggregate.mjs <file> [--where "<column><op><value>"]...
 *          [--group <column>[,<column>]] --agg <fn>:<column>[,<fn>:<column>]
 *          [--share] [--sort [-]<result column>] [--limit <n>] [--out <file.csv>]
 *          [--sheet <name>] [--delimiter …] [--decimal …] [--dates dmy|mdy]
 *
 *   --where   = != > >= < <= ~ (contains, case-insensitive); several --where are all required.
 *             An empty value tests empty cells: "city=" ; "city!=".
 *   --group   a column, or year:<date column>, quarter:…, month:…, week:…, day:…
 *   --agg     count (rows) | count:<col> (filled cells) | distinct:<col> | sum: | mean: |
 *             median: | min: | max: — result columns are named count, sum_<col>, mean_<col>…
 *   --share   adds share_<…> (0..1) next to every sum and count: the group's part of the total
 *   --sort    a result column, "-" first for descending; default: the groups in order
 *   --limit   how many groups are printed (default 50); --out always gets them all
 *
 * Prints { rows, matched, groups, columns, result: [...], total, ignored, out }.
 */
import {
  parseArgs, usage, out, fail, list, loadTable, columnOf, columnInfo, toNumber, toDate, sum, quantile, tidy, writeCsv, isMain, EXIT_OK,
} from "./lib/table.mjs";

const USAGE = `
Usage: node scripts/aggregate.mjs <file> [--where "<column><op><value>"]...
         [--group <column>[,<column>]] --agg <fn>:<column>[,<fn>:<column>]
         [--share] [--sort [-]<result column>] [--limit <n>] [--out <file.csv>]
         [--sheet <name>] [--delimiter ","|";"|tab] [--decimal ","|"."] [--dates dmy|mdy]

Operators of --where: = != > >= < <= ~ (contains). Groups: a column, or
year:, quarter:, month:, week:, day: before a date column. Functions of --agg:
count, count:, distinct:, sum:, mean:, median:, min:, max:.
Exit 0, 1 when the file or a column cannot be read, 2 on a bad invocation.
`;

const OPERATORS = [">=", "<=", "!=", "=", ">", "<", "~"];
const PERIODS = ["year", "quarter", "month", "week", "day"];
const FUNCTIONS = ["count", "distinct", "sum", "mean", "median", "min", "max"];

/** ISO week of a "YYYY-MM-DD": "YYYY-Www". */
export function isoWeek(iso) {
  const date = new Date(`${iso}T00:00:00Z`);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const year = date.getUTCFullYear();
  const first = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((date - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function period(iso, unit) {
  if (unit === "year") return iso.slice(0, 4);
  if (unit === "month") return iso.slice(0, 7);
  if (unit === "day") return iso;
  if (unit === "quarter") return `${iso.slice(0, 4)}-Q${Math.ceil(Number(iso.slice(5, 7)) / 3)}`;
  return isoWeek(iso);
}

function parseWhere(text) {
  let at = -1;
  let op = null;
  for (let i = 0; i < text.length && at < 0; i++) {
    for (const candidate of OPERATORS) {
      if (text.startsWith(candidate, i)) {
        at = i;
        op = candidate;
        break;
      }
    }
  }
  if (at <= 0) throw new Error(`--where "${text}": expected <column><operator><value>, operators ${OPERATORS.join(" ")}`);
  return { column: text.slice(0, at).trim(), op, value: text.slice(at + op.length).trim() };
}

export function aggregate(table, spec, options = {}) {
  const infos = new Map();
  const info = (index) => {
    if (!infos.has(index)) infos.set(index, columnInfo(table, index, options));
    return infos.get(index);
  };
  const dateOf = (index, value) => {
    const i = info(index);
    return toDate(value, i.type === "date" && i.order !== "iso" ? i.order : options.dateOrder ?? "dmy");
  };

  // Filters
  const tests = (spec.where ?? []).map((text) => {
    const w = parseWhere(text);
    const index = columnOf(table, w.column);
    const i = info(index);
    if (w.op === "~") {
      const needle = w.value.toLowerCase();
      return (row) => row[index].toLowerCase().includes(needle);
    }
    if (w.value === "" && (w.op === "=" || w.op === "!=")) return (row) => (row[index] === "") === (w.op === "=");
    let read = (v) => v;
    let wanted = w.value;
    if (i.type === "number" && toNumber(w.value, ".") !== null) {
      read = (v) => toNumber(v, i.decimal);
      wanted = toNumber(w.value, ".");
    } else if (i.type === "date") {
      const d = toDate(w.value, "dmy");
      if (!d) throw new Error(`--where "${text}": "${w.value}" is not a date (write YYYY-MM-DD)`);
      read = (v) => dateOf(index, v);
      wanted = d;
    } else if (w.op !== "=" && w.op !== "!=") {
      throw new Error(`--where "${text}": "${table.columns[index]}" is a ${i.type} column; ${w.op} needs a number or a date`);
    }
    return (row) => {
      const v = read(row[index]);
      if (v === null || v === "") return w.op === "!=";
      switch (w.op) {
        case "=": return typeof v === "string" && typeof wanted === "string" ? v.toLowerCase() === wanted.toLowerCase() : v === wanted;
        case "!=": return typeof v === "string" && typeof wanted === "string" ? v.toLowerCase() !== wanted.toLowerCase() : v !== wanted;
        case ">": return v > wanted;
        case ">=": return v >= wanted;
        case "<": return v < wanted;
        default: return v <= wanted;
      }
    };
  });
  const matched = table.rows.filter((row) => tests.every((t) => t(row)));

  // Groups
  const groups = (spec.group ?? []).map((text) => {
    const colon = text.indexOf(":");
    const unit = colon > 0 && PERIODS.includes(text.slice(0, colon).toLowerCase()) ? text.slice(0, colon).toLowerCase() : null;
    const index = columnOf(table, unit ? text.slice(colon + 1) : text);
    if (unit && info(index).type !== "date") throw new Error(`--group ${text}: "${table.columns[index]}" is not a date column`);
    return { name: unit ? `${unit}_${table.columns[index]}` : table.columns[index], key: (row) => (unit ? ((d) => (d ? period(d, unit) : ""))(dateOf(index, row[index])) : row[index]) };
  });

  // Aggregations
  const ignored = {};
  const aggs = (spec.agg ?? []).map((text) => {
    const colon = text.indexOf(":");
    const fn = (colon > 0 ? text.slice(0, colon) : text).toLowerCase();
    if (!FUNCTIONS.includes(fn)) throw new Error(`--agg ${text}: unknown function "${fn}" — ${FUNCTIONS.join(", ")}`);
    if (colon < 0) {
      if (fn !== "count") throw new Error(`--agg ${text}: ${fn} needs a column (${fn}:<column>)`);
      return { name: "count", fn, share: true, compute: (rows) => rows.length };
    }
    const index = columnOf(table, text.slice(colon + 1));
    const column = table.columns[index];
    const name = `${fn}_${column}`;
    if (fn === "count") return { name, fn, share: true, compute: (rows) => rows.filter((r) => r[index] !== "").length };
    if (fn === "distinct") return { name, fn, compute: (rows) => new Set(rows.map((r) => r[index]).filter((v) => v !== "")).size };
    const i = info(index);
    if (i.type === "date" && (fn === "min" || fn === "max")) {
      return { name, fn, compute: (rows) => { const d = rows.map((r) => dateOf(index, r[index])).filter(Boolean).sort(); return d.length ? d[fn === "min" ? 0 : d.length - 1] : null; } };
    }
    if (i.type !== "number") throw new Error(`--agg ${text}: "${column}" is a ${i.type} column, not numbers`);
    const numbers = (rows) => {
      const values = [];
      for (const r of rows) {
        if (r[index] === "") continue;
        const n = toNumber(r[index], i.decimal);
        if (n === null) (ignored[column] ??= new Set()).add(r);
        else values.push(n);
      }
      return values;
    };
    const compute = {
      sum: (v) => tidy(sum(v)),
      mean: (v) => (v.length ? tidy(sum(v) / v.length) : null),
      median: (v) => (v.length ? tidy(quantile([...v].sort((a, b) => a - b), 0.5)) : null),
      min: (v) => (v.length ? Math.min(...v) : null),
      max: (v) => (v.length ? Math.max(...v) : null),
    }[fn];
    return { name, fn, share: fn === "sum", compute: (rows) => compute(numbers(rows)) };
  });
  if (!aggs.length) throw new Error("--agg is required (e.g. --agg count or --agg sum:amount)");

  const buckets = new Map();
  for (const row of matched) {
    const keys = groups.map((g) => g.key(row));
    const id = keys.join("\u0001");
    if (!buckets.has(id)) buckets.set(id, { keys, rows: [] });
    buckets.get(id).rows.push(row);
  }
  if (!groups.length) buckets.set("", { keys: [], rows: matched });

  // The cells left out of the computations, counted once per column over the matched rows.
  const total = Object.fromEntries(aggs.map((a) => [a.name, a.compute(matched)]));
  const totalIgnored = Object.fromEntries(Object.entries(ignored).map(([column, rows]) => [column, rows.size]));

  const shares = spec.share ? aggs.filter((a) => a.share) : [];
  let result = [...buckets.values()].map(({ keys, rows }) => {
    const line = {};
    groups.forEach((g, k) => (line[g.name] = keys[k]));
    for (const a of aggs) {
      line[a.name] = a.compute(rows);
      if (shares.includes(a)) line[`share_${a.name}`] = total[a.name] ? Number((line[a.name] / total[a.name]).toFixed(6)) : null;
    }
    return line;
  });
  const columns = result.length ? Object.keys(result[0]) : [...groups.map((g) => g.name), ...aggs.map((a) => a.name)];

  if (spec.sort) {
    const desc = spec.sort.startsWith("-");
    const key = desc ? spec.sort.slice(1) : spec.sort;
    const found = columns.find((c) => c === key) ?? columns.find((c) => c.toLowerCase() === key.toLowerCase());
    if (!found) throw new Error(`--sort ${spec.sort}: no result column "${key}" — ${columns.join(", ")}`);
    result.sort((a, b) => {
      const x = a[found];
      const y = b[found];
      if (x === y) return 0;
      if (x === null || x === "") return 1;
      if (y === null || y === "") return -1;
      return (x < y ? -1 : 1) * (desc ? -1 : 1);
    });
  } else if (groups.length) {
    result.sort((a, b) => {
      for (const g of groups) {
        if (a[g.name] !== b[g.name]) return a[g.name] < b[g.name] ? -1 : 1;
      }
      return 0;
    });
  }

  return { rows: table.rows.length, matched: matched.length, groups: groups.length ? result.length : 0, columns, result, total, ignored: totalIgnored };
}

if (isMain(import.meta)) {
  const { flags, positional } = parseArgs();
  if (flags.help || !positional[0]) usage(USAGE);
  if (flags.dates && !["dmy", "mdy"].includes(flags.dates)) usage(USAGE);
  if (flags.decimal && ![",", "."].includes(flags.decimal)) usage(USAGE);
  if (!flags.agg || flags.agg === true) usage(USAGE);
  try {
    const table = loadTable(positional[0], { sheet: flags.sheet === true ? undefined : flags.sheet, delimiter: flags.delimiter, noHeader: flags["no-header"] === true, headerRow: flags["header-row"] });
    const spec = {
      where: flags.where === undefined || flags.where === true ? [] : [].concat(flags.where).map(String),
      group: list(flags.group),
      agg: list(flags.agg),
      share: flags.share === true,
      sort: typeof flags.sort === "string" ? flags.sort : null,
    };
    const answer = aggregate(table, spec, { decimal: flags.decimal, dateOrder: flags.dates });
    const limit = Math.max(1, Number(flags.limit ?? 50) || 50);
    if (typeof flags.out === "string") {
      writeCsv(flags.out, answer.columns, answer.result.map((line) => answer.columns.map((c) => line[c])));
      answer.out = flags.out;
    }
    if (answer.result.length > limit) {
      answer.truncated = answer.result.length - limit;
      answer.result = answer.result.slice(0, limit);
    }
    out(answer);
    process.exit(EXIT_OK);
  } catch (error) {
    fail(error.message);
  }
}
