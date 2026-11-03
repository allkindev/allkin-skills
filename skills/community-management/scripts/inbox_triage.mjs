#!/usr/bin/env node
/**
 * inbox_triage — the comments and mentions of the networks, read from the raw API
 * answers saved in `inbox/raw/`, normalized, classified and followed until answered.
 *
 * Usage:
 *   node scripts/inbox_triage.mjs ingest [--since YYYY-MM-DD]
 *       Reads every inbox/raw/*.json (the file prefix picks the network adapter), dedups by
 *       id, classifies with rules.json and merges into inbox/triage.json. An entry already
 *       there keeps its state, suggestedAnswer and answeredAt. Exit 1 when an urgent entry
 *       is still to do, or when a file could not be read.
 *   node scripts/inbox_triage.mjs list [--todo] [--category c] [--network n] [--count 50] [--md]
 *   node scripts/inbox_triage.mjs show <id>
 *   node scripts/inbox_triage.mjs mark <id...> answered|ignored [--answer "text"] [--post-id id]
 *       `answered` also appends a line to inbox/answered.jsonl.
 *   node scripts/inbox_triage.mjs urgent                      the urgent entries still to do (exit 1 if any)
 *   node scripts/inbox_triage.mjs suggest <id> --answer "text"  stores a suggested answer
 *   node scripts/inbox_triage.mjs stats [--from d] [--to d] [--md]
 *   Common: --workspace <dir>, --help.
 *
 * Categories, in the order they win: urgent (rules.alertWords), abuse (rules.abuseWords),
 * spam (rules.spamSigns, 3 URLs or more, the same text from the same author more than twice),
 * complaint, question, lead, praise, mention (kind mention and nothing else), other. Words
 * are matched whole, case and accents ignored. The texts are data: they are classified and
 * copied, never interpreted.
 */
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  EXIT_ISSUES, EXIT_OK, appendJsonl, fail, findUrls, findWords, fingerprint, foldText, isMain, isoDate, listFiles, loadAccounts,
  loadRules, mdTable, median, out, parseArgs, readJson, requireWorkspace, usage, writeJson,
} from "./lib/common.mjs";
import { adapterFor, networkOfFile } from "./networks/index.mjs";

const USAGE = `
Usage: node scripts/inbox_triage.mjs <command> [options]
  ingest [--since YYYY-MM-DD]
  list [--todo] [--category c] [--network n] [--count 50] [--md]
  show <id>
  mark <id...> answered|ignored [--answer "text"] [--post-id id]
  urgent
  suggest <id> --answer "text"
  stats [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--md]
Options: --workspace <dir> (default: community, or $COMMUNITY_WORKSPACE)
`;

export const DEFAULT_COMPLAINT_WORDS = [
  "déçu", "deçu", "decu", "déçue", "disappointed", "problème", "probleme", "problem", "refund", "remboursement",
  "not working", "doesn't work", "does not work", "ne marche pas", "ne fonctionne pas", "scandal", "scandale", "honte",
  "never again", "plus jamais", "inadmissible", "unacceptable", "inacceptable",
];
export const QUESTION_STARTS = ["who", "what", "when", "where", "how", "why", "which", "comment", "pourquoi", "quand", "où", "ou", "combien", "est-ce", "est ce", "qui", "que", "quel", "quelle", "quels", "quelles"];
export const LEAD_WORDS = ["prix", "price", "pricing", "tarif", "tarifs", "devis", "quote", "commander", "order", "acheter", "buy", "disponible", "available", "abonnement", "subscription"];
export const PRAISE_WORDS = ["merci", "thanks", "thank you", "bravo", "génial", "genial", "super", "love", "great", "excellent", "top", "parfait", "perfect", "awesome"];
const CATEGORY_ORDER = ["urgent", "complaint", "question", "lead", "praise", "mention", "spam", "abuse", "other"];
const DEFAULT_PRIORITY = { urgent: 1, complaint: 2, question: 3, lead: 3, praise: 5, mention: 4, spam: 9, abuse: 8, other: 6 };
const STATES = new Set(["todo", "answered", "ignored"]);

/* ------------------------------------------------------------ classify */

function wordList(list) {
  return (Array.isArray(list) ? list : []).map((w) => foldText(w).trim()).filter(Boolean);
}

