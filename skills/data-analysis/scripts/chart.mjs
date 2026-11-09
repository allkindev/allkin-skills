#!/usr/bin/env node
/**
 * chart — one plain chart as an SVG file, drawn from a table (usually the
 * --out of aggregate): bars for a comparison, horizontal bars for a ranking
 * with long names, a line for an evolution. One message per chart: no 3D, no
 * second axis, the axis of bars starts at zero.
 *
 * Usage: node scripts/chart.mjs <file> --x <column> --y <column>[,<column>]
 *          --out <file.svg> [--type bar|hbar|line] [--title "…"] [--unit "€"]
 *          [--limit <n>] [--sheet <name>] [--delimiter …] [--decimal …]
 *
 * Prints { out, type, points, series, min, max }.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  parseArgs, usage, out, fail, list, loadTable, columnOf, columnInfo, toNumber, isMain, EXIT_OK,
} from "./lib/table.mjs";

const USAGE = `
Usage: node scripts/chart.mjs <file> --x <column> --y <column>[,<column>]
         --out <file.svg> [--type bar|hbar|line] [--title "…"] [--unit "€"]
         [--limit <n>] [--sheet <name>] [--delimiter ","|";"|tab] [--decimal ","|"."]

bar: a comparison (default). hbar: a ranking, one series. line: an evolution.
At most 60 points (--limit, default 30 for bars). Exit 0, 1 when the file or a
column cannot be read, 2 on a bad invocation.
`;

const PALETTE = ["#4f46e5", "#0d9488", "#f59e0b", "#e11d48", "#0284c7", "#7c3aed"];
const TEXT = "#0f172a";
const DIM = "#64748b";
const LINE = "#cbd5e1";
const FONT = "font-family=\"-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif\"";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 1234567.5 → "1 234 567.5" with narrow no-break spaces; at most two decimals. */
export function formatNumber(n) {
  if (n === null || n === undefined) return "";
  const abs = Math.abs(n);
  const fixed = abs >= 100 || Number.isInteger(n) ? Math.round(n).toString() : Number(n.toFixed(2)).toString();
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return frac ? `${grouped}.${frac}` : grouped;
}

/** Round ticks covering [min, max]: { ticks, low, high }. */
export function niceTicks(min, max, wanted = 5) {
  if (min === max) {
    if (min === 0) max = 1;
    else if (min > 0) min = 0;
    else max = 0;
  }
  const span = max - min;
  const raw = span / wanted;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power;
  const low = Math.floor(min / step) * step;
  const high = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = low; v <= high + step / 1e6; v += step) ticks.push(Number(v.toPrecision(12)));
  return { ticks, low, high };
}

