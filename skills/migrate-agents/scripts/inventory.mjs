#!/usr/bin/env node
/**
 * inventory — recognises what was extracted (OpenClaw, NanoClaw v1 or v2) and
 * lists what can be migrated: the agents with the files of their role and
 * memory, the competences, the scheduled tasks, the channels and the model.
 *
 *   node scripts/inventory.mjs --source migration/source/<name> [--migration dir]
 *
 * Reads only; writes migration/inventory.json. Paths in the output are
 * relative to the source folder. Exit 1 when the platform is not recognised
 * (the output says what was looked for).
 *
 * The layouts are the ones documented by the two projects in 2026; they move
 * fast, so everything is looked for in several places and what is unknown is
 * reported, never guessed.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { EXIT_ISSUES, EXIT_OK, isMain, migrationDir, out, parseArgs, readSkillHeader, slugify, usage, walk, writeJson, fail } from "./lib/common.mjs";
import { parseJson5 } from "./lib/json5.mjs";

const USAGE = `
Usage: node scripts/inventory.mjs --source migration/source/<name> [--migration dir]
`;

const isDir = (path) => existsSync(path) && statSync(path).isDirectory();
const isFile = (path) => existsSync(path) && statSync(path).isFile();
const subdirs = (path) => (isDir(path) ? readdirSync(path).filter((n) => isDir(join(path, n))).sort() : []);

function readJson(path) {
  try {
    return parseJson5(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** The first folder under root (itself included, two levels down) where test(dir) holds. */
function findRoot(root, test) {
  if (test(root)) return root;
  for (const a of subdirs(root)) {
    if (test(join(root, a))) return join(root, a);
    for (const b of subdirs(join(root, a))) if (test(join(root, a, b))) return join(root, a, b);
  }
  return null;
}

/* ---------------------------------------------------------- competences */

const CODE_EXT = /\.(mjs|cjs|js|ts|py|sh|bash|zsh|rb|go|rs|php|pl|ps1)$/i;

/** One competence folder: its name, what it says it is for, its code files. */
function describeSkill(dir, root, origin) {
  const text = readFileSync(join(dir, "SKILL.md"), "utf8");
  const header = readSkillHeader(text).fields;
  const files = walk(dir);
  return {
    id: slugify(header.name || basename(dir)),
    name: header.name || basename(dir),
    description: header.description || "",
    path: relative(root, dir),
    origin,
    code: files.filter((f) => CODE_EXT.test(f)),
    files: files.length,
  };
}

function skillsUnder(dir, root, origin) {
  return subdirs(dir)
    .filter((n) => isFile(join(dir, n, "SKILL.md")))
    .map((n) => describeSkill(join(dir, n), root, origin));
}

/* ------------------------------------------------------------- OpenClaw */

const OPENCLAW_CONFIGS = ["openclaw.json", "clawdbot.json", "moltbot.json"];
const ROLE_FILES = ["IDENTITY.md", "SOUL.md", "AGENTS.md", "TOOLS.md"];

function findOpenClaw(root) {
  return findRoot(root, (dir) => OPENCLAW_CONFIGS.some((n) => isFile(join(dir, n))) || (isFile(join(dir, "SOUL.md")) && isFile(join(dir, "AGENTS.md"))));
}

/** A path of the configuration (absolute on the old machine) → a folder of the extract. */
function localWorkspace(base, configured, agentId) {
  const candidates = [];
  if (typeof configured === "string" && configured) {
    const tail = configured.replace(/\\/g, "/").replace(/\/+$/, "");
    const parts = tail.split("/");
    // ~/.openclaw/workspace-x → workspace-x; keep the last two segments too.
    candidates.push(parts.slice(-1).join("/"), parts.slice(-2).join("/"));
  }
  candidates.push(agentId ? `workspace-${agentId}` : "workspace", "workspace", ".");
  for (const c of candidates) {
    const dir = resolve(base, c);
    if (dir.startsWith(base) && (isFile(join(dir, "SOUL.md")) || isFile(join(dir, "AGENTS.md")) || isFile(join(dir, "IDENTITY.md")))) return dir;
  }
  return null;
}

