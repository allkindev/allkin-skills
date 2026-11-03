#!/usr/bin/env node
/**
 * publish_log — the register of what went out (published.jsonl).
 *
 *   node scripts/publish_log.mjs add --draft <id> --network x [--url …] [--post-id …] [--account @h]
 *            [--published-at iso] [--action-id …] [--theme t] [--calendar-id id] [--text "…" | --file path]
 *   node scripts/publish_log.mjs check --network x (--text "…" | --file path) [--days 30]
 *   node scripts/publish_log.mjs list [--network n] [--from d] [--to d] [--count 20] [--md]
 *   node scripts/publish_log.mjs stats [--from d] [--to d] [--md]
 *
 * `add` appends one line (fingerprint and excerpt from the text — given, or
 * read from drafts/<id>/<network>.md, else master.md), reads drafts/<id>/
 * draft.json for the calendar entry and the theme, and marks the calendar
 * entry published. `check` looks for the same or a near-same text already
 * posted on that network within rules.duplicateWindowDays (similarity ≥
 * rules.duplicateSimilarity): exit 1 and the matches when it finds some.
 * `stats` counts posts per network, theme and ISO week, and the last post of
 * each network. File paths are relative to the workspace and stay inside it.
 */
import { existsSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  EXIT_ISSUES, EXIT_OK, accountFor, appendJsonl, fail, fingerprint, isIsoDate, isMain, isoWeek, loadAccounts,
  loadRules, localParts, mdTable, networkSpec, newId, out, parseArgs, readJson, readJsonl, readText,
  requireWorkspace, similarity, usage, writeJson,
} from "./lib/common.mjs";

const USAGE = `
Usage: node scripts/publish_log.mjs <command> [...] [--workspace dir] [--md]
  add --draft <id> --network x [--url …] [--post-id …] [--account @h] [--published-at iso] [--action-id …]
      [--theme t] [--calendar-id id] [--text "…" | --file path]
  check --network x (--text "…" | --file path) [--days 30]
  list [--network n] [--from d] [--to d] [--count 20]
  stats [--from d] [--to d]
`;

const FILE = "published.jsonl";

/* ---------------------------------------------------------------- shared */

function insideWorkspace(ws, path) {
  const target = resolve(ws, String(path));
  const rel = relative(ws, target);
  if (rel.startsWith("..") || isAbsolute(rel)) fail(`Path outside the workspace: ${path}`);
  return target;
}

function textFromFlags(ws, flags, required = true) {
  if (flags.text !== undefined && flags.text !== true) return String(flags.text);
  if (flags.file && flags.file !== true) return readText(insideWorkspace(ws, flags.file));
  if (required) fail("Give --text or --file");
  return null;
}

export function excerptOf(text, max = 140) {
  const flat = String(text).replace(/\s+/g, " ").trim();
  const chars = [...flat];
  return chars.length > max ? chars.slice(0, max - 1).join("") + "…" : flat;
}

function checkDateFlag(flags, name) {
  if (flags[name] === undefined) return null;
  if (!isIsoDate(flags[name])) fail(`--${name} must be YYYY-MM-DD`);
  return flags[name];
}

/**
 * The lines of published.jsonl of `network` whose text is the same or near
 * the same as `text`, within rules.duplicateWindowDays before `now`.
 * Each match carries its similarity (0..1).
 */
export function findDuplicates(workspaceDir, network, text, rules = {}, now = new Date()) {
  const windowDays = Number(rules.duplicateWindowDays ?? 30);
  const threshold = Number(rules.duplicateSimilarity ?? 0.9);
  const since = new Date(now.getTime() - windowDays * 86400000);
  const print = fingerprint(String(text));
  const matches = [];
  for (const line of readJsonl(join(workspaceDir, FILE))) {
    if (line.network !== network || !line.fingerprint) continue;
    const at = new Date(line.publishedAt);
    if (Number.isNaN(at.getTime()) || at < since || at > new Date(now.getTime() + 60000)) continue;
    const score = similarity(print, line.fingerprint);
    if (score >= threshold) matches.push({ ...line, similarity: Math.round(score * 1000) / 1000 });
  }
  return matches.sort((a, b) => b.similarity - a.similarity || String(b.publishedAt).localeCompare(String(a.publishedAt)));
}

/* -------------------------------------------------------------- commands */

function cmdAdd(ws, flags) {
  const draftId = flags.draft && flags.draft !== true ? String(flags.draft) : fail("add needs --draft <id>");
  const network = flags.network && flags.network !== true ? String(flags.network) : fail("add needs --network");
  networkSpec(network);
  const draftDir = join(ws, "drafts", draftId);
  const draft = readJson(join(draftDir, "draft.json"), {});
  let text = textFromFlags(ws, flags, false);
  if (text === null) {
    for (const candidate of [join(draftDir, `${network}.md`), join(draftDir, "master.md")]) {
      if (existsSync(candidate)) {
        text = readText(candidate);
        break;
      }
    }
  }
  if (text === null) fail(`No text: give --text or --file, or write drafts/${draftId}/${network}.md`);
  const publishedAt = flags["published-at"] && flags["published-at"] !== true ? new Date(String(flags["published-at"])) : new Date();
  if (Number.isNaN(publishedAt.getTime())) fail("--published-at must be an ISO date or timestamp");
  const calendarId = flags["calendar-id"] && flags["calendar-id"] !== true ? String(flags["calendar-id"]) : draft.calendarId ?? null;
  const line = {
    id: newId("pub-"),
    draftId,
    calendarId,
    network,
    account: flags.account && flags.account !== true ? String(flags.account) : accountFor(ws, network)?.handle ?? null,
    publishedAt: publishedAt.toISOString(),
    postId: flags["post-id"] && flags["post-id"] !== true ? String(flags["post-id"]) : null,
    url: flags.url && flags.url !== true ? String(flags.url) : null,
    fingerprint: fingerprint(text),
    excerpt: excerptOf(text),
    theme: flags.theme && flags.theme !== true ? String(flags.theme) : draft.theme ?? null,
    actionId: flags["action-id"] && flags["action-id"] !== true ? String(flags["action-id"]) : null,
  };
  appendJsonl(join(ws, FILE), line);

  let calendar = "none";
  if (calendarId) {
    const calPath = join(ws, "calendar.json");
    const data = readJson(calPath, { entries: [] });
    const entry = (data.entries ?? []).find((e) => e.id === calendarId);
    if (entry) {
      entry.state = "published";
      if (line.actionId) entry.actionId = line.actionId;
      writeJson(calPath, data);
      calendar = "published";
    } else calendar = "not-found";
  }
  return { added: { id: line.id, network, calendarId, publishedAt: line.publishedAt, excerpt: line.excerpt }, calendar };
}

