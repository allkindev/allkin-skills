/**
 * Tests of the migration scripts: zip, JSON5, secrets, unpack, inventory
 * (OpenClaw and NanoClaw), convert_skill, pack. Fixtures are written in a
 * temporary folder.
 *
 * Run from the skill folder: node --test tests/migrate.test.mjs
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { readZip, writeZip, safeEntryName } from "../scripts/lib/zip.mjs";
import { parseJson5 } from "../scripts/lib/json5.mjs";
import { scrubText, scrubObject, findSecrets, REDACTED } from "../scripts/lib/common.mjs";
import { unpack } from "../scripts/unpack.mjs";
import { inventory } from "../scripts/inventory.mjs";
import { convertSkill, frameIssues } from "../scripts/convert_skill.mjs";
import { pack, memoryFacts } from "../scripts/pack.mjs";

const TELEGRAM = "123456789:AAEhBP0av28aaaaaaaaaaaaaaaaaaaaaaaa";
const ANTHROPIC = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz";
let tmp;

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function zipOf(files) {
  return writeZip(Object.entries(files).map(([name, data]) => ({ name, data })));
}

before(() => {
  tmp = mkdtempSync(join(tmpdir(), "migrate-"));
});
after(() => rmSync(tmp, { recursive: true, force: true }));

test("zip: what is written reads back, unsafe names are skipped", () => {
  const buffer = zipOf({ "a.txt": "hello", "dir/b.md": "x".repeat(5000), "../evil": "no", "/abs": "no" });
  const entries = readZip(buffer);
  assert.deepEqual(entries.map((e) => e.name), ["a.txt", "dir/b.md"]);
  assert.equal(entries[1].read().toString(), "x".repeat(5000));
  assert.equal(safeEntryName("a/../../b"), null);
  assert.equal(safeEntryName("a\\b"), "a/b");
  assert.throws(() => readZip(Buffer.from("not a zip at all, really")), /not a zip/);
});

test("json5: comments, trailing commas, unquoted keys, single quotes", () => {
  const value = parseJson5(`// c\n{ a: 'x', "b": [1, 2,], /* c */ c: { d: true, }, e: -0x10, }`);
  assert.deepEqual(value, { a: "x", b: [1, 2], c: { d: true }, e: -16 });
});

test("secrets: values in prose, keys in configuration, numbers left alone", () => {
  assert.equal(scrubText(`my key ${ANTHROPIC} ok`).text, `my key ${REDACTED} ok`);
  assert.equal(scrubText("password: never say it").count, 0, "prose is not a configuration");
  assert.equal(scrubText("API_KEY=abc123\nmaxTokens: 4096", { keyLines: true }).text, `API_KEY=${REDACTED}\nmaxTokens: 4096`);
  const { value, count } = scrubObject({ channels: { telegram: { botToken: TELEGRAM, maxTokens: 10 } }, note: `see ${ANTHROPIC}` });
  assert.equal(value.channels.telegram.botToken, REDACTED);
  assert.equal(value.channels.telegram.maxTokens, 10);
  assert.equal(count, 2);
  assert.equal(findSecrets(`x ${TELEGRAM}`).length, 1);
});

function openClawZip() {
  return zipOf({
    ".openclaw/openclaw.json": `{ agents: { defaults: { workspace: '~/.openclaw/workspace', model: { primary: 'anthropic/claude-opus-4-5' }, heartbeat: { every: '1h' } } }, channels: { telegram: { botToken: '${TELEGRAM}' } } }`,
    ".openclaw/credentials/oauth.json": "{}",
    ".openclaw/agents/main/sessions/s.jsonl": "{}",
    ".openclaw/cron/jobs.json": JSON.stringify({ jobs: [{ name: "Brief", schedule: { kind: "cron", expr: "0 8 * * *" }, payload: { message: "Brief me" } }] }),
    ".openclaw/workspace/IDENTITY.md": "- **Name:** Jarvis\n",
    ".openclaw/workspace/SOUL.md": "Be warm.",
    ".openclaw/workspace/AGENTS.md": `Rules. Key ${ANTHROPIC}`,
    ".openclaw/workspace/USER.md": "Tony.",
    ".openclaw/workspace/MEMORY.md": "- likes tea",
    ".openclaw/workspace/memory/2026-10-01.md": "garden",
    ".openclaw/workspace/HEARTBEAT.md": "check mail",
    ".openclaw/workspace/skills/csv/SKILL.md": "---\nname: csv\ndescription: >\n  Sum CSV\n  files\n---\nnode scripts/sum.mjs",
    ".openclaw/workspace/skills/csv/scripts/sum.mjs": 'import { readFileSync } from "node:fs";',
    ".openclaw/workspace/skills/csv/scripts/fetch.mjs": 'await fetch("https://x")',
    ".openclaw/workspace/skills/csv/scripts/tool.py": "print(1)",
  });
}

test("unpack + inventory: OpenClaw", async () => {
  const source = join(tmp, "oc");
  write(join(tmp, "oc.zip"), openClawZip());
  const result = unpack(join(tmp, "oc.zip"), source);
  assert.equal(result.skipped.secrets, 1);
  assert.equal(result.skipped.transcripts, 1);
  assert.ok(!readFileSync(join(source, ".openclaw/openclaw.json"), "utf8").includes(TELEGRAM));
  assert.ok(!readFileSync(join(source, ".openclaw/workspace/AGENTS.md"), "utf8").includes(ANTHROPIC));

  const inv = await inventory(source);
  assert.equal(inv.platform, "openclaw");
  assert.equal(inv.agents.length, 1);
  const [agent] = inv.agents;
  assert.equal(agent.name, "Jarvis");
  assert.equal(agent.model, "anthropic/claude-opus-4-5");
  assert.deepEqual(agent.heartbeat, { file: ".openclaw/workspace/HEARTBEAT.md", everyMinutes: 60 });
  assert.equal(agent.role.length, 3);
  assert.equal(agent.journal.length, 1);
  assert.equal(agent.skills[0].description, "Sum CSV files");
  assert.equal(inv.schedules[0].schedule.cron, "0 8 * * *");
  assert.equal(inv.schedules[0].prompt, "Brief me");
  assert.deepEqual(inv.channels.map((c) => c.kind), ["telegram"]);
});

test("unpack + inventory: NanoClaw, tasks from SQLite, .env names only", async () => {
  const base = join(tmp, "nc-src");
  write(join(base, "nanoclaw/package.json"), '{"name":"nanoclaw"}');
  write(join(base, "nanoclaw/groups/global/CLAUDE.md"), "all");
  write(join(base, "nanoclaw/groups/main/CLAUDE.md"), "You are Andy");
  write(join(base, "nanoclaw/groups/work/CLAUDE.local.md"), "- remember x");
  write(join(base, "nanoclaw/container/CLAUDE.md"), "shared v2");
  write(join(base, "nanoclaw/.claude/skills/add-telegram/SKILL.md"), "---\nname: add-telegram\ndescription: x\n---");
  const { DatabaseSync } = await import("node:sqlite");
  mkdirSync(join(base, "nanoclaw/store"), { recursive: true });
  const db = new DatabaseSync(join(base, "nanoclaw/store/messages.db"));
  db.exec("CREATE TABLE scheduled_tasks (id TEXT, group_folder TEXT, prompt TEXT, schedule_type TEXT, schedule_value TEXT, status TEXT)");
  db.exec("INSERT INTO scheduled_tasks VALUES ('t1', 'main', 'Weekly', 'interval', '3600000', 'active')");
  db.close();
  const files = {
    "nanoclaw/.env": `TELEGRAM_BOT_TOKEN=${TELEGRAM}\n`,
    "nanoclaw/store/messages.db": readFileSync(join(base, "nanoclaw/store/messages.db")),
  };
  for (const rel of ["package.json", "groups/global/CLAUDE.md", "groups/main/CLAUDE.md", "groups/work/CLAUDE.local.md", "container/CLAUDE.md", ".claude/skills/add-telegram/SKILL.md"]) {
    files[`nanoclaw/${rel}`] = readFileSync(join(base, "nanoclaw", rel));
  }
  write(join(tmp, "nc.zip"), zipOf(files));
  const source = join(tmp, "nc");
  const result = unpack(join(tmp, "nc.zip"), source);
  assert.deepEqual(result.envKeys["nanoclaw/.env"], ["TELEGRAM_BOT_TOKEN"]);
  assert.ok(!existsSync(join(source, "nanoclaw/.env")));

  const inv = await inventory(source);
  assert.equal(inv.platform, "nanoclaw");
  assert.equal(inv.version, "v2");
  assert.deepEqual(inv.agents.map((a) => a.id), ["main", "work"]);
  assert.equal(inv.agents[1].memory, "nanoclaw/groups/work/CLAUDE.local.md");
  assert.equal(inv.shared.role.length, 2);
  assert.deepEqual(inv.installSkills, ["add-telegram"]);
  assert.equal(inv.schedules[0].schedule.everyMinutes, 60);
  assert.deepEqual(inv.channels.map((c) => c.kind), ["telegram"]);
});

test("convert_skill: Node file scripts kept, the rest set aside", () => {
  assert.deepEqual(frameIssues("a.mjs", 'import fs from "node:fs";'), []);
  assert.match(frameIssues("a.mjs", 'import x from "axios";').join(), /packages: axios/);
  assert.match(frameIssues("a.js", 'require("child_process")').join(), /another program/);
  assert.match(frameIssues("a.py", "").join(), /only Node/);

  const repo = join(tmp, "repo", "skills");
  const result = convertSkill(join(tmp, "oc/.openclaw/workspace/skills/csv"), repo, join(tmp, "todo"), { id: "csv", locales: null });
  assert.deepEqual(result.kept, ["scripts/sum.mjs"]);
  assert.deepEqual(result.setAside.map((s) => s.file).sort(), ["scripts/fetch.mjs", "scripts/tool.py"]);
  assert.match(readFileSync(join(repo, "csv/SKILL.md"), "utf8"), /^---\nname: csv\ndescription: Sum CSV files\n---/);
  assert.equal(JSON.parse(readFileSync(join(repo, "csv/skill.json"), "utf8")).version, "1.0.0");
  assert.ok(existsSync(join(tmp, "todo/csv/scripts/tool.py")));
  assert.match(convertSkill(join(tmp, "oc/.openclaw/workspace/skills/csv"), repo, join(tmp, "todo"), { id: "csv" }).error, /already exists/);
});

test("pack: limits of the memory, no secret, Allkin's card only", () => {
  const facts = memoryFacts(`- a\n- ${"y".repeat(301)}\n- key ${ANTHROPIC}\n# title\n`);
  assert.deepEqual(facts.kept, ["a"]);
  assert.equal(facts.left.length, 2);

  const dir = join(tmp, "agents/jarvis");
  write(join(dir, "agent.json"), JSON.stringify({ name: "Jarvis", builtin: true, webhookToken: "t", canBrowseWeb: true, skillIds: ["csv"], carry: [join(tmp, "oc/.openclaw/workspace/memory"), "/etc/passwd"] }));
  write(join(dir, "CLAUDE.md"), "Be warm.");
  write(join(dir, "memory.md"), "- likes tea");
  write(join(dir, "data/notes/2026-10-01.md"), "garden");
  assert.match(pack(dir, join(tmp, "repo", "skills"), tmp).issues.join(), /carry: \/etc\/passwd/);
  write(join(dir, "agent.json"), JSON.stringify({ name: "Jarvis", builtin: true, webhookToken: "t", canBrowseWeb: true, skillIds: ["csv"], carry: [join(tmp, "oc/.openclaw/workspace/memory")] }));
  const packed = pack(dir, join(tmp, "repo", "skills"), tmp);
  assert.equal(packed.issues, undefined);
  const names = readZip(writeZip(packed.files)).map((e) => e.name);
  assert.deepEqual(names, ["agent.json", "CLAUDE.md", "dependencies.json", "memory.json", "data/notes/2026-10-01.md", "data/memory/2026-10-01.md"]);
  assert.equal(packed.card.builtin, undefined);
  assert.equal(packed.card.webhookToken, undefined);
  assert.equal(packed.skills[0].version, "1.0.0");

  write(join(dir, "CLAUDE.md"), `Use ${ANTHROPIC}`);
  assert.match(pack(dir, join(tmp, "repo", "skills"), tmp).issues.join(), /CLAUDE\.md: secret-looking/);
});
