#!/usr/bin/env node
/**
 * stats_digest — the figures of the networks: raw API answers saved in `stats/raw/` become
 * one line per collection in `stats/<network>.jsonl`, then a digest of a period.
 *
 * Usage:
 *   node scripts/stats_digest.mjs ingest [--collected-at ISO]
 *       Reads every stats/raw/*.json (the file prefix picks the network adapter) and appends
 *       one line per file to stats/<network>.jsonl, collectedAt = --collected-at or the file's
 *       modification time. A file already ingested (same name and size, stats/.ingested.json)
 *       is skipped. Exit 1 when a file could not be read.
 *   node scripts/stats_digest.mjs digest --period YYYY-MM [--md]
 *   node scripts/stats_digest.mjs digest --from YYYY-MM-DD --to YYYY-MM-DD [--md]
 *       Writes stats/digest.json: per network, "now" is the last collection of the period and
 *       "before" the last of the previous period (the previous month for --period, else a
 *       period of the same length ending the day before --from); engagementRate =
 *       engagements / impressions × 100; topPosts (5) from the posts published in the period
 *       (dedup by postId, the latest collection wins); bestSlots (5) by weekday × hour of
 *       publication in accounts.json's timezone, slots with at least 2 posts, by average
 *       engagement rate; themes by joining published.jsonl on postId. A figure a network does
 *       not give is null.
 *   Common: --workspace <dir>, --help.
 */
import { readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import {
  EXIT_ISSUES, EXIT_OK, addDays, appendJsonl, fail, isMain, isoDate, listFiles, loadAccounts, localParts, mdTable, out, parseArgs, readJson,
  readJsonl, requireWorkspace, usage, weekdayName, writeJson,
} from "./lib/common.mjs";
import { adapterFor, networkOfFile } from "./networks/index.mjs";

const USAGE = `
Usage: node scripts/stats_digest.mjs <command> [options]
  ingest [--collected-at ISO]
  digest --period YYYY-MM [--md]
  digest --from YYYY-MM-DD --to YYYY-MM-DD [--md]
Options: --workspace <dir> (default: community, or $COMMUNITY_WORKSPACE)
`;

const ACCOUNT_KEYS = ["followers", "impressions", "engagements", "clicks", "videoViews"];

function paths(dir) {
  return {
    raw: join(dir, "stats", "raw"),
    stats: join(dir, "stats"),
    ingested: join(dir, "stats", ".ingested.json"),
    digest: join(dir, "stats", "digest.json"),
    published: join(dir, "published.jsonl"),
  };
}

/* -------------------------------------------------------------- ingest */

function ingest(dir, flags) {
  const p = paths(dir);
  const ledger = readJson(p.ingested, { ingested: [] });
  if (!Array.isArray(ledger.ingested)) ledger.ingested = [];
  const seen = new Set(ledger.ingested.map((i) => `${i.file}:${i.size}`));
  const issues = [];
  const files = listFiles(p.raw, (n) => n.endsWith(".json"));
  const byNetwork = {};
  let ingested = 0;
  let skipped = 0;
  const forced = flags["collected-at"] && flags["collected-at"] !== true ? new Date(String(flags["collected-at"])) : null;
  if (forced && Number.isNaN(forced.getTime())) fail(`Not a date: ${flags["collected-at"]}`);

  for (const file of files) {
    const name = basename(file);
    const size = statSync(file).size;
    if (seen.has(`${name}:${size}`)) {
      skipped++;
      continue;
    }
    const network = networkOfFile(name);
    const adapter = adapterFor(network);
    if (!adapter) {
      issues.push({ code: "unknown-network", file: name, network });
      continue;
    }
    let json;
    try {
      json = JSON.parse(readFileSync(file, "utf-8"));
    } catch (error) {
      issues.push({ code: "bad-json", file: name, message: error.message });
      continue;
    }
    let metrics;
    try {
      metrics = adapter.metrics(json);
    } catch (error) {
      issues.push({ code: "adapter-failed", file: name, message: error.message });
      continue;
    }
    if (!metrics || (metrics.account === null && !metrics.posts?.length)) {
      issues.push({ code: "no-figures", file: name, network });
      continue;
    }
    const collectedAt = (forced ?? statSync(file).mtime).toISOString();
    appendJsonl(join(p.stats, `${network}.jsonl`), { network, collectedAt, account: metrics.account, posts: metrics.posts ?? [] });
    ledger.ingested.push({ file: name, size, network, collectedAt });
    byNetwork[network] = (byNetwork[network] ?? 0) + 1;
    ingested++;
  }
  writeJson(p.ingested, ledger);
  out({ ingested, skipped, files: files.length, byNetwork, issues }, flags);
  process.exit(issues.length ? EXIT_ISSUES : EXIT_OK);
}

/* -------------------------------------------------------------- digest */

function round2(n) {
  return n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 100) / 100;
}

function rate(engagements, impressions) {
  if (typeof engagements !== "number" || typeof impressions !== "number" || impressions <= 0) return null;
  return round2((engagements / impressions) * 100);
}

