/**
 * Shared by every script of the competence. No dependency, no network, no
 * child process: a script reads a table (CSV, TSV or .xlsx), computes, prints a
 * short JSON and exits 0 (fine), 1 (the file could not be read or computed) or
 * 2 (bad invocation).
 *
 * A table is { columns: string[], rows: string[][], source: {...} }: every
 * cell a string as the file gives it ("" when empty). Types are inferred per
 * column by `columnInfo`, never cell by cell, so that "1,234" means the same
 * thing on every line of a column.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

/* ------------------------------------------------------------------ args */

/** `node x.mjs file --flag value --flag value2 --bool` → { flags, positional }; a repeated flag becomes an array. */
export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  const positional = [];
  const put = (key, value) => {
    if (flags[key] === undefined) flags[key] = value;
    else flags[key] = [].concat(flags[key], value);
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) put(a.slice(2, eq), a.slice(eq + 1));
      else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          put(a.slice(2), next);
          i++;
        } else put(a.slice(2), true);
      }
    } else positional.push(a);
  }
  return { flags, positional };
}

export function usage(text) {
  process.stderr.write(text.trim() + "\n");
  process.exit(EXIT_USAGE);
}

export function fail(message) {
  process.stdout.write(JSON.stringify({ error: message }) + "\n");
  process.exit(EXIT_FAILED);
}

export function out(value) {
  process.stdout.write(JSON.stringify(value, null, 1) + "\n");
}

export function list(flag) {
  if (flag === undefined || flag === true) return [];
  return [].concat(flag).flatMap((v) => String(v).split(",")).map((v) => v.trim()).filter(Boolean);
}

export function isMain(meta) {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(meta.url);
}

/* ------------------------------------------------------------------- CSV */

const DELIMITERS = [",", ";", "\t", "|"];

/** The delimiter that splits the first lines most regularly, outside quotes. */
export function detectDelimiter(text) {
  const lines = [];
  let line = "";
  let quoted = false;
  for (let i = 0; i < text.length && lines.length < 20; i++) {
    const c = text[i];
    if (c === '"') quoted = !quoted;
    if (c === "\n" && !quoted) {
      if (line.trim()) lines.push(line);
      line = "";
    } else line += c;
  }
  if (line.trim() && lines.length < 20) lines.push(line);
  let best = ",";
  let bestScore = -1;
  for (const d of DELIMITERS) {
    const counts = lines.map((l) => {
      let n = 0;
      let q = false;
      for (const c of l) {
        if (c === '"') q = !q;
        else if (c === d && !q) n++;
      }
      return n;
    });
    const first = counts[0] ?? 0;
    if (first === 0) continue;
    const regular = counts.filter((n) => n === first).length / counts.length;
    const score = regular * 1000 + first;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/** RFC 4180, with the delimiter given: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else field += c;
      i++;
      continue;
    }
    if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += c;
    i++;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export function csvEscape(value, delimiter = ",") {
  const s = value === null || value === undefined ? "" : String(value);
  return s.includes(delimiter) || s.includes('"') || s.includes("\n") || s.includes("\r") ? `"${s.replace(/"/g, '""')}"` : s;
}

export function writeCsv(path, columns, rows) {
  const file = resolve(process.cwd(), path);
  mkdirSync(dirname(file), { recursive: true });
  const lines = [columns, ...rows].map((r) => r.map((v) => csvEscape(v)).join(","));
  writeFileSync(file, lines.join("\n") + "\n", "utf-8");
  return file;
}

/* ------------------------------------------------------------------ XLSX */

/** The entries of a zip, by name → Buffer (stored or deflated; no zip64, no encryption). */
export function readZip(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip archive (no end record)");
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let k = 0; k < count; k++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("zip directory damaged");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf-8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;
    entries.set(name, () => {
      if (buffer.readUInt32LE(local) !== 0x04034b50) throw new Error(`zip entry damaged: ${name}`);
      const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const data = buffer.subarray(start, start + compressedSize);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new Error(`zip method ${method} not supported: ${name}`);
    });
  }
  return entries;
}

const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function xmlDecode(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, e) => {
    if (e[0] !== "#") return XML_ENTITIES[e];
    const code = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  });
}

