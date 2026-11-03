/**
 * Tests of the calendar and registry scripts: init_workspace, calendar,
 * utm_link, publish_log, report. Run from the skill folder:
 *
 *   node --test tests/calendar-registry.test.mjs
 *
 * Each test family works in its own temporary workspace put in place by
 * init_workspace, so nothing of the skill folder is touched.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { addDays, today, mondayOf } from "../scripts/lib/common.mjs";
import { buildUtmLink } from "../scripts/utm_link.mjs";
import { findDuplicates } from "../scripts/publish_log.mjs";

const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(SKILL, "scripts");

/** Runs a script; returns { code, json, stdout, stderr } without throwing on a non-zero exit. */
function run(script, args, ws) {
  const argv = [join(SCRIPTS, `${script}.mjs`), ...args];
  if (ws) argv.push("--workspace", ws);
  try {
    const stdout = execFileSync(process.execPath, argv, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, stdout, stderr: "", json: parse(stdout) };
  } catch (error) {
    return { code: error.status, stdout: error.stdout ?? "", stderr: error.stderr ?? "", json: parse(error.stdout ?? "") };
  }
}

function parse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function freshWorkspace() {
  const dir = mkdtempSync(join(tmpdir(), "cm-test-"));
  const ws = join(dir, "community");
  const r = run("init_workspace", [], ws);
  assert.equal(r.code, 0, r.stderr);
  return { dir, ws };
}

/* ------------------------------------------------------------ --help */

describe("--help", () => {
  for (const script of ["init_workspace", "calendar", "utm_link", "publish_log", "report"]) {
    test(`${script} --help prints usage and exits 2`, () => {
      const r = run(script, ["--help"]);
      assert.equal(r.code, 2);
      assert.match(r.stderr, /Usage:/);
    });
  }
});

/* ------------------------------------------------------ init_workspace */

describe("init_workspace", () => {
  let dir;
  let ws;
  before(() => ({ dir, ws } = freshWorkspace()));
  after(() => rmSync(dir, { recursive: true, force: true }));

  test("creates the template and the empty folders", () => {
    for (const rel of ["accounts.json", "calendar.json", "rules.json", "line.md", "published.jsonl", "inbox/triage.json", "inbox/answered.jsonl", "watch/keywords.json"]) {
      assert.ok(existsSync(join(ws, rel)), rel);
    }
    for (const folder of ["drafts", "inbox/raw", "stats/raw", "reports"]) assert.ok(existsSync(join(ws, folder)), folder);
  });

  test("never overwrites and reports kept files", () => {
    writeFileSync(join(ws, "line.md"), "# Mine\n");
    const r = run("init_workspace", [], ws);
    assert.equal(r.code, 0);
    assert.ok(r.json.kept.includes("line.md"));
    assert.equal(r.json.created.length, 0);
    assert.equal(readFileSync(join(ws, "line.md"), "utf-8"), "# Mine\n");
  });

  test("--check passes, then lists what is missing or broken", () => {
    assert.equal(run("init_workspace", ["--check"], ws).code, 0);
    rmSync(join(ws, "reports"), { recursive: true });
    writeFileSync(join(ws, "rules.json"), "{ broken");
    const r = run("init_workspace", ["--check"], ws);
    assert.equal(r.code, 1);
    assert.equal(r.json.ok, false);
    assert.ok(r.json.issues.some((i) => i.includes("reports/")));
    assert.ok(r.json.issues.some((i) => i.startsWith("rules.json")));
    assert.ok(!existsSync(join(ws, "reports")), "--check writes nothing");
  });
});

/* ------------------------------------------------------------ calendar */