function delta(now, before) {
  if (typeof now !== "number" || typeof before !== "number") return { now: now ?? null, before: before ?? null, delta: null, deltaPct: null };
  const d = now - before;
  return { now, before, delta: d, deltaPct: before === 0 ? null : round2((d / before) * 100) };
}

/** { from, to, previous: { from, to } } from --period or --from/--to. */
export function periodOf(flags) {
  if (flags.period && flags.period !== true) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(flags.period));
    if (!m) fail(`--period wants YYYY-MM, got ${flags.period}`);
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (mo < 1 || mo > 12) fail(`--period wants YYYY-MM, got ${flags.period}`);
    const first = (yy, mm) => `${yy}-${String(mm).padStart(2, "0")}-01`;
    const last = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10);
    const py = mo === 1 ? y - 1 : y;
    const pm = mo === 1 ? 12 : mo - 1;
    return { from: first(y, mo), to: last(y, mo), previous: { from: first(py, pm), to: last(py, pm) } };
  }
  if (!flags.from || !flags.to || flags.from === true || flags.to === true) usage(USAGE);
  const from = isoDate(flags.from);
  const to = isoDate(flags.to);
  if (to < from) fail(`--to ${to} is before --from ${from}`);
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const prevTo = addDays(from, -1);
  return { from, to, previous: { from: addDays(prevTo, -(days - 1)), to: prevTo } };
}

function inPeriod(iso, period) {
  if (!iso) return false;
  const d = String(iso).slice(0, 10);
  return d >= period.from && d <= period.to;
}

function lastOf(collections) {
  return collections.length ? collections[collections.length - 1] : null;
}

function readCollections(dir, network) {
  return readJsonl(join(paths(dir).stats, `${network}.jsonl`))
    .filter((c) => c && c.collectedAt)
    .sort((a, b) => String(a.collectedAt).localeCompare(String(b.collectedAt)));
}

function networksWithStats(dir) {
  return listFiles(paths(dir).stats, (n) => n.endsWith(".jsonl")).map((f) => basename(f, ".jsonl"));
}

export function buildDigest(dir, period, options = {}) {
  const accounts = loadAccounts(dir);
  const timeZone = options.timeZone ?? accounts.timezone ?? "UTC";
  const published = readJsonl(paths(dir).published);
  const themeOf = new Map(published.filter((p) => p?.postId).map((p) => [`${p.network}:${p.postId}`, p.theme ?? null]));

  const networks = {};
  const allPosts = [];
  const totals = { followers: null, impressions: null, engagements: null, posts: 0 };
  const add = (key, v) => {
    if (typeof v === "number") totals[key] = (totals[key] ?? 0) + v;
  };

  for (const network of networksWithStats(dir)) {
    const collections = readCollections(dir, network);
    const current = collections.filter((c) => inPeriod(c.collectedAt, period));
    const prior = collections.filter((c) => inPeriod(c.collectedAt, period.previous));
    if (!current.length && !prior.length) continue;
    const now = lastOf(current)?.account ?? {};
    const before = lastOf(prior)?.account ?? {};

    // The posts published in the period, the latest collection's figures winning.
    const posts = new Map();
    for (const c of current) {
      for (const p of c.posts ?? []) {
        if (p?.postId && inPeriod(p.publishedAt, period)) posts.set(p.postId, { ...p, network });
      }
    }
    const postList = [...posts.values()];
    allPosts.push(...postList);

    const entry = {};
    for (const key of ["followers", "impressions", "engagements"]) entry[key] = delta(now[key] ?? null, before[key] ?? null);
    entry.engagementRate = { now: rate(now.engagements, now.impressions), before: rate(before.engagements, before.impressions) };
    entry.clicks = delta(now.clicks ?? null, before.clicks ?? null);
    entry.videoViews = delta(now.videoViews ?? null, before.videoViews ?? null);
    entry.posts = postList.length;
    entry.collections = { now: lastOf(current)?.collectedAt ?? null, before: lastOf(prior)?.collectedAt ?? null };
    networks[network] = entry;

    for (const key of ["followers", "impressions", "engagements"]) add(key, now[key] ?? null);
    totals.posts += postList.length;
  }

  const withRate = allPosts.map((p) => ({ ...p, engagementRate: rate(p.engagements, p.impressions) }));
  const topPosts = [...withRate]
    .filter((p) => typeof p.engagements === "number")
    .sort((a, b) => b.engagements - a.engagements || (b.engagementRate ?? -1) - (a.engagementRate ?? -1))
    .slice(0, 5)
    .map((p) => ({ network: p.network, postId: p.postId, url: p.url ?? null, excerpt: p.excerpt ?? null, publishedAt: p.publishedAt ?? null, engagements: p.engagements, impressions: p.impressions ?? null, engagementRate: p.engagementRate }));

  const slots = new Map();
  for (const p of withRate) {
    if (p.engagementRate === null) continue;
    const local = localParts(p.publishedAt, timeZone);
    if (!local) continue;
    const key = `${local.weekday}:${local.hour}`;
    const slot = slots.get(key) ?? { weekday: local.weekday, hour: local.hour, posts: 0, sum: 0 };
    slot.posts++;
    slot.sum += p.engagementRate;
    slots.set(key, slot);
  }
  const bestSlots = [...slots.values()]
    .filter((s) => s.posts >= 2)
    .map((s) => ({ weekday: s.weekday, hour: s.hour, posts: s.posts, avgEngagementRate: round2(s.sum / s.posts) }))
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate || b.posts - a.posts)
    .slice(0, 5);

  const themeMap = new Map();
  for (const p of withRate) {
    const theme = themeOf.get(`${p.network}:${p.postId}`);
    if (!theme) continue;
    const t = themeMap.get(theme) ?? { theme, posts: 0, rated: 0, sum: 0 };
    t.posts++;
    if (p.engagementRate !== null) {
      t.rated++;
      t.sum += p.engagementRate;
    }
    themeMap.set(theme, t);
  }
  const themes = [...themeMap.values()]
    .map((t) => ({ theme: t.theme, posts: t.posts, avgEngagementRate: t.rated ? round2(t.sum / t.rated) : null }))
    .sort((a, b) => (b.avgEngagementRate ?? -1) - (a.avgEngagementRate ?? -1) || b.posts - a.posts);

  return {
    generatedAt: new Date().toISOString(),
    period: { from: period.from, to: period.to },
    previous: period.previous,
    timezone: timeZone,
    networks,
    total: { followers: totals.followers, impressions: totals.impressions, engagements: totals.engagements, engagementRate: rate(totals.engagements, totals.impressions), posts: totals.posts },
    topPosts,
    bestSlots,
    themes,
  };
}