/** "30m", "1h", 1800000 → minutes. */
function minutes(every) {
  if (typeof every === "number") return Math.round(every / 60000);
  const m = /^(\d+(?:\.\d+)?)\s*(ms|s|m|min|h|d)?$/i.exec(String(every ?? "").trim());
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] ?? "m").toLowerCase();
  return Math.round(unit === "ms" ? n / 60000 : unit === "s" ? n / 60 : unit === "h" ? n * 60 : unit === "d" ? n * 1440 : n);
}

function modelOf(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.primary ?? value.model ?? value.id ?? null;
}

/** The "Name:" line of IDENTITY.md, when it has one. */
function identityName(dir) {
  if (!isFile(join(dir, "IDENTITY.md"))) return null;
  const match = /^\s*(?:[-*]\s*)?\**name\**\s*:\s*\**\s*(.+?)\s*\**\s*$/im.exec(readFileSync(join(dir, "IDENTITY.md"), "utf8"));
  return match ? match[1].slice(0, 80) : null;
}

function workspaceAgent(dir, root, { id, name, model, heartbeat }) {
  name = identityName(dir) ?? name;
  const memoryFile = ["MEMORY.md", "memory.md"].find((n) => isFile(join(dir, n)));
  const journal = isDir(join(dir, "memory")) ? walk(join(dir, "memory")).filter((f) => f.endsWith(".md")).map((f) => relative(root, join(dir, "memory", f))) : [];
  const known = new Set([...ROLE_FILES, "USER.md", "HEARTBEAT.md", "BOOTSTRAP.md", "MEMORY.md", "memory.md"]);
  const otherFiles = walk(dir).filter((f) => !known.has(f) && !f.startsWith("memory/") && !f.startsWith("skills/") && !f.startsWith(".git/"));
  return {
    id: slugify(id || name || "main"),
    name: name || id || "main",
    workspace: relative(root, dir) || ".",
    role: ROLE_FILES.filter((n) => isFile(join(dir, n))).map((n) => relative(root, join(dir, n))),
    user: isFile(join(dir, "USER.md")) ? relative(root, join(dir, "USER.md")) : null,
    memory: memoryFile ? relative(root, join(dir, memoryFile)) : null,
    journal,
    heartbeat: isFile(join(dir, "HEARTBEAT.md")) || heartbeat ? { file: isFile(join(dir, "HEARTBEAT.md")) ? relative(root, join(dir, "HEARTBEAT.md")) : null, everyMinutes: minutes(heartbeat?.every ?? heartbeat) } : null,
    model,
    skills: skillsUnder(join(dir, "skills"), root, "workspace"),
    otherFiles: otherFiles.slice(0, 200).map((f) => relative(root, join(dir, f))),
  };
}

/** OpenClaw's cron jobs, read leniently: every job with a schedule and a message. */
function openClawJobs(base, root) {
  const files = ["cron/jobs.json", "cron.json", "jobs.json"].map((f) => join(base, f)).filter(isFile);
  const jobs = [];
  for (const file of files) {
    const data = readJson(file);
    const list = Array.isArray(data) ? data : Array.isArray(data?.jobs) ? data.jobs : data && typeof data === "object" ? Object.values(data.jobs ?? {}) : [];
    for (const job of list) {
      if (!job || typeof job !== "object") continue;
      const schedule = job.schedule ?? {};
      const kind = schedule.kind ?? (schedule.expr || job.cron ? "cron" : schedule.everyMs || job.every ? "every" : schedule.at || schedule.atMs || job.at ? "at" : "unknown");
      const payload = job.payload ?? {};
      jobs.push({
        agent: job.agentId ? slugify(job.agentId) : null,
        name: job.name ?? job.id ?? null,
        enabled: job.enabled !== false,
        schedule: {
          kind,
          cron: schedule.expr ?? job.cron ?? null,
          everyMinutes: schedule.everyMs ? Math.round(schedule.everyMs / 60000) : job.every ? minutes(job.every) : null,
          at: schedule.at ?? (schedule.atMs ? new Date(schedule.atMs).toISOString() : (job.at ?? null)),
          timezone: schedule.tz ?? job.tz ?? null,
        },
        prompt: payload.message ?? payload.text ?? job.message ?? job.prompt ?? null,
        from: relative(root, file),
      });
    }
  }
  return jobs;
}

