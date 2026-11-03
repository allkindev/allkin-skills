/**
 * Tests of the inbox and stats scripts: the adapters on their sample files, the
 * classification, the ingest / merge / mark cycle, the stats ingest and digest.
 * Run from the skill folder: node --test tests/inbox-stats.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { adapterFor, networkOfFile, ADAPTED_NETWORKS } from "../scripts/networks/index.mjs";
import { classify } from "../scripts/inbox_triage.mjs";
import { periodOf } from "../scripts/stats_digest.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SAMPLES = join(ROOT, "references", "samples");
const readSample = (name) => JSON.parse(readFileSync(join(SAMPLES, name), "utf-8"));
const RULES = JSON.parse(readFileSync(join(ROOT, "assets", "workspace", "rules.json"), "utf-8"));

function run(script, args, workspace) {
  const r = spawnSync(process.execPath, [join(ROOT, "scripts", script), ...args, "--workspace", workspace], { encoding: "utf-8" });
  let json = null;
  try {
    json = JSON.parse(r.stdout.trim().split("\n").pop());
  } catch {
    /* Markdown or usage */
  }
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

function makeWorkspace() {
  const dir = mkdtempSync(join(tmpdir(), "cm-test-"));
  cpSync(join(ROOT, "assets", "workspace"), dir, { recursive: true });
  mkdirSync(join(dir, "inbox", "raw"), { recursive: true });
  mkdirSync(join(dir, "stats", "raw"), { recursive: true });
  return dir;
}

/* ------------------------------------------------------------ adapters */