const shorten = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function drawChart({ type, title, unit, labels, series }) {
  const W = 880;
  const multi = series.length > 1;
  const top = (title ? 54 : 22) + (multi ? 26 : 0) + (unit && type !== "hbar" ? 16 : 0);
  const parts = [];
  const all = series.flatMap((s) => s.values.filter((v) => v !== null));
  const dataMin = Math.min(...all);
  const dataMax = Math.max(...all);
  const suffix = unit ? ` ${unit}` : "";

  let H;
  if (type === "hbar") {
    const rowH = 30;
    const labelW = Math.min(260, Math.max(80, Math.max(...labels.map((l) => l.length)) * 7.2 + 16));
    H = top + labels.length * rowH + 44;
    const left = labelW;
    const right = W - 84;
    const { ticks, low, high } = niceTicks(Math.min(0, dataMin), Math.max(0, dataMax));
    const x = (v) => left + ((v - low) / (high - low)) * (right - left);
    for (const t of ticks) {
      parts.push(`<line x1="${x(t).toFixed(1)}" y1="${top}" x2="${x(t).toFixed(1)}" y2="${H - 40}" stroke="${t === 0 ? DIM : LINE}" stroke-width="1"/>`);
      parts.push(`<text x="${x(t).toFixed(1)}" y="${H - 22}" text-anchor="middle" font-size="12" fill="${DIM}">${esc(formatNumber(t))}</text>`);
    }
    labels.forEach((label, i) => {
      const v = series[0].values[i];
      const y = top + i * rowH + 5;
      parts.push(`<text x="${left - 10}" y="${y + 14}" text-anchor="end" font-size="13" fill="${TEXT}">${esc(shorten(label, 34))}</text>`);
      if (v === null) return;
      const x0 = x(0);
      const x1 = x(v);
      parts.push(`<rect x="${Math.min(x0, x1).toFixed(1)}" y="${y}" width="${Math.max(1, Math.abs(x1 - x0)).toFixed(1)}" height="${rowH - 10}" rx="3" fill="${PALETTE[0]}"/>`);
      parts.push(`<text x="${(Math.max(x0, x1) + 6).toFixed(1)}" y="${y + 14}" font-size="12" fill="${TEXT}">${esc(formatNumber(v) + suffix)}</text>`);
    });
  } else {
    H = 480;
    const left = 76;
    const right = W - 24;
    const bottom = H - 70;
    const zeroBased = type === "bar";
    const { ticks, low, high } = niceTicks(zeroBased ? Math.min(0, dataMin) : dataMin, zeroBased ? Math.max(0, dataMax) : dataMax);
    const y = (v) => bottom - ((v - low) / (high - low)) * (bottom - top);
    for (const t of ticks) {
      parts.push(`<line x1="${left}" y1="${y(t).toFixed(1)}" x2="${right}" y2="${y(t).toFixed(1)}" stroke="${t === 0 ? DIM : LINE}" stroke-width="1"/>`);
      parts.push(`<text x="${left - 8}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end" font-size="12" fill="${DIM}">${esc(formatNumber(t))}</text>`);
    }
    if (unit) parts.push(`<text x="${left - 8}" y="${top - 12}" text-anchor="end" font-size="12" fill="${DIM}">${esc(unit)}</text>`);
    const n = labels.length;
    const band = (right - left) / n;
    const every = Math.max(1, Math.ceil(n / Math.floor((right - left) / 64)));
    const rotate = n > 8 && Math.max(...labels.map((l) => l.length)) > 6;
    labels.forEach((label, i) => {
      if (i % every) return;
      const cx = left + band * (i + 0.5);
      parts.push(rotate
        ? `<text x="${cx.toFixed(1)}" y="${bottom + 16}" text-anchor="end" font-size="12" fill="${DIM}" transform="rotate(-35 ${cx.toFixed(1)} ${bottom + 16})">${esc(shorten(label, 16))}</text>`
        : `<text x="${cx.toFixed(1)}" y="${bottom + 20}" text-anchor="middle" font-size="12" fill="${DIM}">${esc(shorten(label, 14))}</text>`);
    });
    if (type === "bar") {
      const inner = band * 0.72;
      const barW = inner / series.length;
      series.forEach((s, k) => {
        s.values.forEach((v, i) => {
          if (v === null) return;
          const x0 = left + band * i + (band - inner) / 2 + barW * k;
          const y0 = y(0);
          const y1 = y(v);
          parts.push(`<rect x="${x0.toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${Math.max(1, barW - 2).toFixed(1)}" height="${Math.max(1, Math.abs(y1 - y0)).toFixed(1)}" rx="2" fill="${PALETTE[k % PALETTE.length]}"/>`);
          if (!multi && n <= 14) parts.push(`<text x="${(x0 + (barW - 2) / 2).toFixed(1)}" y="${(Math.min(y0, y1) - 6).toFixed(1)}" text-anchor="middle" font-size="12" fill="${TEXT}">${esc(formatNumber(v))}</text>`);
        });
      });
    } else {
      series.forEach((s, k) => {
        const colour = PALETTE[k % PALETTE.length];
        let path = "";
        let pen = false;
        s.values.forEach((v, i) => {
          if (v === null) {
            pen = false;
            return;
          }
          path += `${pen ? "L" : "M"}${(left + band * (i + 0.5)).toFixed(1)} ${y(v).toFixed(1)} `;
          pen = true;
        });
        parts.push(`<path d="${path.trim()}" fill="none" stroke="${colour}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`);
        if (n <= 40) s.values.forEach((v, i) => v !== null && parts.push(`<circle cx="${(left + band * (i + 0.5)).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5" fill="#ffffff" stroke="${colour}" stroke-width="2"/>`));
      });
    }
  }

  const head = [];
  if (title) head.push(`<text x="24" y="34" font-size="18" font-weight="600" fill="${TEXT}">${esc(title)}</text>`);
  if (multi) {
    let lx = 24;
    const ly = title ? 62 : 30;
    series.forEach((s, k) => {
      head.push(`<rect x="${lx}" y="${ly - 10}" width="12" height="12" rx="3" fill="${PALETTE[k % PALETTE.length]}"/>`);
      head.push(`<text x="${lx + 18}" y="${ly}" font-size="13" fill="${TEXT}">${esc(shorten(s.name, 28))}</text>`);
      lx += 18 + Math.min(28, s.name.length) * 7.4 + 22;
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" ${FONT}>\n<rect width="${W}" height="${H}" fill="#ffffff"/>\n${head.join("\n")}\n${parts.join("\n")}\n</svg>\n`;
}

if (isMain(import.meta)) {
  const { flags, positional } = parseArgs();
  const ys = list(flags.y);
  if (flags.help || !positional[0] || typeof flags.x !== "string" || !ys.length || typeof flags.out !== "string") usage(USAGE);
  const type = flags.type === undefined ? "bar" : String(flags.type);
  if (!["bar", "hbar", "line"].includes(type)) usage(USAGE);
  if (type === "hbar" && ys.length > 1) usage(USAGE);
  try {
    const table = loadTable(positional[0], { sheet: flags.sheet === true ? undefined : flags.sheet, delimiter: flags.delimiter });
    const xi = columnOf(table, flags.x);
    const limit = Math.min(60, Math.max(1, Number(flags.limit ?? (type === "line" ? 60 : 30)) || 30));
    if (table.rows.length > limit && flags.limit === undefined && type !== "line") {
      fail(`${table.rows.length} rows are too many for a ${type} chart: aggregate or sort first, or pass --limit ${limit} to draw the first ${limit}.`);
    }
    const rows = table.rows.slice(0, limit);
    const series = ys.map((name) => {
      const index = columnOf(table, name);
      const info = columnInfo(table, index, { decimal: flags.decimal });
      if (info.type !== "number") throw new Error(`--y ${name}: "${table.columns[index]}" is a ${info.type} column, not numbers`);
      return { name: table.columns[index], values: rows.map((r) => toNumber(r[index], info.decimal)) };
    });
    if (!series.some((s) => s.values.some((v) => v !== null))) throw new Error("nothing to draw: no number in the chosen rows");
    const svg = drawChart({ type, title: typeof flags.title === "string" ? flags.title : "", unit: typeof flags.unit === "string" ? flags.unit : "", labels: rows.map((r) => r[xi]), series });
    const file = resolve(process.cwd(), flags.out);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, svg, "utf-8");
    const all = series.flatMap((s) => s.values.filter((v) => v !== null));
    out({ out: flags.out, type, points: rows.length, series: series.map((s) => s.name), min: Math.min(...all), max: Math.max(...all), ...(table.rows.length > rows.length ? { dropped: table.rows.length - rows.length } : {}) });
    process.exit(EXIT_OK);
  } catch (error) {
    fail(error.message);
  }
}
