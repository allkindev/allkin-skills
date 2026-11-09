#!/usr/bin/env node
/**
 * profile — what a table holds, before anything is computed from it: its
 * size, and for each column its type, how many cells are filled, missing or
 * unreadable, its distinct values, and its figures (numbers: sum, mean,
 * median, min, max, quartiles; dates: first and last; text: the most frequent
 * values). Also: duplicated rows, and the sheets of a workbook.
 *
 * Usage: node scripts/profile.mjs <file.csv|.tsv|.xlsx> [--sheet <name|number>]
 *          [--delimiter ","|";"|tab] [--decimal ","|"."] [--dates dmy|mdy]
 *          [--header-row <n>] [--no-header] [--top <n>]
 *
 * Prints { source, rows, columns: [...], duplicateRows, warnings }.
 */
import {
  parseArgs, usage, out, fail, loadTable, columnInfo, toNumber, toDate, describe, isMain, EXIT_OK,
} from "./lib/table.mjs";

const USAGE = `
Usage: node scripts/profile.mjs <file.csv|.tsv|.xlsx> [--sheet <name|number>]
         [--delimiter ","|";"|tab] [--decimal ","|"."] [--dates dmy|mdy]
         [--header-row <n>] [--no-header] [--top <n>]

Describes the table: size, and per column its type, filled / missing /
unreadable cells, distinct values and figures. Exit 0, 1 when the file cannot
be read, 2 on a bad invocation.
`;

export function profile(table, options = {}) {
  const top = Number(options.top ?? 5);
  const warnings = [];
  const columns = table.columns.map((name, i) => {
    const info = columnInfo(table, i, options);
    const values = table.rows.map((r) => r[i]).filter((v) => v !== "");
    const counts = new Map();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    const column = { name, type: info.type, filled: info.filled, missing: info.missing, distinct: counts.size };
    if (info.type === "number") {
      const numbers = values.map((v) => toNumber(v, info.decimal)).filter((n) => n !== null);
      Object.assign(column, { decimal: info.decimal, ...(info.percent ? { percent: true } : {}), ...describe(numbers) });
      if (info.invalidCount) {
        Object.assign(column, { unreadable: info.invalidCount, unreadableExamples: info.invalid });
        warnings.push(`"${name}": ${info.invalidCount} cell(s) are not numbers and are left out of every computation (e.g. ${info.invalid.map((v) => JSON.stringify(v)).join(", ")}).`);
      }
    } else if (info.type === "date") {
      const dates = values.map((v) => toDate(v, info.order === "iso" ? "dmy" : info.order)).filter(Boolean).sort();
      Object.assign(column, { order: info.order, first: dates[0], last: dates[dates.length - 1] });
      if (info.ambiguousDates) {
        column.ambiguous = true;
        warnings.push(`"${name}": the dates do not tell day from month (no day above 12); read as ${info.order}. Pass --dates dmy or --dates mdy to settle it.`);
      }
      if (info.invalidCount) {
        Object.assign(column, { unreadable: info.invalidCount, unreadableExamples: info.invalid });
        warnings.push(`"${name}": ${info.invalidCount} cell(s) are not dates (e.g. ${info.invalid.map((v) => JSON.stringify(v)).join(", ")}).`);
      }
    } else if (info.type === "text") {
      column.top = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, top).map(([value, count]) => ({ value: value.length > 80 ? `${value.slice(0, 77)}…` : value, count }));
      const trimmed = new Map();
      for (const v of counts.keys()) {
        const key = v.toLowerCase().replace(/\s+/g, " ");
        trimmed.set(key, (trimmed.get(key) ?? 0) + 1);
      }
      const variants = [...trimmed.values()].filter((n) => n > 1).length;
      if (variants) {
        column.caseVariants = variants;
        warnings.push(`"${name}": ${variants} value(s) are written in several ways (capitals or spaces differ); they count as different groups.`);
      }
    }
    if (info.missing && info.type !== "empty") column.missingShare = Number((info.missing / table.rows.length).toFixed(4));
    return column;
  });

  const seen = new Set();
  let duplicateRows = 0;
  for (const row of table.rows) {
    const key = row.join("\u0001");
    if (seen.has(key)) duplicateRows++;
    else seen.add(key);
  }
  if (duplicateRows) warnings.push(`${duplicateRows} row(s) are exact copies of another row.`);
  if (table.source.formulas) warnings.push(`${table.source.formulas} cell(s) of the sheet are formulas: their values are the results the file kept when it was last saved.`);
  const empty = columns.filter((c) => c.type === "empty").map((c) => c.name);
  if (empty.length) warnings.push(`Empty column(s): ${empty.join(", ")}.`);

  return { source: table.source, rows: table.rows.length, columnCount: columns.length, columns, duplicateRows, warnings };
}

if (isMain(import.meta)) {
  const { flags, positional } = parseArgs();
  if (flags.help || !positional[0]) usage(USAGE);
  if (flags.dates && !["dmy", "mdy"].includes(flags.dates)) usage(USAGE);
  if (flags.decimal && ![",", "."].includes(flags.decimal)) usage(USAGE);
  try {
    const table = loadTable(positional[0], { sheet: flags.sheet === true ? undefined : flags.sheet, delimiter: flags.delimiter, noHeader: flags["no-header"] === true, headerRow: flags["header-row"] });
    out(profile(table, { top: flags.top, decimal: flags.decimal, dateOrder: flags.dates }));
    process.exit(EXIT_OK);
  } catch (error) {
    fail(error.message);
  }
}