function attr(tag, name) {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag);
  return m ? xmlDecode(m[1]) : undefined;
}

/** The text of a <si> or <is>: its <t> runs joined, the phonetic runs left out. */
function richText(xml) {
  const clean = xml.replace(/<rPh[\s\S]*?<\/rPh>/g, "");
  let text = "";
  for (const m of clean.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)) text += xmlDecode(m[1] ?? "");
  return text;
}

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

function isDateFormatCode(code) {
  const bare = code.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").replace(/\\./g, "");
  return /[dmyhs]/i.test(bare) && !/^[#0?,.\s%Ee+-]*$/.test(bare) && !/General/i.test(bare);
}

/** For each cell style (the `s` of a cell): whether it shows a date, and whether with a time. */
function dateStyles(stylesXml) {
  if (!stylesXml) return [];
  const custom = new Map();
  for (const m of stylesXml.matchAll(/<numFmt\s[^>]*>/g)) {
    const id = Number(attr(m[0], "numFmtId"));
    custom.set(id, attr(m[0], "formatCode") ?? "");
  }
  const xfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml);
  if (!xfs) return [];
  const styles = [];
  for (const m of xfs[1].matchAll(/<xf\s[^>]*>/g)) {
    const id = Number(attr(m[0], "numFmtId") ?? 0);
    const code = custom.get(id);
    const date = code !== undefined ? isDateFormatCode(code) : BUILTIN_DATE_FORMATS.has(id);
    const time = code !== undefined ? /[hs]/i.test(code.replace(/"[^"]*"/g, "")) : [18, 19, 20, 21, 22, 45, 46, 47].includes(id);
    styles.push(date ? { time } : null);
  }
  return styles;
}

/** An Excel serial number → "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SS". */
export function serialToIso(serial, withTime, date1904 = false) {
  const days = Math.floor(serial);
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const ms = epoch + days * 86400000 + Math.round((serial - days) * 86400) * 1000;
  const iso = new Date(ms).toISOString();
  return withTime && serial !== days ? iso.slice(0, 19) : iso.slice(0, 10);
}

function columnIndex(ref) {
  let n = 0;
  for (const c of ref) {
    const code = c.charCodeAt(0);
    if (code < 65 || code > 90) break;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

/** The sheets of a workbook, in order: [{ name, path }]. */
function workbookSheets(zip) {
  const read = (name) => (zip.has(name) ? zip.get(name)().toString("utf-8") : "");
  const workbook = read("xl/workbook.xml");
  if (!workbook) throw new Error("not an .xlsx workbook (xl/workbook.xml missing)");
  const rels = new Map();
  for (const m of read("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\s[^>]*>/g)) {
    rels.set(attr(m[0], "Id"), attr(m[0], "Target"));
  }
  const sheets = [];
  for (const m of workbook.matchAll(/<sheet\s[^>]*>/g)) {
    const target = rels.get(attr(m[0], "r:id")) ?? "";
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    sheets.push({ name: attr(m[0], "name") ?? "", path, hidden: attr(m[0], "state") === "hidden" });
  }
  return { sheets, date1904: /<workbookPr[^>]*date1904="(1|true)"/.test(workbook) };
}

/** One sheet of an .xlsx as rows of strings; formulas give the result the file keeps. */
export function readXlsx(buffer, sheetName) {
  const zip = readZip(buffer);
  const { sheets, date1904 } = workbookSheets(zip);
  if (!sheets.length) throw new Error("the workbook has no sheet");
  const sheet = sheetName === undefined ? sheets.find((s) => !s.hidden) ?? sheets[0] : sheets.find((s) => s.name === sheetName) ?? sheets[Number(sheetName) - 1];
  if (!sheet) throw new Error(`no sheet "${sheetName}" — sheets: ${sheets.map((s) => s.name).join(", ")}`);
  if (!zip.has(sheet.path)) throw new Error(`sheet file missing: ${sheet.path}`);

  const shared = [];
  if (zip.has("xl/sharedStrings.xml")) {
    const xml = zip.get("xl/sharedStrings.xml")().toString("utf-8");
    for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) shared.push(richText(m[1] ?? ""));
  }
  const styles = dateStyles(zip.has("xl/styles.xml") ? zip.get("xl/styles.xml")().toString("utf-8") : "");

  const xml = zip.get(sheet.path)().toString("utf-8");
  const rows = [];
  let formulas = 0;
  for (const rowMatch of xml.matchAll(/<row\s?[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowIndex = Number(attr(rowMatch[0].slice(0, rowMatch[0].indexOf(">") + 1), "r") ?? rows.length + 1) - 1;
    const cells = [];
    let next = 0;
    for (const c of (rowMatch[1] ?? "").matchAll(/<c\s?([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(c[1], "r");
      const col = ref ? columnIndex(ref) : next;
      next = col + 1;
      const type = attr(c[1], "t");
      const body = c[2] ?? "";
      if (/<f[\s>/]/.test(body)) formulas++;
      const v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body);
      let value = "";
      if (type === "inlineStr") value = richText(body);
      else if (v) {
        const raw = xmlDecode(v[1]);
        if (type === "s") value = shared[Number(raw)] ?? "";
        else if (type === "b") value = raw === "1" ? "TRUE" : "FALSE";
        else if (type === "str" || type === "e") value = raw;
        else {
          const style = styles[Number(attr(c[1], "s") ?? -1)];
          const num = Number(raw);
          value = style && Number.isFinite(num) ? serialToIso(num, style.time, date1904) : String(Number.isFinite(num) ? num : raw);
        }
      }
      while (cells.length < col) cells.push("");
      cells[col] = value;
    }
    while (rows.length < rowIndex) rows.push([]);
    rows[rowIndex] = cells;
  }
  return { rows: rows.filter((r) => r.some((v) => v !== "")), sheet: sheet.name, sheets: sheets.map((s) => s.name), formulas };
}

/* ----------------------------------------------------------------- table */

/** Reads a .csv / .tsv / .txt / .xlsx into a table; the first non-empty row is the header unless `noHeader`. */
export function loadTable(path, { sheet, delimiter, noHeader = false, headerRow } = {}) {
  const file = resolve(process.cwd(), path);
  let buffer;
  try {
    buffer = readFileSync(file);
  } catch (error) {
    throw new Error(`cannot read ${path}: ${error.code ?? error.message}`);
  }
  const ext = extname(file).toLowerCase();
  let rows;
  const source = { file: path, bytes: buffer.length };
  if (ext === ".xlsx" || ext === ".xlsm") {
    const book = readXlsx(buffer, sheet);
    rows = book.rows;
    Object.assign(source, { format: "xlsx", sheet: book.sheet, sheets: book.sheets, formulas: book.formulas });
  } else if (ext === ".xls" || ext === ".ods" || ext === ".numbers") {
    throw new Error(`${ext} is not read: save the file as .xlsx or .csv`);
  } else {
    let text = buffer.toString("utf-8");
    if (text.includes("�")) text = buffer.toString("latin1");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const used = delimiter === "tab" ? "\t" : delimiter || (ext === ".tsv" ? "\t" : detectDelimiter(text));
    rows = parseCsv(text, used);
    Object.assign(source, { format: "csv", delimiter: used === "\t" ? "tab" : used });
  }
  if (!rows.length) throw new Error(`${path} holds no row`);
  const skip = headerRow ? Math.max(0, Number(headerRow) - 1) : 0;
  rows = rows.slice(skip);
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
  let columns;
  if (noHeader) columns = Array.from({ length: width }, (_, i) => `column${i + 1}`);
  else {
    const header = rows.shift();
    const seen = new Map();
    columns = Array.from({ length: width }, (_, i) => {
      const base = (header[i] ?? "").trim() || `column${i + 1}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      return n ? `${base}_${n + 1}` : base;
    });
  }
  const body = rows.map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? "").trim()));
  return { columns, rows: body, source };
}

/** The index of a column by its name (exact, then case-insensitive) or its 1-based number written `#3`. */
export function columnOf(table, name) {
  const wanted = String(name).trim();
  if (/^#\d+$/.test(wanted)) {
    const i = Number(wanted.slice(1)) - 1;
    if (i >= 0 && i < table.columns.length) return i;
  }
  let i = table.columns.indexOf(wanted);
  if (i < 0) i = table.columns.findIndex((c) => c.toLowerCase() === wanted.toLowerCase());
  if (i < 0) throw new Error(`no column "${wanted}" — columns: ${table.columns.join(", ")}`);
  return i;
}

/* ----------------------------------------------------------------- types */

const NUMBER_SHAPE = /^[+-]?(\d[\d.,]*|[.,]\d+)$/;

/** Strips what surrounds a number: spaces of every kind, a currency, a percent sign, brackets for a negative. */
function bareNumber(value) {
  let s = value.replace(/[\s   ']/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/^[€$£¥]|[€$£¥]$|(?:EUR|USD|GBP|CHF)$/gi, "");
  const percent = s.endsWith("%");
  if (percent) s = s.slice(0, -1);
  s = s.replace(/^−/, "-");
  if (!NUMBER_SHAPE.test(s)) return null;
  return { s: negative ? `-${s}` : s, percent };
}

/**
 * How the numbers of a column are written: its decimal separator. Decided on
 * the whole column — a value with both separators settles it, else a group
 * that is not of three digits, else the file's habits (a semicolon-delimited
 * CSV writes decimals with a comma).
 */
export function decimalSeparator(values, hint) {
  let comma = 0;
  let dot = 0;
  for (const v of values) {
    const bare = bareNumber(v);
    if (!bare) continue;
    const s = bare.s;
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma >= 0 && lastDot >= 0) {
      if (lastComma > lastDot) comma += 10;
      else dot += 10;
    } else if (lastComma >= 0) {
      const groups = s.split(",");
      if (groups.length > 2) dot += 5;
      else if (groups[1].length !== 3 || /^[+-]?0$/.test(groups[0])) comma += 5;
    } else if (lastDot >= 0) {
      const groups = s.split(".");
      if (groups.length > 2) comma += 5;
      else if (groups[1].length !== 3 || /^[+-]?0$/.test(groups[0])) dot += 5;
    }
  }
  if (comma > dot) return ",";
  if (dot > comma) return ".";
  return hint === "," ? "," : ".";
}

/** A cell → a number with the column's decimal separator, or null. */
export function toNumber(value, decimal = ".") {
  if (value === "" || value === null || value === undefined) return null;
  const bare = bareNumber(String(value));
  if (!bare) return null;
  const thousands = decimal === "," ? "." : ",";
  let s = bare.s.split(thousands).join("");
  if (decimal === ",") s = s.replace(",", ".");
  if ((s.match(/\./g) ?? []).length > 1) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const LOCAL_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

function validDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** The order of day and month in a column of local dates: "dmy", "mdy" or null when nothing tells. */
export function dateOrder(values) {
  let dmy = 0;
  let mdy = 0;
  for (const v of values) {
    const m = LOCAL_DATE.exec(v);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12 && b <= 12) dmy++;
    else if (b > 12 && a <= 12) mdy++;
  }
  if (dmy && !mdy) return "dmy";
  if (mdy && !dmy) return "mdy";
  return null;
}

/** A cell → "YYYY-MM-DD" (the time dropped), or null. */
export function toDate(value, order = "dmy") {
  if (!value) return null;
  const iso = ISO_DATE.exec(value);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3])) ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  const m = LOCAL_DATE.exec(value);
  if (!m) return null;
  const day = Number(order === "mdy" ? m[2] : m[1]);
  const month = Number(order === "mdy" ? m[1] : m[2]);
  let year = Number(m[3]);
  if (m[3].length === 2) year += year < 70 ? 2000 : 1900;
  if (!validDate(year, month, day)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * What a column holds: { type: "number" | "date" | "text" | "empty", decimal?,
 * order?, ambiguousDates?, filled, missing, invalid: [examples] }. A column is
 * a number or a date when at least 90 % of its filled cells read as one; the
 * others are its `invalid` cells, left out of every computation and counted.
 */
export function columnInfo(table, index, options = {}) {
  const values = table.rows.map((r) => r[index]);
  const filled = values.filter((v) => v !== "");
  const info = { name: table.columns[index], filled: filled.length, missing: values.length - filled.length };
  if (!filled.length) return { ...info, type: "empty", invalid: [] };

  const hint = options.decimal ?? (table.source.delimiter === ";" ? "," : ".");
  const decimal = options.decimal ?? decimalSeparator(filled, hint);
  const numeric = filled.filter((v) => toNumber(v, decimal) !== null);

  const detected = dateOrder(filled);
  const order = options.dateOrder ?? detected ?? (hint === "," ? "dmy" : "mdy");
  const dated = filled.filter((v) => toDate(v, order) !== null);

  const threshold = Math.max(1, Math.ceil(filled.length * 0.9));
  if (dated.length >= threshold && dated.length >= numeric.length) {
    const local = filled.some((v) => LOCAL_DATE.test(v));
    return {
      ...info,
      type: "date",
      order: local ? order : "iso",
      ...(local && !detected && !options.dateOrder ? { ambiguousDates: true } : {}),
      invalidCount: filled.length - dated.length,
      invalid: [...new Set(filled.filter((v) => toDate(v, order) === null))].slice(0, 5),
    };
  }
  if (numeric.length >= threshold) {
    return {
      ...info,
      type: "number",
      decimal,
      ...(filled.some((v) => v.includes("%")) ? { percent: true } : {}),
      invalidCount: filled.length - numeric.length,
      invalid: [...new Set(filled.filter((v) => toNumber(v, decimal) === null))].slice(0, 5),
    };
  }
  return { ...info, type: "text", invalid: [] };
}

/* ----------------------------------------------------------------- stats */

/** Rounds away the noise of binary floats (0.1 + 0.2), keeping 10 significant decimals. */
export function tidy(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return Number(n.toPrecision(12));
}

export function sum(numbers) {
  // Kahan summation: a long column of cents must add up to the cent.
  let total = 0;
  let carry = 0;
  for (const n of numbers) {
    const y = n - carry;
    const t = total + y;
    carry = t - total - y;
    total = t;
  }
  return total;
}

export function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const low = Math.floor(pos);
  const high = Math.ceil(pos);
  return sorted[low] + (sorted[high] - sorted[low]) * (pos - low);
}

export function describe(numbers) {
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const total = sum(sorted);
  const mean = total / sorted.length;
  const variance = sorted.length > 1 ? sum(sorted.map((n) => (n - mean) ** 2)) / (sorted.length - 1) : 0;
  return {
    count: sorted.length,
    sum: tidy(total),
    mean: tidy(mean),
    median: tidy(quantile(sorted, 0.5)),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    q1: tidy(quantile(sorted, 0.25)),
    q3: tidy(quantile(sorted, 0.75)),
    stdev: tidy(Math.sqrt(variance)),
  };
}