function inventoryOpenClaw(base, root) {
  const configName = OPENCLAW_CONFIGS.find((n) => isFile(join(base, n)));
  const config = configName ? (readJson(join(base, configName)) ?? {}) : {};
  const defaults = config.agents?.defaults ?? config.agent ?? {};
  const listed = Array.isArray(config.agents?.list) ? config.agents.list : [];
  const warnings = [];

  const agents = [];
  const seen = new Set();
  const add = (dir, meta) => {
    if (!dir || seen.has(dir)) return;
    seen.add(dir);
    agents.push(workspaceAgent(dir, root, meta));
  };
  for (const item of listed) {
    const id = item.id ?? item.name;
    const dir = localWorkspace(base, item.workspace ?? (item.default ? defaults.workspace : null), id);
    if (!dir) warnings.push(`agent ${id}: its workspace was not in the archive`);
    add(dir, { id, name: item.identity?.name ?? item.name ?? id, model: modelOf(item.model) ?? modelOf(defaults.model), heartbeat: item.heartbeat ?? defaults.heartbeat });
  }
  if (!agents.length) add(localWorkspace(base, defaults.workspace ?? config.workspace, null), { id: "main", name: config.identity?.name ?? defaults.identity?.name ?? "main", model: modelOf(defaults.model), heartbeat: defaults.heartbeat });
  // Workspaces the configuration does not name (workspace-<id>/).
  for (const n of subdirs(base).filter((n) => /^workspace(-|$)/.test(n))) {
    const dir = join(base, n);
    if (!seen.has(dir) && (isFile(join(dir, "SOUL.md")) || isFile(join(dir, "AGENTS.md")))) add(dir, { id: n.replace(/^workspace-?/, "") || "main", model: modelOf(defaults.model), heartbeat: null });
  }

  const channels = Object.entries(config.channels ?? {})
    .filter(([, c]) => c && typeof c === "object")
    .map(([kind, c]) => ({ kind, enabled: c.enabled !== false, from: configName }));
  const tools = config.tools && typeof config.tools === "object" ? Object.keys(config.tools) : [];
  if (!configName) warnings.push("no openclaw.json in the archive: models, channels and the list of agents are unknown");

  return {
    platform: "openclaw",
    version: config.meta?.lastTouchedVersion ?? config.version ?? null,
    base: relative(root, base) || ".",
    config: configName ? relative(root, join(base, configName)) : null,
    agents,
    shared: { role: [], skills: skillsUnder(join(base, "skills"), root, "managed") },
    schedules: openClawJobs(base, root),
    channels,
    tools,
    warnings,
  };
}

/* ------------------------------------------------------------- NanoClaw */

function findNanoClaw(root) {
  return findRoot(root, (dir) => {
    if (!isDir(join(dir, "groups"))) return false;
    const pkg = readJson(join(dir, "package.json"));
    return /nanoclaw/i.test(pkg?.name ?? "") || isDir(join(dir, "container")) || isDir(join(dir, "store")) || subdirs(join(dir, "groups")).some((g) => isFile(join(dir, "groups", g, "CLAUDE.md")) || isFile(join(dir, "groups", g, "CLAUDE.local.md")));
  });
}