describe("adapters", () => {
  test("networkOfFile reads the prefix", () => {
    assert.equal(networkOfFile("x-mentions-2026-11-01.json"), "x");
    assert.equal(networkOfFile("/a/b/facebook-page-1.json"), "facebook");
    assert.equal(networkOfFile("instagram.json"), "instagram");
    assert.equal(adapterFor("tiktok"), null);
    assert.equal(adapterFor("nope"), null);
  });

  for (const network of ADAPTED_NETWORKS) {
    test(`${network}: comments sample → inbox entries`, () => {
      const adapter = adapterFor(network);
      const entries = adapter.comments(readSample(`${network}-comments.json`), { accountId: "123" });
      assert.equal(entries.length, 2, `${network} keeps two entries (the empty or irrelevant ones skipped)`);
      for (const e of entries) {
        assert.ok(e.id.startsWith(`${network}:`), `id prefixed: ${e.id}`);
        assert.equal(e.network, network);
        assert.ok(["comment", "mention", "reply", "message"].includes(e.kind));
        assert.ok(typeof e.text === "string" && e.text.length > 0);
        assert.ok(e.author && (e.author.name || e.author.handle || e.author.id), "an author");
        assert.ok(e.createdAt === null || /^\d{4}-\d{2}-\d{2}T/.test(e.createdAt));
        assert.ok("url" in e && "parentPostId" in e);
        assert.equal(e.category, undefined);
        assert.equal(e.state, undefined);
      }
      if (network !== "instagram") assert.ok(entries.every((e) => typeof e.url === "string" && e.url.startsWith("https://")), "urls");
    });

    test(`${network}: metrics sample → account and posts`, () => {
      const adapter = adapterFor(network);
      const m = adapter.metrics(readSample(`${network}-metrics.json`));
      assert.ok(m.account, "an account");
      assert.equal(typeof m.account.followers, "number");
      for (const key of ["impressions", "engagements", "clicks", "videoViews", "posts"]) assert.ok(key in m.account);
      assert.equal(m.posts.length, 2);
      for (const p of m.posts) {
        assert.ok(p.postId);
        assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(p.publishedAt));
        assert.ok(typeof p.url === "string");
        assert.equal(typeof p.engagements, "number");
        for (const key of ["impressions", "likes", "comments", "shares", "clicks", "videoViews"]) assert.ok(key in p);
      }
    });
  }

  test("x: mentions tell a comment from a mention, urls use the username", () => {
    const entries = adapterFor("x").comments(readSample("x-comments.json"), { accountId: "123" });
    assert.equal(entries[0].kind, "comment");
    assert.equal(entries[0].parentPostId, "1787990000000000000");
    assert.equal(entries[0].url, "https://x.com/marion_sample/status/1788001000000000001");
    assert.equal(entries[1].kind, "mention");
    const other = adapterFor("x").comments(readSample("x-comments.json"), { accountId: "999" });
    assert.equal(other[0].kind, "mention", "a reply to someone else is a mention");
  });

  test("mastodon: HTML stripped, favourites left out, handle from acct", () => {
    const entries = adapterFor("mastodon").comments(readSample("mastodon-comments.json"));
    assert.equal(entries.length, 2);
    assert.ok(!entries[0].text.includes("<"));
    assert.ok(entries[0].text.includes("vieux Mac ?"), entries[0].text);
    assert.equal(entries[0].author.handle, "@pauline_sample@sample.social");
    assert.equal(entries[1].text, "Switched to @exampleshop last month & no regrets.");
  });

  test("bluesky: likes left out, url from handle and rkey", () => {
    const entries = adapterFor("bluesky").comments(readSample("bluesky-comments.json"));
    assert.equal(entries.length, 2);
    assert.equal(entries[0].url, "https://bsky.app/profile/reader-sample.bsky.social/post/3ksampleaaa01");
    assert.equal(entries[0].kind, "comment");
    assert.equal(entries[1].kind, "mention");
  });

  test("youtube: no impressions → null, views in videoViews", () => {
    const m = adapterFor("youtube").metrics(readSample("youtube-metrics.json"));
    assert.equal(m.posts[0].impressions, null);
    assert.equal(m.posts[0].videoViews, 9400);
    assert.equal(m.posts[0].engagements, 351);
    assert.equal(m.account.videoViews, 182000);
  });

  test("meta: facebook page insights, instagram saves counted in", () => {
    const fb = adapterFor("facebook").metrics(readSample("facebook-metrics.json"));
    assert.equal(fb.account.followers, 2300);
    assert.equal(fb.account.impressions, 31000);
    assert.equal(fb.posts[0].engagements, 140 + 18 + 22);
    const ig = adapterFor("instagram").metrics(readSample("instagram-metrics.json"));
    assert.equal(ig.posts[0].engagements, 210 + 14 + 35);
    assert.equal(ig.posts[1].impressions, 2800, "reach stands in when impressions are missing");
    const th = adapterFor("threads").metrics(readSample("threads-metrics.json"));
    assert.equal(th.account.followers, 640);
    assert.equal(th.posts[0].shares, 11);
  });

  test("an adapter never throws on junk", () => {
    for (const network of ADAPTED_NETWORKS) {
      const a = adapterFor(network);
      for (const junk of [null, {}, [], { data: [{}] }, { data: "x" }, { items: [null] }, { elements: [{}] }, { notifications: [{ reason: "reply" }] }]) {
        assert.deepEqual(a.comments(junk), []);
        const m = a.metrics(junk);
        assert.ok(m && Array.isArray(m.posts));
      }
    }
  });
});

/* ------------------------------------------------------------ classify */