function cmdCheck(ws, flags) {
  const network = flags.network && flags.network !== true ? String(flags.network) : fail("check needs --network");
  networkSpec(network);
  const text = textFromFlags(ws, flags);
  const rules = loadRules(ws);
  if (flags.days !== undefined) {
    const days = Number(flags.days);
    if (!Number.isInteger(days) || days < 1) fail("--days must be a positive integer");
    rules.duplicateWindowDays = days;
  }
  const matches = findDuplicates(ws, network, text, rules).map((m) => ({
    id: m.id, url: m.url, publishedAt: m.publishedAt, similarity: m.similarity, excerpt: m.excerpt,
  }));
  const issues = matches.map((m) => `${network}: ${Math.round(m.similarity * 100)} % the same as ${m.url ?? m.id} (${String(m.publishedAt).slice(0, 10)})`);
  const md = matches.length
    ? mdTable(["Date", "Similarity", "Link", "Excerpt"], matches.map((m) => [String(m.publishedAt).slice(0, 10), `${Math.round(m.similarity * 100)} %`, m.url ?? m.id, m.excerpt]))
    : `Nothing alike on ${network} in the last ${rules.duplicateWindowDays} days.`;
  return { network, windowDays: rules.duplicateWindowDays, threshold: rules.duplicateSimilarity, duplicates: matches, issues, md };
}

function inRange(line, from, to) {
  const day = String(line.publishedAt ?? "").slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
}

function cmdList(ws, flags) {
  const from = checkDateFlag(flags, "from");
  const to = checkDateFlag(flags, "to");
  const count = flags.count ? Number(flags.count) : 20;
  if (!Number.isInteger(count) || count < 1) fail("--count must be a positive integer");
  let lines = readJsonl(join(ws, FILE)).filter((l) => inRange(l, from, to));
  if (flags.network && flags.network !== true) lines = lines.filter((l) => l.network === flags.network);
  lines.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const total = lines.length;
  lines = lines.slice(0, count);
  const posts = lines.map((l) => ({ id: l.id, network: l.network, publishedAt: l.publishedAt, url: l.url, theme: l.theme ?? null, excerpt: l.excerpt, calendarId: l.calendarId ?? null }));
  const md = mdTable(["Date", "Network", "Theme", "Excerpt", "Link"], posts.map((p) => [String(p.publishedAt).slice(0, 16).replace("T", " "), p.network, p.theme ?? "", p.excerpt, p.url ?? ""]));
  return { total, count: posts.length, posts, md };
}

function count(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function cmdStats(ws, flags) {
  const from = checkDateFlag(flags, "from");
  const to = checkDateFlag(flags, "to");
  const timezone = loadAccounts(ws).timezone;
  const lines = readJsonl(join(ws, FILE)).filter((l) => inRange(l, from, to));
  const byNetwork = new Map();
  const byTheme = new Map();
  const byWeek = new Map();
  const lastPost = {};
  for (const l of lines) {
    count(byNetwork, l.network);
    count(byTheme, l.theme ?? "(none)");
    const local = localParts(l.publishedAt, timezone);
    if (local) count(byWeek, isoWeek(local.date));
    if (!lastPost[l.network] || String(l.publishedAt) > String(lastPost[l.network])) lastPost[l.network] = l.publishedAt;
  }
  const sorted = (map) => Object.fromEntries([...map].sort((a, b) => a[0].localeCompare(b[0])));
  const result = { from, to, total: lines.length, byNetwork: sorted(byNetwork), byTheme: sorted(byTheme), byWeek: sorted(byWeek), lastPost };
  result.md = [
    `**${lines.length} posts**${from || to ? ` (${from ?? "…"} → ${to ?? "…"})` : ""}`,
    "",
    mdTable(["Network", "Posts", "Last post"], Object.entries(result.byNetwork).map(([n, c]) => [n, c, String(lastPost[n]).slice(0, 10)])),
    "",
    mdTable(["Theme", "Posts"], Object.entries(result.byTheme)),
    "",
    mdTable(["Week", "Posts"], Object.entries(result.byWeek)),
  ].join("\n");
  return result;
}

/* ------------------------------------------------------------------ main */

const COMMANDS = { add: cmdAdd, check: cmdCheck, list: cmdList, stats: cmdStats };

function main() {
  const { command, flags } = parseArgs();
  if (flags.help || !command || !COMMANDS[command]) usage(USAGE);
  const ws = requireWorkspace(flags);
  const result = COMMANDS[command](ws, flags);
  out(result, flags);
  process.exit(result.issues?.length ? EXIT_ISSUES : EXIT_OK);
}

if (isMain(import.meta.url)) main();
