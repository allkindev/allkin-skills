/**
 * Shared by every script of the competence. No dependency, no network, no
 * child process: a script reads and writes files of the workspace, prints a
 * short JSON (or Markdown with --md) and exits 0 (fine), 1 (problems found,
 * listed) or 2 (bad invocation).
 *
 * Workspace: `--workspace <dir>`, else $COMMUNITY_WORKSPACE, else `community`
 * under the current folder (the agent's data/ folder when Allkin runs it).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const EXIT_OK = 0;
export const EXIT_ISSUES = 1;
export const EXIT_USAGE = 2;

/* ------------------------------------------------------------------ args */

/** `node x.mjs cmd --flag value --bool positional` → { command, flags, positional } */
export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  const positional = [];
  let command = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[key] = next;
          i++;
        } else flags[key] = true;
      }
    } else if (command === null) command = a;
    else positional.push(a);
  }
  return { command, flags, positional };
}

export function usage(text) {
  process.stderr.write(text.trim() + "\n");
  process.exit(EXIT_USAGE);
}

/* ------------------------------------------------------------- workspace */

export function workspaceDir(flags = {}) {
  const dir = flags.workspace || process.env.COMMUNITY_WORKSPACE || "community";
  return resolve(process.cwd(), String(dir));
}

export function requireWorkspace(flags = {}) {
  const dir = workspaceDir(flags);
  if (!existsSync(join(dir, "line.md")) && !existsSync(join(dir, "calendar.json"))) {
    fail(`No workspace at ${dir}. Run: node scripts/init_workspace.mjs --workspace ${dir}`);
  }
  return dir;
}

/**
 * A draft named as `drafts/<id>`, `<id>` or an absolute path → its folder in
 * the workspace (must exist, with a draft.json).
 */
export function resolveDraft(workspace, ref) {
  const name = String(ref).replace(/\/+$/, "");
  const candidates = [resolve(process.cwd(), name), join(workspace, name), join(workspace, "drafts", name)];
  for (const dir of candidates) {
    if (existsSync(join(dir, "draft.json"))) return dir;
  }
  fail(`No draft at ${ref} (looked for draft.json in ${candidates.join(", ")})`);
}

export function fail(message, code = EXIT_USAGE) {
  process.stderr.write(message + "\n");
  process.exit(code);
}

/* ----------------------------------------------------------------- files */

export function readJson(path, fallback = undefined) {
  if (!existsSync(path)) {
    if (fallback !== undefined) return fallback;
    fail(`Missing file: ${path}`);
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    fail(`Not valid JSON: ${path} (${error.message})`);
  }
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

export function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        fail(`Line ${index + 1} of ${path} is not valid JSON`);
      }
    });
}

export function appendJsonl(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(value) + "\n");
}

export function readText(path) {
  if (!existsSync(path)) fail(`Missing file: ${path}`);
  return readFileSync(path, "utf-8");
}

export function writeText(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text.endsWith("\n") ? text : text + "\n");
}

export function listFiles(dir, filter = () => true) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith(".") && statSync(join(dir, name)).isFile() && filter(name))
    .sort()
    .map((name) => join(dir, name));
}

/* -------------------------------------------------------------- networks */

let networksCache = null;
export function loadNetworks() {
  if (!networksCache) networksCache = readJson(join(SKILL_ROOT, "references", "networks.json"));
  return networksCache;
}

export function networkSpec(id) {
  const spec = loadNetworks().networks[id];
  if (!spec) fail(`Unknown network "${id}". Known: ${Object.keys(loadNetworks().networks).join(", ")}`);
  return spec;
}

export function knownNetworks() {
  return Object.keys(loadNetworks().networks);
}

/* ------------------------------------------------------------------ text */

// A URL stops before a trailing punctuation mark ("see https://allk.in." keeps its full stop).
const URL_RE = /\bhttps?:\/\/[^\s<>()"']*[^\s<>()"'.,;:!?…]/gi;
const HASHTAG_RE = /(^|[^\w&/])#([\p{L}\p{N}_]+)/gu;
const MENTION_RE = /(^|[^\w@.])@([\w.]{1,30})/g;

export function findUrls(text) {
  return text.match(URL_RE) ?? [];
}
export function findHashtags(text) {
  return [...text.matchAll(HASHTAG_RE)].map((m) => `#${m[2]}`);
}
export function findMentions(text) {
  return [...text.matchAll(MENTION_RE)].map((m) => `@${m[2]}`);
}

/**
 * The words of `words` found in `text` as whole words, case-insensitive
 * (forbidden words, alert words, spam signs). A multi-word entry matches as a
 * phrase. Returns the entries found, in the order of `words`.
 */
export function findWords(text, words = []) {
  const found = [];
  for (const word of words) {
    const w = String(word ?? "").trim();
    if (!w) continue;
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "iu");
    if (re.test(text)) found.push(w);
  }
  return found;
}