describe("classify", () => {
  const e = (text, kind = "comment") => ({ text, kind });
  const cat = (text, kind, rules = RULES, repeats = 1) => classify(e(text, kind), rules, repeats);

  test("urgent beats complaint beats question beats lead beats praise", () => {
    assert.equal(cat("C'est une ARNAQUE, je suis déçu, pourquoi ?").category, "urgent");
    assert.equal(cat("Déçu du produit, quel est le prix du retour ?").category, "complaint");
    assert.equal(cat("Quel est le prix ? Merci !").category, "question");
    assert.equal(cat("Je veux commander, merci").category, "lead");
    assert.equal(cat("Merci, c'est génial").category, "praise");
    assert.equal(cat("Thanks but it is not working").category, "complaint", "praise needs no complaint signal");
  });

  test("accents and case are folded, words are whole", () => {
    const r = cat("FRAUDE manifeste");
    assert.equal(r.category, "urgent");
    assert.ok(r.signals.includes("alert:fraude"));
    assert.equal(cat("La presse en parle").category, "urgent");
    assert.equal(cat("Impressed by the scamper").category, "other", "'scam' inside 'scamper' does not fire");
    assert.equal(cat("Decu de la livraison").category, "complaint");
  });

  test("question by mark or by first word", () => {
    assert.equal(cat("Comment installer la version 3").category, "question");
    assert.ok(cat("Comment installer la version 3").signals.includes("question-word"));
    assert.equal(cat("@shop how do I update").category, "question", "a leading mention is skipped");
    assert.equal(cat("Est-ce disponible").category, "question");
    assert.equal(cat("Nice photo").category, "other");
  });

  test("spam: signs, three URLs, repeated text", () => {
    assert.equal(cat("Earn money fast, DM me").category, "spam");
    const urls = cat("see https://a.example https://b.example https://c.example");
    assert.equal(urls.category, "spam");
    assert.ok(urls.signals.includes("spam:urls"));
    assert.equal(cat("see https://a.example https://b.example").category, "other");
    assert.equal(cat("Nice photo", "comment", RULES, 3).category, "spam");
    assert.equal(cat("Nice photo", "comment", RULES, 2).category, "other");
  });

  test("abuse only from abuseWords; shouting is a signal alone", () => {
    const shouting = cat("THIS IS ABSOLUTELY UNBELIEVABLE AND TERRIBLE!!!");
    assert.ok(shouting.signals.includes("shouting"));
    assert.notEqual(shouting.category, "abuse");
    const rules = { ...RULES, abuseWords: ["idiot"] };
    assert.equal(cat("you idiot", "comment", rules).category, "abuse");
    assert.equal(cat("you idiot", "comment", rules).priority, 8);
  });

  test("mention only when nothing else, priority from rules", () => {
    const m = cat("Switched to that shop last month", "mention");
    assert.equal(m.category, "mention");
    assert.equal(m.priority, 4);
    assert.equal(cat("Switched to that shop last month", "comment").category, "other");
    assert.equal(cat("Scam alert", "mention").priority, 1);
    assert.equal(cat("Je suis déçu", "comment", { ...RULES, complaintWords: ["bof"] }).category, "other", "complaintWords of rules.json override");
  });
});

/* ---------------------------------------------------------- inbox cycle */

