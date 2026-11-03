#!/usr/bin/env node
/**
 * calendar — the editorial calendar (calendar.json of the workspace).
 *
 *   node scripts/calendar.mjs add --date YYYY-MM-DD [--time HH:MM] --networks x,linkedin --title "…"
 *                                 [--theme t] [--id id] [--state idea] [--draft path] [--notes "…"]
 *   node scripts/calendar.mjs move <id> --date YYYY-MM-DD [--time HH:MM]
 *   node scripts/calendar.mjs set-state <id> <state> [--action-id id]
 *   node scripts/calendar.mjs set <id> [--title …] [--theme …] [--networks a,b] [--draft path] [--notes …]
 *   node scripts/calendar.mjs remove <id>
 *   node scripts/calendar.mjs show <id>
 *   node scripts/calendar.mjs list [--from d] [--to d] [--state s] [--network n] [--md]
 *   node scripts/calendar.mjs week [--from monday] [--md]
 *   node scripts/calendar.mjs month [--month YYYY-MM] [--md]
 *   node scripts/calendar.mjs next [--count 5] [--md]
 *   node scripts/calendar.mjs holes [--days 7] [--networks a,b] [--md]
 *   node scripts/calendar.mjs collisions [--md]
 *   node scripts/calendar.mjs export (--md | --ics) [--out reports/calendar.ics]
 *
 * Entries stay sorted by date then time. `holes` and `collisions` exit 1 when
 * they find some. `export --ics` prints the calendar (or writes it with --out)
 * as floating local times with the TZID of accounts.json.
 */
import { join, resolve, relative, isAbsolute } from "node:path";
import {
  EXIT_ISSUES, EXIT_OK, addDays, fail, isHourMinute, isIsoDate, isMain, knownNetworks, loadAccounts, mdTable, mondayOf,
  networkSpec, out, parseArgs, readJson, requireWorkspace, slugify, today, usage, weekdayName, weekdayOf, writeJson,
  writeText,
} from "./lib/common.mjs";

const USAGE = `
Usage: node scripts/calendar.mjs <command> [...] [--workspace dir] [--md]
  add --date YYYY-MM-DD [--time HH:MM] --networks x,linkedin --title "…" [--theme t] [--id id] [--state idea] [--draft path] [--notes "…"]
  move <id> --date YYYY-MM-DD [--time HH:MM]
  set-state <id> <state> [--action-id id]      states: idea draft ready scheduled published cancelled
  set <id> [--title …] [--theme …] [--networks a,b] [--draft path|null] [--notes …]
  remove <id> | show <id>
  list [--from d] [--to d] [--state s] [--network n]
  week [--from monday]        month [--month YYYY-MM]        next [--count 5]
  holes [--days 7] [--networks a,b]      collisions
  export (--md | --ics) [--out reports/calendar.ics]
`;

export const STATES = ["idea", "draft", "ready", "scheduled", "published", "cancelled"];
const PLANNED = ["ready", "scheduled", "published"];
const FILE = "calendar.json";

/* ---------------------------------------------------------------- store */

function load(ws) {
  const data = readJson(join(ws, FILE), { entries: [] });
  if (!Array.isArray(data.entries)) data.entries = [];
  return data;
}

function save(ws, data) {
  data.entries.sort(byDateTime);
  writeJson(join(ws, FILE), data);
}

function byDateTime(a, b) {
  return (a.date + " " + (a.time ?? "")).localeCompare(b.date + " " + (b.time ?? "")) || String(a.id).localeCompare(String(b.id));
}

function find(data, id) {
  const entry = data.entries.find((e) => e.id === id);
  if (!entry) fail(`No calendar entry "${id}"`);
  return entry;
}

/* ----------------------------------------------------------- validation */

function parseNetworks(value) {
  const list = String(value).split(",").map((s) => s.trim()).filter(Boolean);
  if (!list.length) fail("--networks needs at least one network");
  for (const id of list) networkSpec(id); // exits 2 on an unknown one
  return [...new Set(list)];
}

function checkDate(value) {
  if (!isIsoDate(value)) fail(`--date must be YYYY-MM-DD, got "${value}"`);
  return value;
}

function checkTime(value) {
  if (value === undefined || value === null || value === "") return null;
  if (!isHourMinute(value)) fail(`--time must be HH:MM, got "${value}"`);
  return value;
}