describe("calendar", () => {
  let dir;
  let ws;
  const d0 = addDays(today(), 2); // a date inside the next 7 days
  const d1 = addDays(today(), 3);
  before(() => {
    ({ dir, ws } = freshWorkspace());
    const accounts = JSON.parse(readFileSync(join(ws, "accounts.json"), "utf-8"));
    accounts.accounts = [
      { network: "x", service: "x", handle: "@allkin", name: "Allkin", id: "1", language: "fr", tier: 1 },
      { network: "linkedin", service: "linkedin", handle: "allkin", name: "Allkin", id: "2", language: "fr", tier: 1 },
      { network: "mastodon", service: "mastodon", handle: "@allkin@mastodon.social", name: "Allkin", id: "3", language: "fr", tier: 0 },
    ];
    writeFileSync(join(ws, "accounts.json"), JSON.stringify(accounts));
  });
  after(() => rmSync(dir, { recursive: true, force: true }));

  test("add builds the id from the date and the title, and refuses a duplicate", () => {
    const r = run("calendar", ["add", "--date", d0, "--time", "09:00", "--networks", "x,linkedin", "--title", "Launch of the autumn offer!", "--theme", "product", "--state", "ready"], ws);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.added.id, `${d0}-launch-of-the-autumn-offer`);
    assert.deepEqual(r.json.added.networks, ["x", "linkedin"]);
    const dup = run("calendar", ["add", "--date", d0, "--networks", "x", "--title", "Launch of the autumn offer"], ws);
    assert.equal(dup.code, 2);
    assert.match(dup.stderr, /already exists/);
  });

  test("add refuses an unknown network, a bad date and a bad state", () => {
    assert.equal(run("calendar", ["add", "--date", d0, "--networks", "myspace", "--title", "x"], ws).code, 2);
    assert.equal(run("calendar", ["add", "--date", "05/11/2026", "--networks", "x", "--title", "x"], ws).code, 2);
    assert.equal(run("calendar", ["add", "--date", d0, "--networks", "x", "--title", "x", "--state", "done"], ws).code, 2);
  });

  test("move changes the date and time and keeps the file sorted", () => {
    run("calendar", ["add", "--id", "early", "--date", d1, "--time", "08:00", "--networks", "x", "--title", "Early"], ws);
    const r = run("calendar", ["move", "early", "--date", d0, "--time", "07:30"], ws);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.moved.date, d0);
    assert.equal(r.json.moved.time, "07:30");
    const data = JSON.parse(readFileSync(join(ws, "calendar.json"), "utf-8"));
    assert.equal(data.entries[0].id, "early");
    assert.equal(run("calendar", ["move", "nope", "--date", d0], ws).code, 2);
  });

  test("set-state validates and takes --action-id for scheduled/published", () => {
    const bad = run("calendar", ["set-state", "early", "flying"], ws);
    assert.equal(bad.code, 2);
    const r = run("calendar", ["set-state", "early", "scheduled", "--action-id", "act-1"], ws);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.entry.state, "scheduled");
    assert.equal(r.json.entry.actionId, "act-1");
    assert.equal(run("calendar", ["set-state", "early", "idea", "--action-id", "x"], ws).code, 2);
  });

  test("set changes fields, show reads one, list filters", () => {
    const r = run("calendar", ["set", "early", "--theme", "news", "--notes", "check the picture", "--draft", "drafts/early"], ws);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(r.json.changed, ["theme", "draft", "notes"]);
    const shown = run("calendar", ["show", "early"], ws);
    assert.equal(shown.json.entry.theme, "news");
    assert.equal(shown.json.entry.draft, "drafts/early");
    const list = run("calendar", ["list", "--network", "linkedin"], ws);
    assert.equal(list.json.count, 1);
    const byState = run("calendar", ["list", "--state", "scheduled"], ws);
    assert.equal(byState.json.entries[0].id, "early");
    assert.equal(run("calendar", ["set", "early"], ws).code, 2, "set needs a field");
  });

  test("holes names the networks of the accounts without a planned post", () => {
    const r = run("calendar", ["holes", "--days", "7"], ws);
    assert.equal(r.code, 1);
    const networks = r.json.holes.map((h) => h.network);
    assert.deepEqual(networks, ["mastodon"], JSON.stringify(r.json));
    assert.equal(r.json.holes[0].last, null);
    const given = run("calendar", ["holes", "--days", "7", "--networks", "x,bluesky"], ws);
    assert.deepEqual(given.json.holes.map((h) => h.network), ["bluesky"]);
    const none = run("calendar", ["holes", "--days", "7", "--networks", "x,linkedin"], ws);
    assert.equal(none.code, 0);
    assert.equal(none.json.holes.length, 0);
  });

  test("holes remembers the last planned post of a network", () => {
    const past = addDays(today(), -10);
    run("calendar", ["add", "--id", "old-masto", "--date", past, "--networks", "mastodon", "--title", "Old", "--state", "published"], ws);
    const r = run("calendar", ["holes", "--networks", "mastodon"], ws);
    assert.equal(r.code, 1);
    assert.equal(r.json.holes[0].last, past);
    run("calendar", ["remove", "old-masto"], ws);
  });

  test("collisions sees two posts too close and more than three a day", () => {
    const r = run("calendar", ["collisions"], ws);
    assert.equal(r.code, 1);
    const close = r.json.collisions.find((c) => c.kind === "too-close");
    assert.ok(close, JSON.stringify(r.json));
    assert.equal(close.network, "x");
    assert.equal(close.gapMinutes, 90);
    for (const n of [1, 2]) run("calendar", ["add", "--id", `more-${n}`, "--date", d0, "--time", `1${n + 4}:00`, "--networks", "x", "--title", `More ${n}`], ws);
    const many = run("calendar", ["collisions"], ws);
    assert.ok(many.json.collisions.some((c) => c.kind === "too-many" && c.count === 4));
    for (const n of [1, 2]) run("calendar", ["remove", `more-${n}`], ws);
    run("calendar", ["set-state", "early", "cancelled"], ws);
    const clean = run("calendar", ["collisions"], ws);
    assert.equal(clean.code, 0, "a cancelled entry collides with nothing");
    run("calendar", ["set-state", "early", "ready"], ws);
  });

  test("week groups seven days and renders the Markdown table", () => {
    const monday = mondayOf(d0);
    const r = run("calendar", ["week", "--from", monday], ws);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.days.length, 7);
    assert.equal(r.json.days[0].date, monday);
    assert.equal(r.json.count, 2);
    const md = run("calendar", ["week", "--from", monday, "--md"], ws);
    assert.match(md.stdout, /^\| Day \| Time \| Networks \| Title \| State \|/);
    assert.match(md.stdout, /Launch of the autumn offer!/);
    assert.match(md.stdout, /x, linkedin/);
  });

  test("month and next", () => {
    const month = run("calendar", ["month", "--month", d0.slice(0, 7)], ws);
    assert.equal(month.code, 0, month.stderr);
    assert.ok(month.json.days.length >= 28);
    const next = run("calendar", ["next", "--count", "1"], ws);
    assert.equal(next.json.entries.length, 1);
    assert.equal(next.json.entries[0].id, "early");
  });

  test("export --ics gives one VEVENT per entry with floating local times", () => {
    const r = run("calendar", ["export", "--ics"], ws);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /^BEGIN:VCALENDAR\r\n/);
    assert.equal((r.stdout.match(/BEGIN:VEVENT/g) ?? []).length, 2);
    assert.match(r.stdout, new RegExp(`DTSTART;TZID=Europe/Paris:${d0.replace(/-/g, "")}T090000`));
    assert.match(r.stdout, new RegExp(`UID:${d0}-launch-of-the-autumn-offer@allkin`));
    assert.match(r.stdout, /SUMMARY:Launch of the autumn offer! \[x\\, linkedin\]/);
    assert.match(r.stdout, /DESCRIPTION:Theme: product/);
    assert.match(r.stdout, /DESCRIPTION:Theme: news\\nDraft: drafts\/early/);
    const toFile = run("calendar", ["export", "--ics", "--out", "reports/calendar.ics"], ws);
    assert.equal(toFile.code, 0);
    assert.ok(existsSync(join(ws, "reports", "calendar.ics")));
    assert.equal(run("calendar", ["export", "--ics", "--out", "../outside.ics"], ws).code, 2);
    const md = run("calendar", ["export", "--md"], ws);
    assert.match(md.stdout, /^\| Date \| Time \| Networks \| Title \| State \| Theme \|/);
  });

  test("remove", () => {
    const r = run("calendar", ["remove", "early"], ws);
    assert.equal(r.code, 0);
    assert.equal(run("calendar", ["show", "early"], ws).code, 2);
  });
});