function fmt(v) {
  return v === null || v === undefined ? "–" : String(v);
}

/** "+50 (+4.35 %)", "–" when there is nothing to compare. */
function deltaCell(d) {
  if (!d || d.delta === null) return "–";
  const sign = d.delta > 0 ? "+" : "";
  return d.deltaPct === null ? `${sign}${d.delta}` : `${sign}${d.delta} (${sign}${d.deltaPct} %)`;
}

function rateDelta(r) {
  if (r.now === null || r.before === null) return "–";
  const d = round2(r.now - r.before);
  return `${d > 0 ? "+" : ""}${d} pt`;
}

export function digestMarkdown(digest) {
  const lines = [`**Figures** ${digest.period.from} → ${digest.period.to} (compared with ${digest.previous.from} → ${digest.previous.to})`, ""];
  for (const [network, n] of Object.entries(digest.networks)) {
    lines.push(`### ${network}`, "");
    lines.push(
      mdTable(
        ["figure", "now", "before", "delta"],
        [
          ["followers", fmt(n.followers.now), fmt(n.followers.before), deltaCell(n.followers)],
          ["impressions", fmt(n.impressions.now), fmt(n.impressions.before), deltaCell(n.impressions)],
          ["engagements", fmt(n.engagements.now), fmt(n.engagements.before), deltaCell(n.engagements)],
          ["engagement rate", n.engagementRate.now === null ? "–" : `${n.engagementRate.now} %`, n.engagementRate.before === null ? "–" : `${n.engagementRate.before} %`, rateDelta(n.engagementRate)],
          ["clicks", fmt(n.clicks.now), fmt(n.clicks.before), deltaCell(n.clicks)],
          ["posts", n.posts, "", ""],
        ],
      ),
      "",
    );
  }
  const t = digest.total;
  lines.push(`**Total**: ${fmt(t.followers)} followers, ${fmt(t.impressions)} impressions, ${fmt(t.engagements)} engagements (${t.engagementRate === null ? "–" : `${t.engagementRate} %`}), ${t.posts} posts`, "");
  if (digest.topPosts.length) {
    lines.push("### Top posts", "", mdTable(["network", "post", "engagements", "impressions", "rate %"], digest.topPosts.map((p) => [p.network, p.excerpt ?? p.postId, p.engagements, fmt(p.impressions), fmt(p.engagementRate)])), "");
  }
  if (digest.bestSlots.length) {
    lines.push("### Best slots", "", mdTable(["weekday", "hour", "posts", "avg rate %"], digest.bestSlots.map((s) => [weekdayName(s.weekday), `${String(s.hour).padStart(2, "0")}:00`, s.posts, s.avgEngagementRate])), "");
  }
  if (digest.themes.length) {
    lines.push("### Themes", "", mdTable(["theme", "posts", "avg rate %"], digest.themes.map((t) => [t.theme, t.posts, fmt(t.avgEngagementRate)])), "");
  }
  return lines.join("\n");
}

function digestCommand(dir, flags) {
  const period = periodOf(flags);
  const digest = buildDigest(dir, period);
  writeJson(paths(dir).digest, digest);
  out({ ...digest, md: digestMarkdown(digest) }, flags);
}

/* ---------------------------------------------------------------- main */

if (isMain(import.meta.url)) {
  const { command, flags } = parseArgs();
  if (flags.help || !command) usage(USAGE);
  const dir = requireWorkspace(flags);
  switch (command) {
    case "ingest": ingest(dir, flags); break;
    case "digest": digestCommand(dir, flags); break;
    default: usage(USAGE);
  }
}