/** The scheduled tasks of NanoClaw's SQLite store, whatever the table is called. */
async function nanoClawTasks(base, root, warnings) {
  const dbs = walk(base).filter((f) => /\.(db|sqlite3?)$/.test(f) && !f.startsWith("node_modules/"));
  const tasks = [];
  const groups = [];
  if (!dbs.length) return { tasks, groups };
  let DatabaseSync;
  try {
    process.removeAllListeners("warning");
    ({ DatabaseSync } = await import("node:sqlite"));
  } catch {
    warnings.push("this Node cannot read SQLite: the scheduled tasks were not read");
    return { tasks, groups };
  }
  for (const rel of dbs) {
    let db;
    try {
      db = new DatabaseSync(join(base, rel), { readOnly: true });
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);
      for (const table of tables) {
        const columns = db.prepare(`PRAGMA table_info("${table.replace(/"/g, '""')}")`).all().map((c) => c.name);
        const pick = (...names) => names.find((n) => columns.includes(n));
        const quoted = `"${table.replace(/"/g, '""')}"`;
        if (/task/i.test(table) && pick("prompt", "message")) {
          for (const row of db.prepare(`SELECT * FROM ${quoted} LIMIT 500`).all()) {
            const type = row[pick("schedule_type", "type", "kind")] ?? null;
            const value = row[pick("schedule_value", "schedule", "cron", "value")] ?? null;
            tasks.push({
              agent: row[pick("group_folder", "group", "folder")] ? slugify(row[pick("group_folder", "group", "folder")]) : null,
              name: row[pick("name", "id")] ?? null,
              enabled: !/^(paused|cancelled|canceled|completed|done|inactive)$/i.test(String(row[pick("status", "state")] ?? "active")),
              schedule: {
                kind: type === "interval" ? "every" : type === "once" ? "at" : type === "cron" ? "cron" : (type ?? "unknown"),
                cron: type === "cron" ? value : null,
                everyMinutes: type === "interval" && value != null ? Math.round(Number(value) / 60000) : null,
                at: type === "once" ? value : null,
                timezone: null,
              },
              prompt: row[pick("prompt", "message")],
              from: `${relative(root, join(base, rel))}#${table}`,
            });
          }
        }
        if (/group/i.test(table) && pick("folder") && pick("jid", "chat_jid", "id")) {
          for (const row of db.prepare(`SELECT * FROM ${quoted} LIMIT 500`).all()) {
            const jid = String(row[pick("jid", "chat_jid", "id")] ?? "");
            groups.push({ folder: row.folder, name: row[pick("name")] ?? row.folder, channel: channelOfJid(jid) });
          }
        }
      }
    } catch (error) {
      warnings.push(`${rel}: ${error.message}`);
    } finally {
      db?.close();
    }
  }
  return { tasks, groups };
}

function channelOfJid(jid) {
  if (/@(g\.us|s\.whatsapp\.net)$/.test(jid)) return "whatsapp";
  const prefix = /^([a-z]+):/.exec(jid);
  return prefix ? { tg: "telegram", dc: "discord", sl: "slack" }[prefix[1]] ?? prefix[1] : null;
}

/** Channels named by the variables of .env (their names only, unpack kept no value). */
function envChannels(base) {
  const keys = walk(base)
    .filter((f) => f.endsWith(".keys.json"))
    .flatMap((f) => readJson(join(base, f))?.keys ?? []);
  const kinds = new Set();
  for (const key of keys) {
    const kind = /^(TELEGRAM|DISCORD|SLACK|WHATSAPP|SIGNAL|GMAIL|EMAIL)/.exec(key)?.[1];
    if (kind) kinds.add(kind.toLowerCase());
  }
  return { kinds: [...kinds], keys };
}

