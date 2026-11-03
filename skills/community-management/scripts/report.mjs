#!/usr/bin/env node
/**
 * report — writes reports/<period>.md from the figures of the workspace.
 *
 *   node scripts/report.mjs --period YYYY-MM [--md]
 *   node scripts/report.mjs --from YYYY-MM-DD --to YYYY-MM-DD [--md]
 *
 * Fills the placeholders of assets/report.md of the competence: the period,
 * the networks and figures of stats/digest.json (key figures with their
 * deltas, one row per network, top posts, best slots), and the community
 * (comments of the period by category from inbox/triage.json, answers and
 * their median delay from inbox/answered.jsonl, posts published per network
 * from published.jsonl). The `<!-- agent: … -->` comments are left for the
 * agent to write under. Without digest.json the figure sections say so and
 * the script exits 1 with the issue, the report written all the same.
 *
 * Output: { path, period, figures, issues } — the report itself with --md.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  EXIT_ISSUES, EXIT_OK, SKILL_ROOT, fail, isIsoDate, isMain, loadAccounts, loadNetworks, mdTable, median, out,
  parseArgs, readJson, readJsonl, readText, requireWorkspace, usage, weekdayName, writeText,
} from "./lib/common.mjs";

const USAGE = `
Usage: node scripts/report.mjs (--period YYYY-MM | --from YYYY-MM-DD --to YYYY-MM-DD) [--workspace dir] [--md]
`;

const NO_FIGURES = "_No figures collected (stats/digest.json missing): run stats_digest first._";

/* ------------------------------------------------------------- formatting */

function num(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function rate(value) {
  return value === null || value === undefined ? "—" : `${num(value, 2)} %`;
}

function delta(figure) {
  if (!figure || figure.delta === null || figure.delta === undefined) return "—";
  const sign = figure.delta > 0 ? "+" : "";
  const pctPart = figure.deltaPct === null || figure.deltaPct === undefined ? "" : ` (${sign}${num(figure.deltaPct, 2)} %)`;
  return `${sign}${num(figure.delta)}${pctPart}`;
}

function withDelta(figure) {
  if (!figure) return "—";
  const d = delta(figure);
  return d === "—" ? num(figure.now) : `${num(figure.now)} (${d})`;
}

function label(network) {
  return loadNetworks().networks[network]?.label ?? network;
}

function periodOf(flags) {
  if (flags.period && flags.period !== true) {
    const month = String(flags.period);
    if (!/^\d{4}-\d{2}$/.test(month)) fail("--period must be YYYY-MM");
    const from = `${month}-01`;
    const start = new Date(from + "T00:00:00Z");
    if (Number.isNaN(start.getTime())) fail("--period must be a real month");
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(0);
    return { label: month, from, to: end.toISOString().slice(0, 10) };
  }
  if (!isIsoDate(flags.from) || !isIsoDate(flags.to)) fail("Give --period YYYY-MM, or --from and --to as YYYY-MM-DD");
  if (flags.from > flags.to) fail("--from must not be after --to");
  return { label: `${flags.from}_${flags.to}`, from: flags.from, to: flags.to };
}

/* ---------------------------------------------------------------- figures */

function sumBefore(networks, key) {
  let total = 0;
  let any = false;
  for (const n of Object.values(networks)) {
    const before = n?.[key]?.before;
    if (typeof before === "number") {
      total += before;
      any = true;
    }
  }
  return any ? total : null;
}

function keyFigures(digest) {
  const total = digest.total ?? {};
  const networks = digest.networks ?? {};
  const before = {
    followers: sumBefore(networks, "followers"),
    impressions: sumBefore(networks, "impressions"),
    engagements: sumBefore(networks, "engagements"),
  };
  before.engagementRate = before.impressions ? Math.round((before.engagements / before.impressions) * 10000) / 100 : null;
  const line = (name, now, prev, isRate = false) => {
    const d = typeof now === "number" && typeof prev === "number"
      ? { delta: Math.round((now - prev) * 100) / 100, deltaPct: isRate || !prev ? null : Math.round(((now - prev) / prev) * 10000) / 100 }
      : null;
    return [name, isRate ? rate(now) : num(now), isRate ? rate(prev) : num(prev), d ? (isRate ? `${d.delta > 0 ? "+" : ""}${num(d.delta, 2)} pt` : delta(d)) : "—"];
  };
  const rows = [
    line("Followers", total.followers, before.followers),
    line("Impressions", total.impressions, before.impressions),
    line("Engagements", total.engagements, before.engagements),
    line("Engagement rate", total.engagementRate, before.engagementRate, true),
    ["Posts", num(total.posts), "—", "—"],
  ];
  return mdTable(["Figure", "This period", "Previous", "Delta"], rows);
}

function byNetwork(digest) {
  const rows = Object.entries(digest.networks ?? {}).map(([id, n]) => [
    label(id), withDelta(n.followers), withDelta(n.impressions), withDelta(n.engagements),
    n.engagementRate ? `${rate(n.engagementRate.now)}${typeof n.engagementRate.before === "number" ? ` (before ${rate(n.engagementRate.before)})` : ""}` : "—",
    withDelta(n.clicks), num(n.posts),
  ]);
  if (!rows.length) return "_No network in the digest._";
  return mdTable(["Network", "Followers", "Impressions", "Engagements", "Eng. rate", "Clicks", "Posts"], rows);
}

function topPosts(digest) {
  const posts = (digest.topPosts ?? []).slice(0, 5);
  if (!posts.length) return "_No post stood out in the period._";
  return posts
    .map((p) => `- **${label(p.network)}** — ${p.excerpt ?? p.postId ?? ""} — ${num(p.engagements)} engagements, ${num(p.impressions)} impressions, ${rate(p.engagementRate)}${p.url ? ` — ${p.url}` : ""}`)
    .join("\n");
}

function bestSlots(digest) {
  const slots = (digest.bestSlots ?? []).slice(0, 5);
  if (!slots.length) return "_Not enough posts to tell a best slot (two per slot at least)._";
  return slots
    .map((s) => `- ${weekdayName(s.weekday)} ${String(s.hour).padStart(2, "0")}:00 — ${num(s.posts)} posts, ${rate(s.avgEngagementRate)} on average`)
    .join("\n");
}

/* -------------------------------------------------------------- community */

function inPeriod(value, from, to) {
  const day = String(value ?? "").slice(0, 10);
  return isIsoDate(day) && day >= from && day <= to;
}

function community(ws, period) {
  const triage = readJson(join(ws, "inbox", "triage.json"), { entries: [] }).entries ?? [];
  const answered = readJsonl(join(ws, "inbox", "answered.jsonl"));
  const published = readJsonl(join(ws, "published.jsonl"));
  const received = triage.filter((e) => inPeriod(e.createdAt, period.from, period.to));
  const byCategory = {};
  for (const e of received) byCategory[e.category ?? "other"] = (byCategory[e.category ?? "other"] ?? 0) + 1;
  const byId = new Map(triage.map((e) => [e.id, e]));
  const answers = answered.filter((a) => inPeriod(a.answeredAt, period.from, period.to));
  const delays = answers
    .map((a) => {
      const entry = byId.get(a.entryId);
      if (!entry?.createdAt) return null;
      const hours = (new Date(a.answeredAt) - new Date(entry.createdAt)) / 3600000;
      return Number.isNaN(hours) || hours < 0 ? null : hours;
    })
    .filter((h) => h !== null);
  const medianHours = median(delays);
  const posts = {};
  for (const p of published.filter((l) => inPeriod(l.publishedAt, period.from, period.to))) posts[p.network] = (posts[p.network] ?? 0) + 1;

  const parts = [];
  parts.push(`- Comments and messages received: **${received.length}**${received.length ? ` — ${Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(", ")}` : ""}`);
  parts.push(`- Answered: **${answers.length}**${medianHours === null ? "" : `, median delay ${num(medianHours, 1)} h`}`);
  const postsTotal = Object.values(posts).reduce((a, b) => a + b, 0);
  parts.push(`- Posts published: **${postsTotal}**${postsTotal ? ` — ${Object.entries(posts).sort().map(([n, c]) => `${label(n)} ${c}`).join(", ")}` : ""}`);
  return {
    md: parts.join("\n"),
    figures: { comments: received.length, byCategory, answered: answers.length, medianAnswerHours: medianHours === null ? null : Math.round(medianHours * 10) / 10, postsPublished: postsTotal, postsByNetwork: posts },
  };
}

/* ------------------------------------------------------------------- main */

function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in values ? values[key] : m));
}