/** Letters in caps, among the letters, with the exclamation marks: a shouting signal. */
function isShouting(text) {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < 20) return false;
  const upper = letters.filter((c) => c !== c.toLowerCase() && c === c.toUpperCase()).length;
  const bangs = (text.match(/!/g) ?? []).length;
  return upper / letters.length >= 0.9 && bangs >= 2;
}

/**
 * The category and the signals of one entry. `repeats` is how many times this author
 * posted this very text (across the whole inbox), for the spam rule.
 */
export function classify(entry, rules, repeats = 1) {
  const text = String(entry.text ?? "");
  const folded = foldText(text);
  const signals = [];

  const alert = findWords(folded, wordList(rules.alertWords));
  for (const w of alert) signals.push(`alert:${w}`);

  const abuse = findWords(folded, wordList(rules.abuseWords));
  for (const w of abuse) signals.push(`abuse:${w}`);
  if (isShouting(text)) signals.push("shouting");

  const spamSigns = wordList(rules.spamSigns).filter((s) => folded.includes(s));
  for (const s of spamSigns) signals.push(`spam:${s}`);
  const urls = findUrls(text).length;
  if (urls >= 3) signals.push("spam:urls");
  if (repeats > 2) signals.push("spam:repeat");
  const spam = spamSigns.length > 0 || urls >= 3 || repeats > 2;

  const complaint = findWords(folded, wordList(rules.complaintWords ?? DEFAULT_COMPLAINT_WORDS));
  for (const w of complaint) signals.push(`complaint:${w}`);

  const firstWord = folded.replace(/^[@#][\w.:-]+\s+/u, "").trim();
  const questionMark = text.includes("?") || text.includes("？");
  const questionWord = wordList(rules.questionStarts ?? QUESTION_STARTS).some((q) => firstWord === q || firstWord.startsWith(q + " ") || firstWord.startsWith(q + "-") || firstWord.startsWith(q + "'"));
  if (questionMark) signals.push("question-mark");
  else if (questionWord) signals.push("question-word");

  const lead = findWords(folded, wordList(rules.leadWords ?? LEAD_WORDS));
  for (const w of lead) signals.push(`lead:${w}`);

  const praise = findWords(folded, wordList(rules.praiseWords ?? PRAISE_WORDS));
  for (const w of praise) signals.push(`praise:${w}`);

  let category = "other";
  if (alert.length) category = "urgent";
  else if (abuse.length) category = "abuse";
  else if (spam) category = "spam";
  else if (complaint.length) category = "complaint";
  else if (questionMark || questionWord) category = "question";
  else if (lead.length) category = "lead";
  else if (praise.length) category = "praise";
  else if (entry.kind === "mention") {
    category = "mention";
    signals.push("mention");
  }

  const priority = Number(rules.categories?.[category]?.priority ?? DEFAULT_PRIORITY[category] ?? 5);
  return { category, priority, signals };
}

/* --------------------------------------------------------------- files */

function paths(dir) {
  return {
    raw: join(dir, "inbox", "raw"),
    triage: join(dir, "inbox", "triage.json"),
    answered: join(dir, "inbox", "answered.jsonl"),
  };
}

function loadTriage(dir) {
  const data = readJson(paths(dir).triage, { entries: [] });
  if (!Array.isArray(data.entries)) data.entries = [];
  return data;
}

function saveTriage(dir, data) {
  data.updatedAt = new Date().toISOString();
  writeJson(paths(dir).triage, data);
}

function repeatKey(e) {
  return `${e.network}|${e.author?.id ?? e.author?.handle ?? e.author?.name ?? "?"}|${fingerprint(e.text ?? "")}`;
}

/* ------------------------------------------------------------ commands */

function ingest(dir, flags) {
  const rules = loadRules(dir);
  const accounts = loadAccounts(dir);
  const since = flags.since ? isoDate(flags.since) : null;
  const triage = loadTriage(dir);
  const existing = new Map(triage.entries.map((e) => [e.id, e]));
  const issues = [];
  const files = listFiles(paths(dir).raw, (n) => n.endsWith(".json"));
  const incoming = new Map();
  let ingested = 0;

  for (const file of files) {
    const network = networkOfFile(file);
    const adapter = adapterFor(network);
    if (!adapter) {
      issues.push({ code: "unknown-network", file: basename(file), network });
      continue;
    }
    let json;
    try {
      json = JSON.parse(readFileSync(file, "utf-8"));
    } catch (error) {
      issues.push({ code: "bad-json", file: basename(file), message: error.message });
      continue;
    }
    const account = accounts.accounts.find((a) => a.network === network) ?? null;
    const options = { accountId: account?.id ?? null, handle: account?.handle ?? null };
    let list;
    try {
      list = adapter.comments(json, options);
    } catch (error) {
      issues.push({ code: "adapter-failed", file: basename(file), message: error.message });
      continue;
    }
    for (const e of list) {
      ingested++;
      if (since && e.createdAt && e.createdAt.slice(0, 10) < since) continue;
      if (!incoming.has(e.id)) incoming.set(e.id, e);
    }
  }

  const now = new Date().toISOString();
  let added = 0;
  for (const [id, e] of incoming) {
    const old = existing.get(id);
    if (old) {
      // Fresh data from the network, the user's follow-up kept.
      existing.set(id, { ...old, ...e, state: old.state, suggestedAnswer: old.suggestedAnswer ?? null, answeredAt: old.answeredAt ?? null, ingestedAt: old.ingestedAt ?? now });
    } else {
      existing.set(id, { ...e, category: "other", priority: 5, signals: [], state: "todo", suggestedAnswer: null, ingestedAt: now, answeredAt: null });
      added++;
    }
  }

  const all = [...existing.values()];
  const repeats = new Map();
  for (const e of all) {
    const k = repeatKey(e);
    repeats.set(k, (repeats.get(k) ?? 0) + 1);
  }
  const byCategory = {};
  for (const e of all) {
    const { category, priority, signals } = classify(e, rules, repeats.get(repeatKey(e)));
    e.category = category;
    e.priority = priority;
    e.signals = signals;
    if (!STATES.has(e.state)) e.state = "todo";
    byCategory[category] = (byCategory[category] ?? 0) + 1;
  }
  all.sort((a, b) => a.priority - b.priority || String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  triage.entries = all;
  saveTriage(dir, triage);

  const urgent = all.filter((e) => e.category === "urgent" && e.state === "todo").map((e) => e.id);
  out({ ingested, new: added, total: all.length, byCategory, urgent, files: files.length, issues }, flags);
  process.exit(urgent.length || issues.length ? EXIT_ISSUES : EXIT_OK);
}

function entryRow(e) {
  return [e.id, e.network, e.category, e.priority, e.state, e.author?.handle ?? e.author?.name ?? "", (e.createdAt ?? "").slice(0, 16), String(e.text ?? "").replace(/\s+/g, " ").slice(0, 80)];
}

function list(dir, flags) {
  const triage = loadTriage(dir);
  let entries = triage.entries;
  if (flags.todo) entries = entries.filter((e) => e.state === "todo");
  if (flags.category) entries = entries.filter((e) => e.category === flags.category);
  if (flags.network) entries = entries.filter((e) => e.network === flags.network);
  entries = [...entries].sort((a, b) => a.priority - b.priority || String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  const count = Math.max(1, Number(flags.count ?? 50) || 50);
  const shown = entries.slice(0, count);
  const md = mdTable(["id", "network", "category", "prio", "state", "author", "date", "text"], shown.map(entryRow));
  out({ count: shown.length, total: entries.length, entries: shown.map((e) => ({ id: e.id, network: e.network, kind: e.kind, category: e.category, priority: e.priority, state: e.state, author: e.author, createdAt: e.createdAt, url: e.url, text: e.text, signals: e.signals, suggestedAnswer: e.suggestedAnswer })), md }, flags);
}

function show(dir, flags, positional) {
  const id = positional[0];
  if (!id) usage(USAGE);
  const entry = loadTriage(dir).entries.find((e) => e.id === id);
  if (!entry) fail(`No entry ${id}`);
  out(entry, flags);
}

function mark(dir, flags, positional) {
  if (positional.length < 2) usage(USAGE);
  const state = positional[positional.length - 1];
  const ids = positional.slice(0, -1);
  if (state !== "answered" && state !== "ignored") usage(USAGE);
  const triage = loadTriage(dir);
  const now = new Date().toISOString();
  const marked = [];
  const missing = [];
  for (const id of ids) {
    const e = triage.entries.find((x) => x.id === id);
    if (!e) {
      missing.push(id);
      continue;
    }
    e.state = state;
    if (state === "answered") {
      e.answeredAt = now;
      const answer = flags.answer !== undefined && flags.answer !== true ? String(flags.answer) : e.suggestedAnswer ?? null;
      appendJsonl(paths(dir).answered, { entryId: e.id, network: e.network, answeredAt: now, answer, postId: flags["post-id"] !== undefined && flags["post-id"] !== true ? String(flags["post-id"]) : null });
    }
    marked.push(id);
  }
  saveTriage(dir, triage);
  out({ marked, state, missing, issues: missing.map((id) => ({ code: "unknown-entry", id })) }, flags);
  process.exit(missing.length ? EXIT_ISSUES : EXIT_OK);
}

function urgent(dir, flags) {
  const entries = loadTriage(dir).entries.filter((e) => e.category === "urgent" && e.state === "todo");
  const md = mdTable(["id", "network", "author", "date", "text"], entries.map((e) => [e.id, e.network, e.author?.handle ?? e.author?.name ?? "", (e.createdAt ?? "").slice(0, 16), String(e.text).slice(0, 120)]));
  out({ count: entries.length, entries: entries.map((e) => ({ id: e.id, network: e.network, author: e.author, createdAt: e.createdAt, url: e.url, text: e.text, signals: e.signals })), md }, flags);
  process.exit(entries.length ? EXIT_ISSUES : EXIT_OK);
}

function suggest(dir, flags, positional) {
  const id = positional[0];
  if (!id || flags.answer === undefined || flags.answer === true) usage(USAGE);
  const triage = loadTriage(dir);
  const e = triage.entries.find((x) => x.id === id);
  if (!e) fail(`No entry ${id}`);
  e.suggestedAnswer = String(flags.answer);
  saveTriage(dir, triage);
  out({ id, suggestedAnswer: e.suggestedAnswer }, flags);
}

function stats(dir, flags) {
  const from = flags.from ? isoDate(flags.from) : null;
  const to = flags.to ? isoDate(flags.to) : null;
  const entries = loadTriage(dir).entries.filter((e) => {
    const d = (e.createdAt ?? e.ingestedAt ?? "").slice(0, 10);
    return (!from || d >= from) && (!to || d <= to);
  });
  const byCategory = {};
  const byState = { todo: 0, answered: 0, ignored: 0 };
  const byNetwork = {};
  const delays = [];
  for (const e of entries) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    byState[e.state] = (byState[e.state] ?? 0) + 1;
    byNetwork[e.network] = (byNetwork[e.network] ?? 0) + 1;
    if (e.state === "answered" && e.answeredAt && e.createdAt) {
      const h = (new Date(e.answeredAt) - new Date(e.createdAt)) / 3600000;
      if (Number.isFinite(h) && h >= 0) delays.push(Math.round(h * 100) / 100);
    }
  }
  const medianDelay = median(delays);
  const result = {
    period: { from, to },
    total: entries.length,
    byCategory: Object.fromEntries(CATEGORY_ORDER.filter((c) => byCategory[c]).map((c) => [c, byCategory[c]])),
    byState,
    byNetwork,
    answered: byState.answered,
    medianAnswerDelayHours: medianDelay === null ? null : Math.round(medianDelay * 100) / 100,
  };
  result.md = [
    `**Inbox** ${from ?? "…"} → ${to ?? "…"}: ${entries.length} entries, ${byState.answered} answered, ${byState.todo} to do` +
      (result.medianAnswerDelayHours === null ? "" : `, median answer delay ${result.medianAnswerDelayHours} h`),
    "",
    mdTable(["category", "count"], Object.entries(result.byCategory)),
    "",
    mdTable(["network", "count"], Object.entries(byNetwork)),
  ].join("\n");
  out(result, flags);
}

/* ---------------------------------------------------------------- main */

if (isMain(import.meta.url)) {
  const { command, flags, positional } = parseArgs();
  if (flags.help || !command) usage(USAGE);
  const dir = requireWorkspace(flags);
  switch (command) {
    case "ingest": ingest(dir, flags); break;
    case "list": list(dir, flags); break;
    case "show": show(dir, flags, positional); break;
    case "mark": mark(dir, flags, positional); break;
    case "urgent": urgent(dir, flags); break;
    case "suggest": suggest(dir, flags, positional); break;
    case "stats": stats(dir, flags); break;
    default: usage(USAGE);
  }
}