function checkState(value) {
  if (!STATES.includes(value)) fail(`Unknown state "${value}". States: ${STATES.join(", ")}`);
  return value;
}

function text(value, name) {
  if (value === undefined || value === true || String(value).trim() === "") fail(`--${name} is required`);
  return String(value).trim();
}

/* --------------------------------------------------------------- views */

function row(e) {
  return [e.date, e.time ?? "", e.networks.join(", "), e.title, e.state];
}

function dayLabel(date) {
  return `${weekdayName(weekdayOf(date))} ${date}`;
}

function groupByDay(entries, from, days) {
  const result = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    result.push({ date, entries: entries.filter((e) => e.date === date) });
  }
  return result;
}

function dayTable(groups) {
  const rows = [];
  for (const g of groups) {
    if (!g.entries.length) rows.push([dayLabel(g.date), "", "", "—", ""]);
    for (const e of g.entries) rows.push([dayLabel(g.date), e.time ?? "", e.networks.join(", "), e.title, e.state]);
  }
  return mdTable(["Day", "Time", "Networks", "Title", "State"], rows);
}

function listTable(entries) {
  return mdTable(["Date", "Time", "Networks", "Title", "State"], entries.map(row));
}

/* ------------------------------------------------------------- commands */

function cmdAdd(ws, flags) {
  const data = load(ws);
  const date = checkDate(flags.date);
  const title = text(flags.title, "title");
  const entry = {
    id: flags.id ? String(flags.id) : `${date}-${slugify(title) || "post"}`,
    date,
    time: checkTime(flags.time),
    networks: parseNetworks(text(flags.networks, "networks")),
    theme: flags.theme && flags.theme !== true ? String(flags.theme) : null,
    title,
    state: checkState(flags.state && flags.state !== true ? String(flags.state) : "idea"),
    draft: flags.draft && flags.draft !== true ? String(flags.draft) : null,
    actionId: null,
    notes: flags.notes && flags.notes !== true ? String(flags.notes) : "",
  };
  if (data.entries.some((e) => e.id === entry.id)) fail(`A calendar entry "${entry.id}" already exists (give another --id)`);
  data.entries.push(entry);
  save(ws, data);
  return { added: entry };
}

function cmdMove(ws, flags, [id]) {
  if (!id) fail("move needs an id");
  const data = load(ws);
  const entry = find(data, id);
  if (flags.date === undefined) fail("move needs --date");
  entry.date = checkDate(flags.date);
  if (flags.time !== undefined) entry.time = checkTime(flags.time);
  save(ws, data);
  return { moved: entry };
}

function cmdSetState(ws, flags, [id, state]) {
  if (!id || !state) fail("set-state needs an id and a state");
  const data = load(ws);
  const entry = find(data, id);
  entry.state = checkState(state);
  if (flags["action-id"] !== undefined) {
    if (!["published", "scheduled"].includes(entry.state)) fail("--action-id goes with the states scheduled or published");
    entry.actionId = flags["action-id"] === true ? null : String(flags["action-id"]);
  }
  save(ws, data);
  return { entry };
}

function cmdSet(ws, flags, [id]) {
  if (!id) fail("set needs an id");
  const data = load(ws);
  const entry = find(data, id);
  const changed = [];
  if (flags.title !== undefined) {
    entry.title = text(flags.title, "title");
    changed.push("title");
  }
  if (flags.theme !== undefined) {
    entry.theme = flags.theme === true || flags.theme === "null" || flags.theme === "" ? null : String(flags.theme);
    changed.push("theme");
  }
  if (flags.networks !== undefined) {
    entry.networks = parseNetworks(text(flags.networks, "networks"));
    changed.push("networks");
  }
  if (flags.draft !== undefined) {
    entry.draft = flags.draft === true || flags.draft === "null" || flags.draft === "" ? null : String(flags.draft);
    changed.push("draft");
  }
  if (flags.notes !== undefined) {
    entry.notes = flags.notes === true ? "" : String(flags.notes);
    changed.push("notes");
  }
  if (!changed.length) fail("set needs at least one of --title --theme --networks --draft --notes");
  save(ws, data);
  return { entry, changed };
}

function cmdRemove(ws, flags, [id]) {
  if (!id) fail("remove needs an id");
  const data = load(ws);
  find(data, id);
  data.entries = data.entries.filter((e) => e.id !== id);
  save(ws, data);
  return { removed: id };
}