export function buildReport(ws, period) {
  const issues = [];
  const template = readText(join(SKILL_ROOT, "assets", "report.md"));
  const digestPath = join(ws, "stats", "digest.json");
  const digest = existsSync(digestPath) ? readJson(digestPath) : null;
  if (!digest) issues.push("stats/digest.json missing: no figures collected");
  else if (digest.period && (digest.period.from !== period.from || digest.period.to !== period.to)) {
    issues.push(`stats/digest.json covers ${digest.period.from} → ${digest.period.to}, not ${period.from} → ${period.to}`);
  }
  const networkIds = digest ? Object.keys(digest.networks ?? {}) : loadAccounts(ws).accounts.map((a) => a.network);
  const comm = community(ws, period);
  const values = {
    period: period.label,
    generatedAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
    networks: networkIds.length ? [...new Set(networkIds)].map(label).join(", ") : "no network",
    keyFigures: digest ? keyFigures(digest) : NO_FIGURES,
    byNetwork: digest ? byNetwork(digest) : NO_FIGURES,
    topPosts: digest ? topPosts(digest) : NO_FIGURES,
    bestSlots: digest ? bestSlots(digest) : NO_FIGURES,
    community: comm.md,
  };
  const text = fill(template, values);
  const path = join(ws, "reports", `${period.label}.md`);
  writeText(path, text);
  const total = digest?.total ?? {};
  const figures = {
    followers: total.followers ?? null, impressions: total.impressions ?? null, engagements: total.engagements ?? null,
    engagementRate: total.engagementRate ?? null, posts: total.posts ?? null, ...comm.figures,
  };
  return { path, period: period.label, from: period.from, to: period.to, figures, issues, md: text };
}

function main() {
  const { command, flags } = parseArgs();
  if (flags.help || command) usage(USAGE);
  const ws = requireWorkspace(flags);
  const result = buildReport(ws, periodOf(flags));
  out(result, flags);
  process.exit(result.issues.length ? EXIT_ISSUES : EXIT_OK);
}

if (isMain(import.meta.url)) main();