async function inventoryNanoClaw(base, root) {
  const warnings = [];
  const groupsDir = join(base, "groups");
  const v2 = isFile(join(base, "container", "CLAUDE.md")) || subdirs(groupsDir).some((g) => isFile(join(groupsDir, g, "CLAUDE.local.md")));
  const shared = [];
  if (isFile(join(groupsDir, "global", "CLAUDE.md"))) shared.push(relative(root, join(groupsDir, "global", "CLAUDE.md")));
  if (isFile(join(base, "container", "CLAUDE.md"))) shared.push(relative(root, join(base, "container", "CLAUDE.md")));

  const { tasks, groups } = await nanoClawTasks(base, root, warnings);
  const agents = [];
  for (const g of subdirs(groupsDir)) {
    if (g === "global") continue;
    const dir = join(groupsDir, g);
    const role = isFile(join(dir, "CLAUDE.md")) ? [relative(root, join(dir, "CLAUDE.md"))] : [];
    const memory = isFile(join(dir, "CLAUDE.local.md")) ? relative(root, join(dir, "CLAUDE.local.md")) : null;
    const known = new Set(["CLAUDE.md", "CLAUDE.local.md"]);
    const registered = groups.find((r) => r.folder === g);
    agents.push({
      id: slugify(g),
      name: registered?.name ?? g,
      workspace: relative(root, dir),
      role,
      user: null,
      memory,
      journal: [],
      heartbeat: null,
      model: null,
      channel: registered?.channel ?? null,
      main: g === "main",
      skills: [],
      otherFiles: walk(dir).filter((f) => !known.has(f) && !f.startsWith("logs/")).slice(0, 200).map((f) => relative(root, join(dir, f))),
    });
  }
  if (!v2 && agents.some((a) => a.role.length)) warnings.push("NanoClaw v1: each group's CLAUDE.md is both its role and its memory — separate them when writing the role");
  const env = envChannels(base);
  const channels = [...new Set([...env.kinds, ...groups.map((g) => g.channel).filter(Boolean)])].map((kind) => ({ kind, enabled: true, from: ".env / registered groups" }));

  return {
    platform: "nanoclaw",
    version: v2 ? "v2" : "v1",
    base: relative(root, base) || ".",
    config: null,
    agents,
    shared: {
      role: shared,
      // container/skills are the agents' competences; .claude/skills change NanoClaw itself.
      skills: skillsUnder(join(base, "container", "skills"), root, "container"),
    },
    installSkills: subdirs(join(base, ".claude", "skills")),
    schedules: tasks,
    channels,
    tools: [],
    envKeys: env.keys,
    warnings,
  };
}

/* ------------------------------------------------------------------ main */

export async function inventory(root) {
  const nano = findNanoClaw(root);
  if (nano) return inventoryNanoClaw(nano, root);
  const claw = findOpenClaw(root);
  if (claw) return inventoryOpenClaw(claw, root);
  return null;
}

if (isMain(import.meta.url)) {
  const { flags } = parseArgs();
  if (flags.help || !flags.source) usage(USAGE);
  const root = resolve(process.cwd(), String(flags.source));
  if (!isDir(root)) fail(`No folder at ${flags.source}`);
  const result = await inventory(root);
  if (!result) {
    out(
      {
        recognised: false,
        lookedFor: ["OpenClaw: openclaw.json (or clawdbot.json, moltbot.json), or a workspace with SOUL.md and AGENTS.md", "NanoClaw: a groups/ folder with CLAUDE.md or CLAUDE.local.md files"],
        topLevel: readdirSync(root).slice(0, 40),
      },
      EXIT_ISSUES,
    );
  }
  const report = { recognised: true, source: relative(process.cwd(), root), ...result };
  writeJson(join(migrationDir(flags), "inventory.json"), report);
  out({
    written: relative(process.cwd(), join(migrationDir(flags), "inventory.json")),
    platform: report.platform,
    version: report.version,
    agents: report.agents.map((a) => ({ id: a.id, name: a.name, role: a.role.length, memory: Boolean(a.memory), journal: a.journal.length, skills: a.skills.length, heartbeat: Boolean(a.heartbeat) })),
    sharedSkills: report.shared.skills.length,
    schedules: report.schedules.length,
    channels: report.channels.map((c) => c.kind),
    warnings: report.warnings,
  });
}