/** Lower case without accents ("Déçu" → "decu"): what word matching compares on both sides. */
export function foldText(text) {
  return String(text ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Graphemes, as a human counts "characters" (an emoji is one). */
export function graphemes(text) {
  const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return [...seg.segment(text)].length;
}

/** Code points: what most networks count. */
export function codePoints(text) {
  return [...text].length;
}

/**
 * The length as the network counts it (networks.json, text.counting):
 *  - "x": every URL weighs urlWeight (23); CJK and emoji weigh 2 (X's rule), the rest 1
 *  - "mastodon": every URL weighs urlWeight; a mention counts its local part only
 *  - "graphemes": grapheme clusters (Bluesky)
 *  - "plain": code points
 */
export function networkLength(text, spec) {
  const mode = spec.text?.counting ?? "plain";
  const weight = spec.text?.urlWeight ?? 23;
  if (mode === "graphemes") return graphemes(text);
  let working = text;
  let extra = 0;
  if (mode === "x" || mode === "mastodon") {
    for (const url of findUrls(text)) {
      working = working.replace(url, "");
      extra += weight;
    }
  }
  if (mode === "mastodon") {
    working = working.replace(/(^|[^\w@])@([\w.-]+)@[\w.-]+/g, "$1@$2");
  }
  if (mode === "x") {
    let n = 0;
    for (const ch of working) {
      const cp = ch.codePointAt(0);
      n += cp > 0x1100 && !(cp >= 0x2000 && cp <= 0x206f) ? 2 : 1;
    }
    return n + extra;
  }
  return codePoints(working) + extra;
}

/** A text reduced to what makes it the same post: lower case, no URL, no spaces. */
export function fingerprint(text) {
  return text
    .toLowerCase()
    .replace(URL_RE, "")
    .replace(/[#@]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

/** Similarity of two fingerprints, 0..1 (Dice on bigrams). */
export function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = (s) => {
    const map = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      map.set(g, (map.get(g) ?? 0) + 1);
    }
    return map;
  };
  const ga = grams(a);
  const gb = grams(b);
  let shared = 0;
  for (const [g, n] of ga) shared += Math.min(n, gb.get(g) ?? 0);
  return (2 * shared) / (a.length - 1 + b.length - 1);
}

/* ------------------------------------------------------------------ dates */

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function isoDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) fail(`Not a date: ${value}`);
  return d.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week of `date` (ISO week). */
export function mondayOf(date) {
  const d = new Date(date + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export function newId(prefix = "") {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}${stamp}-${rand}`;
}

/* ---------------------------------------------------------------- output */

export function out(value, flags = {}) {
  if (flags.md && typeof value?.md === "string") {
    process.stdout.write(value.md.trimEnd() + "\n");
    return;
  }
  if (value && typeof value === "object" && "md" in value) {
    const { md, ...rest } = value;
    process.stdout.write(JSON.stringify(rest) + "\n");
    return;
  }
  process.stdout.write(JSON.stringify(value) + "\n");
}

/** A Markdown table from rows of plain values. */
export function mdTable(headers, rows) {
  const line = (cells) => `| ${cells.map((c) => String(c ?? "").replace(/\|/g, "\\|")).join(" | ")} |`;
  return [line(headers), line(headers.map(() => "---")), ...rows.map(line)].join("\n");
}

export function pct(n, d) {
  return d ? Math.round((n / d) * 10000) / 100 : 0;
}

/* --------------------------------------------------- workspace settings */

/** rules.json with the defaults every script agrees on. */
export function loadRules(dir) {
  const rules = readJson(join(dir, "rules.json"), {});
  return { duplicateWindowDays: 30, duplicateSimilarity: 0.9, forbiddenWords: [], ...rules };
}

/** accounts.json; a workspace without one works in UTC with no account. */
export function loadAccounts(dir) {
  const accounts = readJson(join(dir, "accounts.json"), {});
  return { timezone: "UTC", country: null, accounts: [], ...accounts };
}

/** The first account of a network, or null. */
export function accountFor(dir, network) {
  return loadAccounts(dir).accounts.find((a) => a.network === network) ?? null;
}

/* ---------------------------------------------------------- text, dates */

/** "Launch of the autumn offer!" → "launch-of-the-autumn-offer" (ASCII, at most 60 chars). */
export function slugify(text, max = 60) {
  return String(text)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** ISO weekday of a YYYY-MM-DD: 1 Monday … 7 Sunday. */
export function weekdayOf(date) {
  const d = new Date(date + "T00:00:00Z");
  return ((d.getUTCDay() + 6) % 7) + 1;
}

export function weekdayName(n) {
  return WEEKDAY_NAMES[((Number(n) - 1) % 7 + 7) % 7] ?? String(n);
}

/** ISO week of a YYYY-MM-DD: "2026-W45". */
export function isoWeek(date) {
  const d = new Date(date + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of that week decides the year
  const year = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * A timestamp seen from a timezone: { date: "YYYY-MM-DD", time: "HH:MM",
 * hour: 0..23, weekday: 1..7 }. Null when the value is not a date.
 */
export function localParts(value, timeZone = "UTC") {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  }
  const parts = Object.fromEntries(fmt.formatToParts(d).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, time: `${parts.hour}:${parts.minute}`, hour: Number(parts.hour), weekday: weekdayOf(date) };
}

export function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value + "T00:00:00Z").getTime());
}

export function isHourMinute(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** The middle value of a list of numbers, null when empty. */
export function median(values) {
  const list = values.filter((v) => typeof v === "number" && !Number.isNaN(v)).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
}

/* ------------------------------------------------------------- entry point */

/** True when the module at `url` is the script Node was started with (so an imported script does not run its main). */
export function isMain(url) {
  return Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(url);
}