function cmdShow(ws, flags, [id]) {
  if (!id) fail("show needs an id");
  return { entry: find(load(ws), id) };
}

function cmdList(ws, flags) {
  let entries = load(ws).entries.slice().sort(byDateTime);
  if (flags.from) entries = entries.filter((e) => e.date >= checkDate(flags.from));
  if (flags.to) entries = entries.filter((e) => e.date <= checkDate(flags.to));
  if (flags.state) entries = entries.filter((e) => e.state === checkState(flags.state));
  if (flags.network) entries = entries.filter((e) => e.networks.includes(flags.network));
  return { count: entries.length, entries, md: listTable(entries) };
}

function cmdWeek(ws, flags) {
  const from = flags.from ? mondayOf(checkDate(flags.from)) : mondayOf(today());
  const to = addDays(from, 6);
  const entries = load(ws).entries.filter((e) => e.date >= from && e.date <= to).sort(byDateTime);
  const days = groupByDay(entries, from, 7);
  return { from, to, count: entries.length, days, md: dayTable(days) };
}

function cmdMonth(ws, flags) {
  const month = flags.month && flags.month !== true ? String(flags.month) : today().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) fail(`--month must be YYYY-MM, got "${month}"`);
  const from = `${month}-01`;
  const next = new Date(from + "T00:00:00Z");
  next.setUTCMonth(next.getUTCMonth() + 1);
  const days = Math.round((next - new Date(from + "T00:00:00Z")) / 86400000);
  const to = addDays(from, days - 1);
  const entries = load(ws).entries.filter((e) => e.date >= from && e.date <= to).sort(byDateTime);
  const groups = groupByDay(entries, from, days);
  return { month, from, to, count: entries.length, days: groups, md: dayTable(groups) };
}

function cmdNext(ws, flags) {
  const count = flags.count ? Number(flags.count) : 5;
  if (!Number.isInteger(count) || count < 1) fail("--count must be a positive integer");
  const now = today();
  const entries = load(ws).entries
    .filter((e) => e.date >= now && !["published", "cancelled"].includes(e.state))
    .sort(byDateTime)
    .slice(0, count);
  return { count: entries.length, entries, md: listTable(entries) };
}

function cmdHoles(ws, flags) {
  const days = flags.days ? Number(flags.days) : 7;
  if (!Number.isInteger(days) || days < 1) fail("--days must be a positive integer");
  const networks = flags.networks
    ? parseNetworks(flags.networks)
    : [...new Set(loadAccounts(ws).accounts.map((a) => a.network).filter((n) => knownNetworks().includes(n)))];
  const from = today();
  const to = addDays(from, days - 1);
  const planned = load(ws).entries.filter((e) => PLANNED.includes(e.state)).sort(byDateTime);
  const holes = [];
  for (const network of networks) {
    const mine = planned.filter((e) => e.networks.includes(network));
    if (mine.some((e) => e.date >= from && e.date <= to)) continue;
    const before = mine.filter((e) => e.date < from);
    const after = mine.filter((e) => e.date > to);
    holes.push({ network, last: before.length ? before[before.length - 1].date : null, next: after.length ? after[0].date : null });
  }
  const issues = holes.map((h) => `${h.network}: nothing planned from ${from} to ${to}${h.last ? ` (last: ${h.last})` : " (never)"}`);
  const md = holes.length
    ? mdTable(["Network", "Last post", "Next planned"], holes.map((h) => [h.network, h.last ?? "never", h.next ?? "—"]))
    : networks.length ? `Every network has a post planned from ${from} to ${to}.` : "No network to check (accounts.json is empty; give --networks).";
  return { from, to, networks, holes, issues, md };
}

function minutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function cmdCollisions(ws) {
  const entries = load(ws).entries.filter((e) => e.state !== "cancelled").sort(byDateTime);
  const collisions = [];
  const byKey = new Map();
  for (const e of entries) {
    for (const network of e.networks) {
      const key = `${network}|${e.date}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(e);
    }
  }
  for (const [key, list] of byKey) {
    const [network, date] = key.split("|");
    if (list.length > 3) collisions.push({ kind: "too-many", network, date, count: list.length, ids: list.map((e) => e.id) });
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a.time || !b.time) continue;
        const gap = Math.abs(minutes(a.time) - minutes(b.time));
        if (gap <= 120) collisions.push({ kind: "too-close", network, date, gapMinutes: gap, ids: [a.id, b.id] });
      }
    }
  }
  const issues = collisions.map((c) =>
    c.kind === "too-many"
      ? `${c.network} ${c.date}: ${c.count} posts in one day (${c.ids.join(", ")})`
      : `${c.network} ${c.date}: ${c.ids.join(" and ")} are ${c.gapMinutes} min apart`,
  );
  const md = collisions.length
    ? mdTable(["Network", "Date", "Problem", "Entries"], collisions.map((c) => [c.network, c.date, c.kind === "too-many" ? `${c.count} posts` : `${c.gapMinutes} min apart`, c.ids.join(", ")]))
    : "No collision.";
  return { collisions, issues, md };
}

/* ---------------------------------------------------------------- export */

function icsEscape(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function icsFold(line) {
  // RFC 5545: lines of at most 75 octets, continuation lines start with a space.
  const bytes = Buffer.from(line, "utf-8");
  if (bytes.length <= 75) return line;
  const parts = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, "utf-8") > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = ch;
    } else current += ch;
  }
  parts.push(current);
  return parts.map((p, i) => (i ? " " + p : p)).join("\r\n");
}

export function toIcs(entries, timezone) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Allkin//community-management//EN", "CALSCALE:GREGORIAN"];
  for (const e of entries) {
    const compact = e.date.replace(/-/g, "");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${icsEscape(e.id)}@allkin`);
    lines.push(`DTSTAMP:${stamp}`);
    if (e.time) lines.push(`DTSTART;TZID=${timezone}:${compact}T${e.time.replace(":", "")}00`);
    else lines.push(`DTSTART;VALUE=DATE:${compact}`);
    lines.push(`SUMMARY:${icsEscape(`${e.title} [${e.networks.join(", ")}]`)}`);
    const description = [e.theme ? `Theme: ${e.theme}` : null, e.draft ? `Draft: ${e.draft}` : null, `State: ${e.state}`].filter(Boolean).join("\n");
    lines.push(`DESCRIPTION:${icsEscape(description)}`);
    lines.push(`CATEGORIES:${e.networks.map(icsEscape).join(",")}`);
    lines.push(`STATUS:${e.state === "cancelled" ? "CANCELLED" : e.state === "published" || e.state === "scheduled" ? "CONFIRMED" : "TENTATIVE"}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(icsFold).join("\r\n") + "\r\n";
}

function cmdExport(ws, flags) {
  const entries = load(ws).entries.slice().sort(byDateTime);
  let body;
  let format;
  if (flags.ics) {
    format = "ics";
    body = toIcs(entries, loadAccounts(ws).timezone);
  } else if (flags.md) {
    format = "md";
    body = mdTable(["Date", "Time", "Networks", "Title", "State", "Theme"], entries.map((e) => [...row(e), e.theme ?? ""])) + "\n";
  } else fail("export needs --md or --ics");
  if (flags.out && flags.out !== true) {
    const target = resolve(ws, String(flags.out));
    const rel = relative(ws, target);
    if (rel.startsWith("..") || isAbsolute(rel)) fail("--out must stay inside the workspace");
    writeText(target, body);
    return { raw: false, value: { path: target, format, count: entries.length } };
  }
  return { raw: true, value: body };
}

/* ----------------------------------------------------------------- main */

const COMMANDS = {
  add: cmdAdd, move: cmdMove, "set-state": cmdSetState, set: cmdSet, remove: cmdRemove, show: cmdShow,
  list: cmdList, week: cmdWeek, month: cmdMonth, next: cmdNext, holes: cmdHoles, collisions: cmdCollisions,
};

function main() {
  const { command, flags, positional } = parseArgs();
  if (flags.help || !command) usage(USAGE);
  const ws = requireWorkspace(flags);
  if (command === "export") {
    const result = cmdExport(ws, flags);
    if (result.raw) process.stdout.write(result.value);
    else out(result.value, {});
    process.exit(EXIT_OK);
  }
  const handler = COMMANDS[command];
  if (!handler) usage(USAGE);
  const result = handler(ws, flags, positional);
  out(result, flags);
  process.exit(result.issues?.length ? EXIT_ISSUES : EXIT_OK);
}

if (isMain(import.meta.url)) main();