describe("inbox_triage on a workspace", () => {
  const ws = makeWorkspace();
  const raw = join(ws, "inbox", "raw");

  test("ingest classifies, dedups across files, flags an unknown prefix", () => {
    const sample = readSample("x-comments.json");
    writeFileSync(join(raw, "x-mentions-1.json"), JSON.stringify(sample));
    writeFileSync(join(raw, "x-mentions-2.json"), JSON.stringify(sample));
    writeFileSync(join(raw, "facebook-post.json"), readFileSync(join(SAMPLES, "facebook-comments.json")));
    writeFileSync(join(raw, "pinterest-x.json"), "{}");
    const r = run("inbox_triage.mjs", ["ingest"], ws);
    assert.equal(r.code, 1, "an unknown prefix is an issue");
    assert.equal(r.json.new, 4);
    assert.equal(r.json.total, 4);
    assert.equal(r.json.issues.length, 1);
    assert.equal(r.json.issues[0].code, "unknown-network");
    assert.deepEqual(r.json.urgent, []);
    rmSync(join(raw, "pinterest-x.json"));
    const again = run("inbox_triage.mjs", ["ingest"], ws);
    assert.equal(again.code, 0);
    assert.equal(again.json.new, 0);
    assert.equal(again.json.total, 4);
  });

  test("list, show, suggest, mark keep working together", () => {
    const list = run("inbox_triage.mjs", ["list", "--category", "question"], ws);
    assert.equal(list.code, 0);
    assert.equal(list.json.count, 2);
    const id = "facebook:400500600_700";
    assert.equal(run("inbox_triage.mjs", ["show", id], ws).json.category, "question");
    assert.equal(run("inbox_triage.mjs", ["show", "nope:1"], ws).code, 2);
    assert.equal(run("inbox_triage.mjs", ["suggest", id, "--answer", "49 € per year."], ws).json.suggestedAnswer, "49 € per year.");
    const mark = run("inbox_triage.mjs", ["mark", id, "x:1788001000000000002", "answered", "--post-id", "777"], ws);
    assert.equal(mark.code, 0);
    assert.equal(mark.json.marked.length, 2);
    const answered = readFileSync(join(ws, "inbox", "answered.jsonl"), "utf-8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(answered.length, 2);
    assert.equal(answered[0].entryId, id);
    assert.equal(answered[0].answer, "49 € per year.", "the suggested answer is what was sent when --answer is absent");
    assert.equal(answered[0].postId, "777");
    assert.equal(run("inbox_triage.mjs", ["mark", "x:1788001000000000001", "ignored"], ws).code, 0);
    assert.equal(run("inbox_triage.mjs", ["mark", "x:nope", "ignored"], ws).code, 1);
    const md = run("inbox_triage.mjs", ["list", "--todo", "--md"], ws);
    assert.ok(md.stdout.startsWith("| id |"));
    assert.equal(md.stdout.trim().split("\n").length, 3, "one entry still to do");
  });

  test("re-ingest keeps state, suggestedAnswer and answeredAt; urgent gives exit 1", () => {
    const urgentRaw = {
      data: [{ id: "555", text: "This is a scam, I called my lawyer", author_id: "u5", created_at: "2026-11-01T12:00:00.000Z" }],
      includes: { users: [{ id: "u5", name: "Angry Sample", username: "angry_sample" }] },
    };
    writeFileSync(join(raw, "x-mentions-3.json"), JSON.stringify(urgentRaw));
    const r = run("inbox_triage.mjs", ["ingest"], ws);
    assert.equal(r.code, 1);
    assert.deepEqual(r.json.urgent, ["x:555"]);
    assert.equal(r.json.new, 1);
    const triage = JSON.parse(readFileSync(join(ws, "inbox", "triage.json"), "utf-8"));
    const fb = triage.entries.find((e) => e.id === "facebook:400500600_700");
    assert.equal(fb.state, "answered");
    assert.equal(fb.suggestedAnswer, "49 € per year.");
    assert.ok(fb.answeredAt);
    assert.equal(triage.entries.find((e) => e.id === "x:1788001000000000001").state, "ignored");
    assert.equal(triage.entries[0].id, "x:555", "urgent first");
    assert.ok(triage.entries[0].signals.includes("alert:scam") && triage.entries[0].signals.includes("alert:lawyer"));
    const u = run("inbox_triage.mjs", ["urgent"], ws);
    assert.equal(u.code, 1);
    assert.equal(u.json.count, 1);
    run("inbox_triage.mjs", ["mark", "x:555", "answered", "--answer", "We are looking into it."], ws);
    assert.equal(run("inbox_triage.mjs", ["urgent"], ws).code, 0);
    assert.equal(run("inbox_triage.mjs", ["ingest"], ws).code, 0);
  });

  test("--since drops older entries; stats counts and median delay", () => {
    const ws2 = makeWorkspace();
    writeFileSync(join(ws2, "inbox", "raw", "x-a.json"), JSON.stringify(readSample("x-comments.json")));
    const r = run("inbox_triage.mjs", ["ingest", "--since", "2026-11-01"], ws2);
    assert.equal(r.json.new, 2);
    const r2 = run("inbox_triage.mjs", ["ingest", "--since", "2026-12-01"], makeWorkspaceWith("x-a.json", readSample("x-comments.json")));
    assert.equal(r2.json.new, 0);
    const s = run("inbox_triage.mjs", ["stats"], ws);
    assert.equal(s.code, 0);
    assert.equal(s.json.total, 5);
    assert.equal(s.json.answered, 3);
    assert.equal(s.json.byState.ignored, 1);
    assert.equal(typeof s.json.medianAnswerDelayHours, "number");
    const out = run("inbox_triage.mjs", ["stats", "--from", "2030-01-01"], ws);
    assert.equal(out.json.total, 0);
    assert.equal(out.json.medianAnswerDelayHours, null);
    assert.ok(run("inbox_triage.mjs", ["stats", "--md"], ws).stdout.startsWith("**Inbox**"));
  });

  test("--help and a bad command exit 2", () => {
    assert.equal(run("inbox_triage.mjs", ["--help"], ws).code, 2);
    assert.equal(run("inbox_triage.mjs", ["nope"], ws).code, 2);
    assert.equal(run("inbox_triage.mjs", ["mark", "x:1"], ws).code, 2);
  });
});

function makeWorkspaceWith(name, json) {
  const ws = makeWorkspace();
  writeFileSync(join(ws, "inbox", "raw", name), JSON.stringify(json));
  return ws;
}

/* ---------------------------------------------------------------- stats */

function xMetrics(followers, posts) {
  return {
    user: { data: { id: "123", username: "shop", public_metrics: { followers_count: followers, tweet_count: 500 } } },
    tweets: { data: posts.map((p) => ({ id: p.id, text: p.text, created_at: p.at, public_metrics: { like_count: p.likes, reply_count: p.replies ?? 0, retweet_count: p.rts ?? 0, quote_count: 0, impression_count: p.imp } })) },
  };
}

describe("stats_digest", () => {
  test("periodOf: a month and its previous month, a range and the same length before", () => {
    assert.deepEqual(periodOf({ period: "2026-10" }), { from: "2026-10-01", to: "2026-10-31", previous: { from: "2026-09-01", to: "2026-09-30" } });
    assert.deepEqual(periodOf({ period: "2026-01" }).previous, { from: "2025-12-01", to: "2025-12-31" });
    assert.deepEqual(periodOf({ from: "2026-10-05", to: "2026-10-11" }).previous, { from: "2026-09-28", to: "2026-10-04" });
  });

  const ws = makeWorkspace();
  const raw = join(ws, "stats", "raw");

  test("ingest appends one line per file, skips a file already ingested", () => {
    const sept = xMetrics(1150, [
      { id: "s1", text: "September post", at: "2026-09-10T07:30:00Z", likes: 50, replies: 10, rts: 10, imp: 3500 },
    ]);
    const oct = xMetrics(1200, [
      { id: "s1", text: "September post", at: "2026-09-10T07:30:00Z", likes: 55, replies: 10, rts: 10, imp: 3600 },
      { id: "o1", text: "Launch", at: "2026-10-06T07:05:00Z", likes: 200, replies: 40, rts: 80, imp: 9000 },
      { id: "o2", text: "Tuesday morning too", at: "2026-10-13T07:40:00Z", likes: 60, replies: 10, rts: 20, imp: 4000 },
      { id: "o3", text: "Friday", at: "2026-10-16T16:00:00Z", likes: 20, replies: 0, rts: 0, imp: 2000 },
    ]);
    writeFileSync(join(raw, "x-2026-09-30.json"), JSON.stringify(sept));
    const a = run("stats_digest.mjs", ["ingest", "--collected-at", "2026-09-30T18:00:00Z"], ws);
    assert.equal(a.code, 0);
    assert.equal(a.json.ingested, 1);
    writeFileSync(join(raw, "x-2026-10-31.json"), JSON.stringify(oct));
    writeFileSync(join(raw, "mastodon-2026-10-31.json"), readFileSync(join(SAMPLES, "mastodon-metrics.json")));
    writeFileSync(join(raw, "tiktok-2026-10-31.json"), "{}");
    const b = run("stats_digest.mjs", ["ingest", "--collected-at", "2026-10-31T18:00:00Z"], ws);
    assert.equal(b.code, 1, "tiktok has no adapter → issue");
    assert.equal(b.json.ingested, 2);
    assert.equal(b.json.skipped, 1);
    assert.equal(b.json.issues[0].code, "unknown-network");
    const lines = readFileSync(join(ws, "stats", "x.jsonl"), "utf-8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(lines.length, 2);
    assert.equal(lines[0].collectedAt, "2026-09-30T18:00:00.000Z");
    assert.equal(lines[1].account.followers, 1200);
    assert.equal(lines[1].posts.length, 4);
    assert.equal(lines[1].posts[1].engagements, 320);
    assert.ok(existsSync(join(ws, "stats", ".ingested.json")));
  });

  test("digest: deltas, engagement rate, top posts, best slot, nulls", () => {
    writeFileSync(join(ws, "published.jsonl"), [
      JSON.stringify({ id: "pub-1", network: "x", postId: "o1", theme: "product", publishedAt: "2026-10-06T07:05:00Z" }),
      JSON.stringify({ id: "pub-2", network: "x", postId: "o2", theme: "product", publishedAt: "2026-10-13T07:40:00Z" }),
      JSON.stringify({ id: "pub-3", network: "x", postId: "o3", theme: "team", publishedAt: "2026-10-16T16:00:00Z" }),
    ].join("\n") + "\n");
    const r = run("stats_digest.mjs", ["digest", "--period", "2026-10"], ws);
    assert.equal(r.code, 0, r.stderr);
    const d = r.json;
    assert.deepEqual(d.period, { from: "2026-10-01", to: "2026-10-31" });
    assert.deepEqual(d.previous, { from: "2026-09-01", to: "2026-09-30" });
    const x = d.networks.x;
    assert.deepEqual(x.followers, { now: 1200, before: 1150, delta: 50, deltaPct: 4.35 });
    // impressions and engagements of the account are summed from the posts the adapter saw
    assert.equal(x.impressions.now, 3600 + 9000 + 4000 + 2000);
    assert.equal(x.impressions.before, 3500);
    assert.equal(x.engagements.now, 75 + 320 + 90 + 20);
    assert.equal(x.engagementRate.now, Math.round((505 / 18600) * 10000) / 100);
    assert.equal(x.engagementRate.before, 2);
    assert.deepEqual(x.clicks, { now: null, before: null, delta: null, deltaPct: null });
    assert.equal(x.posts, 3, "only the posts published in October");
    const m = d.networks.mastodon;
    assert.equal(m.followers.now, 860);
    assert.equal(m.followers.before, null);
    assert.equal(m.followers.delta, null);
    assert.equal(m.impressions.now, null);
    assert.equal(m.engagementRate.now, null);
    assert.equal(m.posts, 2);
    assert.equal(d.total.followers, 2060);
    assert.equal(d.total.impressions, 18600);
    assert.equal(d.total.posts, 5);
    // top posts: by engagements, mastodon's without a rate
    assert.equal(d.topPosts[0].postId, "o1");
    assert.equal(d.topPosts[0].engagementRate, 3.56);
    assert.equal(d.topPosts.length, 5);
    assert.ok(d.topPosts.some((p) => p.network === "mastodon" && p.engagementRate === null));
    // best slot: o1 and o2 are both Tuesday 09:xx in Europe/Paris (07 UTC in summer time)
    assert.equal(d.timezone, "Europe/Paris");
    assert.deepEqual(d.bestSlots, [{ weekday: 2, hour: 9, posts: 2, avgEngagementRate: Math.round(((3.56 + 2.25) / 2) * 100) / 100 }]);
    assert.deepEqual(d.themes, [
      { theme: "product", posts: 2, avgEngagementRate: Math.round(((3.56 + 2.25) / 2) * 100) / 100 },
      { theme: "team", posts: 1, avgEngagementRate: 1 },
    ]);
    const written = JSON.parse(readFileSync(join(ws, "stats", "digest.json"), "utf-8"));
    assert.equal(written.networks.x.followers.delta, 50);
    const md = run("stats_digest.mjs", ["digest", "--period", "2026-10", "--md"], ws);
    assert.ok(md.stdout.includes("| followers | 1200 | 1150 | +50 (+4.35 %) |"), md.stdout);
    assert.ok(md.stdout.includes("### Best slots"));
    assert.ok(md.stdout.includes("| Tuesday | 09:00 | 2 |"));
  });

  test("digest on a range, and --help", () => {
    // The October collection (the 31st) is the "now" of this range; the September one (the 30th) falls in the previous range.
    const r = run("stats_digest.mjs", ["digest", "--from", "2026-10-16", "--to", "2026-10-31"], ws);
    assert.equal(r.code, 0);
    assert.deepEqual(r.json.previous, { from: "2026-09-30", to: "2026-10-15" });
    assert.equal(r.json.networks.x.followers.before, 1150);
    assert.equal(r.json.networks.x.posts, 1, "only o3 was published in the range");
    assert.deepEqual(r.json.bestSlots, [], "one post per slot in the range");
    const none = run("stats_digest.mjs", ["digest", "--from", "2026-10-01", "--to", "2026-10-15"], ws);
    assert.equal(none.json.networks.x.followers.now, null, "no collection inside the range");
    assert.equal(run("stats_digest.mjs", ["--help"], ws).code, 2);
    assert.equal(run("stats_digest.mjs", ["digest"], ws).code, 2);
    assert.equal(run("stats_digest.mjs", ["digest", "--period", "2026-13"], ws).code, 2);
  });
});