/* ------------------------------------------------------------ utm_link */

describe("utm_link", () => {
  test("keeps existing params and the fragment, replaces utm_*", () => {
    const { tracked, issues } = buildUtmLink("https://allk.in/p?a=1&utm_source=old&utm_medium=email#frag", "x", "2026-11-05-launch", { content: "a b" });
    assert.deepEqual(issues, []);
    const url = new URL(tracked);
    assert.equal(url.hash, "#frag");
    assert.equal(url.searchParams.get("a"), "1");
    assert.equal(url.searchParams.get("utm_source"), "x");
    assert.equal(url.searchParams.get("utm_medium"), "social");
    assert.equal(url.searchParams.get("utm_campaign"), "2026-11-05-launch");
    assert.equal(url.searchParams.get("utm_content"), "a b");
    assert.equal((tracked.match(/utm_source=/g) ?? []).length, 1);
    assert.match(tracked, /utm_content=a%20b#frag$/);
  });

  test("a URL without query gets a clean one; no campaign, no utm_campaign", () => {
    const { tracked } = buildUtmLink("https://allk.in/", "linkedin", null);
    assert.equal(tracked, "https://allk.in/?utm_source=linkedin&utm_medium=social");
  });

  test("encodes an accented campaign and a custom source", () => {
    const { tracked } = buildUtmLink("https://allk.in/é?x=y z", "x", "été 2026", { source: "allkin", medium: "post" });
    assert.match(tracked, /utm_campaign=%C3%A9t%C3%A9%202026/);
    assert.match(tracked, /utm_source=allkin/);
    assert.match(tracked, /utm_medium=post/);
    assert.match(tracked, /x=y%20z/);
  });

  test("leaves a non-http link alone", () => {
    for (const bad of ["mailto:x@y.z", "ftp://files.example.org/a", "not a url"]) {
      const { tracked, issues } = buildUtmLink(bad, "x", "c");
      assert.equal(tracked, null, bad);
      assert.equal(issues.length, 1, bad);
    }
  });

  test("the CLI prints { url, tracked } and exits 1 on a non-http link", () => {
    const ok = run("utm_link", ["https://allk.in/p", "--network", "x", "--campaign", "c1"]);
    assert.equal(ok.code, 0, ok.stderr);
    assert.equal(ok.json.url, "https://allk.in/p");
    assert.equal(ok.json.tracked, "https://allk.in/p?utm_source=x&utm_medium=social&utm_campaign=c1");
    const bad = run("utm_link", ["mailto:a@b.c", "--network", "x"]);
    assert.equal(bad.code, 1);
    assert.equal(bad.json.tracked, null);
    assert.equal(run("utm_link", ["https://allk.in/", "--network", "myspace"]).code, 2);
    assert.equal(run("utm_link", ["https://allk.in/"]).code, 2);
  });

  test("--source takes the account's handle without @", () => {
    const { dir, ws } = freshWorkspace();
    try {
      const accounts = JSON.parse(readFileSync(join(ws, "accounts.json"), "utf-8"));
      accounts.accounts = [{ network: "x", service: "x", handle: "@allkin", name: "Allkin", id: "1", language: "fr", tier: 1 }];
      writeFileSync(join(ws, "accounts.json"), JSON.stringify(accounts));
      const r = run("utm_link", ["https://allk.in/", "--network", "x", "--source"], ws);
      assert.equal(r.code, 0, r.stderr);
      assert.match(r.json.tracked, /utm_source=allkin&/);
      assert.equal(run("utm_link", ["https://allk.in/", "--network", "linkedin", "--source"], ws).code, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/* --------------------------------------------------------- publish_log */

describe("publish_log", () => {
  let dir;
  let ws;
  const TEXT = "Allkin gives a machine to your agents and keeps you the keys. Discover the autumn offer: https://allk.in/offer #allkin #agents";
  const NEAR = "Allkin gives a machine to your agents and keeps you the keys! Discover the autumn offer https://allk.in/offer?utm_source=x #allkin";
  const OTHER = "Three tips to write a good system prompt for your agent, from our experience of the last six months.";
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

  before(() => {
    ({ dir, ws } = freshWorkspace());
    const draft = join(ws, "drafts", "launch");
    mkdirSync(draft, { recursive: true });
    writeFileSync(join(draft, "draft.json"), JSON.stringify({ id: "launch", calendarId: "cal-launch", networks: ["x", "linkedin"], theme: "product", link: "https://allk.in/offer", campaign: "cal-launch", createdAt: daysAgo(3) }));
    writeFileSync(join(draft, "master.md"), TEXT + "\n");
    writeFileSync(join(draft, "linkedin.md"), TEXT + "\n\nMore for LinkedIn.\n");
    writeFileSync(join(ws, "calendar.json"), JSON.stringify({ entries: [{ id: "cal-launch", date: today(), time: "09:00", networks: ["x", "linkedin"], theme: "product", title: "Launch", state: "scheduled", draft: "drafts/launch", actionId: null, notes: "" }] }));
  });
  after(() => rmSync(dir, { recursive: true, force: true }));

  test("add takes the text of the draft, the calendar entry and the theme from draft.json, and marks it published", () => {
    const r = run("publish_log", ["add", "--draft", "launch", "--network", "x", "--url", "https://x.com/allkin/status/1", "--post-id", "1", "--published-at", daysAgo(2)], ws);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.added.calendarId, "cal-launch");
    assert.equal(r.json.calendar, "published");
    const lines = readFileSync(join(ws, "published.jsonl"), "utf-8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(lines.length, 1);
    assert.equal(lines[0].theme, "product");
    assert.equal(lines[0].postId, "1");
    assert.ok(lines[0].fingerprint.length > 20);
    assert.equal(lines[0].excerpt.length <= 140, true);
    assert.ok(lines[0].excerpt.startsWith("Allkin gives a machine"));
    const cal = JSON.parse(readFileSync(join(ws, "calendar.json"), "utf-8"));
    assert.equal(cal.entries[0].state, "published");
  });

  test("add with --text, --file and an explicit --calendar-id that does not exist", () => {
    const r = run("publish_log", ["add", "--draft", "launch", "--network", "linkedin", "--file", "drafts/launch/linkedin.md", "--url", "https://linkedin.com/posts/2", "--post-id", "2", "--published-at", daysAgo(2), "--calendar-id", "nope"], ws);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.calendar, "not-found");
    const old = run("publish_log", ["add", "--draft", "launch", "--network", "x", "--text", TEXT, "--url", "https://x.com/allkin/status/0", "--post-id", "0", "--published-at", daysAgo(45)], ws);
    assert.equal(old.code, 0, old.stderr);
    assert.equal(run("publish_log", ["add", "--draft", "launch", "--network", "x", "--file", "../../etc/passwd"], ws).code, 2);
    assert.equal(run("publish_log", ["add", "--network", "x", "--text", "x"], ws).code, 2, "--draft is required");
  });

  test("check: the same text is a duplicate", () => {
    const r = run("publish_log", ["check", "--network", "x", "--text", TEXT], ws);
    assert.equal(r.code, 1);
    assert.equal(r.json.duplicates.length, 1, "the 45-day-old post is out of the window");
    assert.equal(r.json.duplicates[0].url, "https://x.com/allkin/status/1");
    assert.equal(r.json.duplicates[0].similarity, 1);
    assert.equal(r.json.issues.length, 1);
  });

  test("check: a near-same text is a duplicate, a different one is not", () => {
    const near = run("publish_log", ["check", "--network", "x", "--text", NEAR], ws);
    assert.equal(near.code, 1, JSON.stringify(near.json));
    assert.ok(near.json.duplicates[0].similarity >= 0.9 && near.json.duplicates[0].similarity < 1);
    const other = run("publish_log", ["check", "--network", "x", "--text", OTHER], ws);
    assert.equal(other.code, 0, other.stderr);
    assert.equal(other.json.duplicates.length, 0);
  });

  test("check: another network, and the window", () => {
    const masto = run("publish_log", ["check", "--network", "mastodon", "--text", TEXT], ws);
    assert.equal(masto.code, 0);
    const li = run("publish_log", ["check", "--network", "linkedin", "--text", TEXT], ws);
    assert.equal(li.code, 1, "the LinkedIn text starts the same and is near enough");
    const wide = run("publish_log", ["check", "--network", "x", "--text", TEXT, "--days", "60"], ws);
    assert.equal(wide.json.duplicates.length, 2, "a 60-day window takes the old post in");
    const narrow = run("publish_log", ["check", "--network", "x", "--text", TEXT, "--days", "1"], ws);
    assert.equal(narrow.code, 0);
  });

  test("findDuplicates honours the rules it is given", () => {
    const strict = findDuplicates(ws, "x", NEAR, { duplicateSimilarity: 0.999, duplicateWindowDays: 30 });
    assert.equal(strict.length, 0);
    const loose = findDuplicates(ws, "x", NEAR, { duplicateSimilarity: 0.5, duplicateWindowDays: 365 });
    assert.equal(loose.length, 2);
    assert.ok(loose[0].similarity >= loose[1].similarity);
  });

  test("list and stats", () => {
    const list = run("publish_log", ["list", "--network", "x"], ws);
    assert.equal(list.json.total, 2);
    assert.equal(list.json.posts[0].url, "https://x.com/allkin/status/1", "newest first");
    const one = run("publish_log", ["list", "--count", "1"], ws);
    assert.equal(one.json.count, 1);
    assert.equal(one.json.total, 3);
    const stats = run("publish_log", ["stats"], ws);
    assert.equal(stats.code, 0, stats.stderr);
    assert.deepEqual(stats.json.byNetwork, { linkedin: 1, x: 2 });
    assert.deepEqual(stats.json.byTheme, { product: 3 });
    assert.equal(Object.values(stats.json.byWeek).reduce((a, b) => a + b, 0), 3);
    assert.equal(stats.json.lastPost.x.slice(0, 10), daysAgo(2).slice(0, 10));
    const recent = run("publish_log", ["stats", "--from", daysAgo(10).slice(0, 10)], ws);
    assert.equal(recent.json.total, 2);
    const md = run("publish_log", ["stats", "--md"], ws);
    assert.match(md.stdout, /\| Network \| Posts \| Last post \|/);
    assert.match(md.stdout, /\| Week \| Posts \|/);
  });
});

/* -------------------------------------------------------------- report */

describe("report", () => {
  let dir;
  let ws;
  before(() => {
    ({ dir, ws } = freshWorkspace());
    const accounts = JSON.parse(readFileSync(join(ws, "accounts.json"), "utf-8"));
    accounts.accounts = [{ network: "x", service: "x", handle: "@allkin", name: "Allkin", id: "1", language: "fr", tier: 3 }];
    writeFileSync(join(ws, "accounts.json"), JSON.stringify(accounts));
  });
  after(() => rmSync(dir, { recursive: true, force: true }));

  test("without digest.json the sections say so and the exit is 1", () => {
    const r = run("report", ["--period", "2026-10"], ws);
    assert.equal(r.code, 1);
    assert.equal(r.json.period, "2026-10");
    assert.ok(r.json.issues.some((i) => /digest/.test(i)));
    const text = readFileSync(r.json.path, "utf-8");
    assert.match(text, /No figures collected/);
    assert.match(text, /<!-- agent: three sentences at most/);
    assert.match(text, /# Social report — 2026-10/);
  });

  test("built from a hand-written digest, published posts and the inbox", () => {
    const digest = {
      generatedAt: "2026-11-01T07:00:00Z",
      period: { from: "2026-10-01", to: "2026-10-31" },
      previous: { from: "2026-09-01", to: "2026-09-30" },
      networks: {
        x: {
          followers: { now: 1200, before: 1150, delta: 50, deltaPct: 4.35 },
          impressions: { now: 54000, before: 49000, delta: 5000, deltaPct: 10.2 },
          engagements: { now: 1300, before: 1100, delta: 200, deltaPct: 18.18 },
          engagementRate: { now: 2.41, before: 2.24 },
          clicks: { now: 210, before: null, delta: null, deltaPct: null },
          posts: 12,
        },
        linkedin: {
          followers: { now: 4200, before: 4000, delta: 200, deltaPct: 5 },
          impressions: { now: 66000, before: 60000, delta: 6000, deltaPct: 10 },
          engagements: { now: 1800, before: 1500, delta: 300, deltaPct: 20 },
          engagementRate: { now: 2.73, before: 2.5 },
          clicks: { now: null, before: null, delta: null, deltaPct: null },
          posts: 19,
        },
      },
      total: { followers: 5400, impressions: 120000, engagements: 3100, engagementRate: 2.58, posts: 31 },
      topPosts: [{ network: "x", postId: "9", url: "https://x.com/allkin/status/9", excerpt: "The autumn offer", engagements: 320, impressions: 9000, engagementRate: 3.56 }],
      bestSlots: [{ weekday: 2, hour: 9, posts: 4, avgEngagementRate: 3.1 }, { weekday: 7, hour: 18, posts: 2, avgEngagementRate: 2.2 }],
      themes: [{ theme: "product", posts: 6, avgEngagementRate: 2.9 }],
    };
    mkdirSync(join(ws, "stats"), { recursive: true });
    writeFileSync(join(ws, "stats", "digest.json"), JSON.stringify(digest));
    const pub = (network, day) => JSON.stringify({ id: `pub-${network}-${day}`, draftId: "d", calendarId: null, network, account: "@allkin", publishedAt: `2026-10-${day}T08:00:00Z`, postId: day, url: null, fingerprint: "abc", excerpt: "…", theme: "product", actionId: null }) + "\n";
    appendFileSync(join(ws, "published.jsonl"), pub("x", "05") + pub("x", "12") + pub("linkedin", "12") + pub("x", "30").replace("2026-10-30", "2026-11-02"));
    writeFileSync(join(ws, "inbox", "triage.json"), JSON.stringify({
      updatedAt: "…",
      entries: [
        { id: "x:1", network: "x", kind: "comment", author: {}, text: "How much?", createdAt: "2026-10-05T10:00:00Z", category: "question", priority: 3, state: "answered", answeredAt: "2026-10-05T12:00:00Z" },
        { id: "x:2", network: "x", kind: "comment", author: {}, text: "Great", createdAt: "2026-10-06T10:00:00Z", category: "praise", priority: 5, state: "answered", answeredAt: "2026-10-06T16:00:00Z" },
        { id: "x:3", network: "x", kind: "comment", author: {}, text: "Buy crypto", createdAt: "2026-10-07T10:00:00Z", category: "spam", priority: 9, state: "ignored", answeredAt: null },
        { id: "x:4", network: "x", kind: "comment", author: {}, text: "Old", createdAt: "2026-09-20T10:00:00Z", category: "question", priority: 3, state: "answered", answeredAt: "2026-10-01T10:00:00Z" },
        { id: "x:5", network: "x", kind: "comment", author: {}, text: "Next month", createdAt: "2026-11-01T10:00:00Z", category: "question", priority: 3, state: "todo", answeredAt: null },
      ],
    }));
    writeFileSync(join(ws, "inbox", "answered.jsonl"), [
      { entryId: "x:1", network: "x", answeredAt: "2026-10-05T12:00:00Z", answer: "…", postId: "a" },
      { entryId: "x:2", network: "x", answeredAt: "2026-10-06T16:00:00Z", answer: "…", postId: "b" },
      { entryId: "x:4", network: "x", answeredAt: "2026-10-01T10:00:00Z", answer: "…", postId: "c" },
    ].map((l) => JSON.stringify(l)).join("\n") + "\n");

    const r = run("report", ["--period", "2026-10"], ws);
    assert.equal(r.code, 0, r.stderr + JSON.stringify(r.json));
    assert.equal(r.json.path, join(ws, "reports", "2026-10.md"));
    assert.equal(r.json.figures.followers, 5400);
    assert.equal(r.json.figures.posts, 31);
    assert.equal(r.json.figures.comments, 3, "comments created in the period");
    assert.deepEqual(r.json.figures.byCategory, { question: 1, praise: 1, spam: 1 });
    assert.equal(r.json.figures.answered, 3, "answers sent in the period, the old comment's included");
    assert.equal(r.json.figures.medianAnswerHours, 6, "median of 2 h, 6 h and 264 h");
    assert.equal(r.json.figures.postsPublished, 3);
    assert.deepEqual(r.json.figures.postsByNetwork, { x: 2, linkedin: 1 });

    const text = readFileSync(r.json.path, "utf-8");
    assert.match(text, /^# Social report — 2026-10/);
    assert.match(text, /from X, LinkedIn\./);
    assert.match(text, /\| Followers \| 5,400 \| 5,150 \| \+250 \(\+4\.85 %\) \|/);
    assert.match(text, /\| Engagement rate \| 2\.58 % \| 2\.39 % \| \+0\.19 pt \|/);
    assert.match(text, /\| Posts \| 31 \| — \| — \|/);
    assert.match(text, /\| X \| 1,200 \(\+50 \(\+4\.35 %\)\) \| 54,000 \(\+5,000 \(\+10\.20 %\)\) \| 1,300 \(\+200 \(\+18\.18 %\)\) \| 2\.41 % \(before 2\.24 %\) \| 210 \| 12 \|/);
    assert.match(text, /- \*\*X\*\* — The autumn offer — 320 engagements, 9,000 impressions, 3\.56 % — https:\/\/x\.com\/allkin\/status\/9/);
    assert.match(text, /- Tuesday 09:00 — 4 posts, 3\.10 % on average/);
    assert.match(text, /- Sunday 18:00 — 2 posts/);
    assert.match(text, /Comments and messages received: \*\*3\*\* — question 1, praise 1, spam 1|spam 1, question 1|praise 1, question 1/);
    assert.match(text, /Answered: \*\*3\*\*, median delay 6\.0 h/);
    assert.match(text, /Posts published: \*\*3\*\* — LinkedIn 1, X 2/);
    assert.match(text, /<!-- agent: three sentences at most, from the figures above -->/);
    assert.match(text, /<!-- agent: three proposals, each tied to a figure -->/);
    assert.doesNotMatch(text, /\{\{/, "every placeholder filled");

    const md = run("report", ["--period", "2026-10", "--md"], ws);
    assert.match(md.stdout, /^# Social report — 2026-10/);
  });

  test("--from/--to names the file after the range and flags a digest of another period", () => {
    const r = run("report", ["--from", "2026-10-15", "--to", "2026-10-31"], ws);
    assert.equal(r.code, 1);
    assert.equal(r.json.period, "2026-10-15_2026-10-31");
    assert.ok(r.json.issues.some((i) => /covers 2026-10-01/.test(i)));
    assert.equal(r.json.figures.postsPublished, 0, "the fixture's October posts are all before the 15th");
    assert.ok(existsSync(join(ws, "reports", "2026-10-15_2026-10-31.md")));
    assert.equal(run("report", ["--period", "2026-13"], ws).code, 2);
    assert.equal(run("report", [], ws).code, 2);
  });
});
