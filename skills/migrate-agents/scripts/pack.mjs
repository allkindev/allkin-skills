#!/usr/bin/env node
/**
 * pack — builds the .allkin archive of an agent prepared in
 * migration/agents/<id>/, ready for "Import an agent" in Allkin.
 *
 *   node scripts/pack.mjs migration/agents/<id> [--migration dir]
 *
 * The folder holds:
 *   agent.json   { name, description, model?, skillIds?, services?, and the
 *                  rights it should ask for: canAdminSystem, canReadSystem,
 *                  canBrowseWeb, canSchedule, canUseSubagents, canRemember }
 *   CLAUDE.md    the role (required)
 *   memory.md    optional: one fact per line ("- " in front or not)
 *   data/        optional: files the agent starts with (the old daily notes…)
 *   avatar.png   optional (or .jpg, .webp)
 *
 * agent.json may also say what to take from the extract, so nothing has to be
 * copied by hand: `carry` — paths under migration/source/, each file or
 * folder landing in data/ under its own name (or { "from", "to" } with `to`
 * relative to data/) — and `avatar`, the path of a picture there.
 *
 * The memory follows Allkin's limits: 300 characters a fact, 4,000 in all;
 * what does not fit is listed, never cut silently. Nothing is packed while a
 * secret-looking value remains anywhere (exit 1, the places listed).
 *
 * Output: { archive, memory: { kept, left }, skills, services, files }.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { EXIT_ISSUES, findSecrets, isMain, migrationDir, out, parseArgs, slugify, usage, walk, fail } from "./lib/common.mjs";
import { writeZip } from "./lib/zip.mjs";

const USAGE = `
Usage: node scripts/pack.mjs migration/agents/<id> [--migration dir]
`;

export const MEMORY_ENTRY_MAX = 300;
export const MEMORY_CAP = 4000;
const RIGHTS = ["canAdminSystem", "canReadSystem", "canBrowseWeb", "canSchedule", "canUseSubagents", "canRemember"];
const DATA_MAX_BYTES = 50 * 1024 * 1024;

/** memory.md → the facts Allkin keeps, and those that do not fit. */
export function memoryFacts(text) {
  const kept = [];
  const left = [];
  let used = 0;
  for (const raw of String(text).split(/\r?\n/)) {
    const fact = raw.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").trim();
    if (!fact || fact.startsWith("#")) continue;
    if (fact.length > MEMORY_ENTRY_MAX) left.push({ fact: fact.slice(0, 80) + "…", why: `longer than ${MEMORY_ENTRY_MAX} characters` });
    else if (findSecrets(fact).length) left.push({ fact: fact.slice(0, 40) + "…", why: "looks like a secret" });
    else if (used + fact.length > MEMORY_CAP) left.push({ fact: fact.slice(0, 80) + "…", why: `over the ${MEMORY_CAP} characters of a memory` });
    else {
      kept.push(fact);
      used += fact.length;
    }
  }
  return { kept, left };
}

/** The files `carry` names, as { name: "data/…", path }; paths outside the extract are refused. */
function carried(meta, sourceRoot, issues) {
  const files = [];
  for (const item of Array.isArray(meta.carry) ? meta.carry : []) {
    const from = typeof item === "string" ? item : item?.from;
    if (typeof from !== "string") continue;
    const path = resolve(process.cwd(), from);
    if (!path.startsWith(sourceRoot + "/") || !existsSync(path)) {
      issues.push(`carry: ${from} is not a file or folder under migration/source/`);
      continue;
    }
    const to = typeof item === "object" && typeof item.to === "string" ? item.to.replace(/^\/+|\.\.(\/|$)/g, "") : basename(path);
    if (statSync(path).isDirectory()) for (const rel of walk(path)) files.push({ name: `data/${to}/${rel}`, path: join(path, rel) });
    else files.push({ name: `data/${to}`, path });
  }
  return files;
}

export function pack(dir, repoSkills, sourceRoot = resolve(dir, "..", "..", "source")) {
  const issues = [];
  let meta;
  try {
    meta = JSON.parse(readFileSync(join(dir, "agent.json"), "utf8"));
  } catch (error) {
    return { issues: [`agent.json: ${existsSync(join(dir, "agent.json")) ? error.message : "missing"}`] };
  }
  if (typeof meta.name !== "string" || !meta.name.trim()) issues.push("agent.json: name is required");
  const role = existsSync(join(dir, "CLAUDE.md")) ? readFileSync(join(dir, "CLAUDE.md"), "utf8") : "";
  if (!role.trim()) issues.push("CLAUDE.md: the role is missing or empty");

  const memory = existsSync(join(dir, "memory.md")) ? memoryFacts(readFileSync(join(dir, "memory.md"), "utf8")) : { kept: [], left: [] };
  const now = new Date().toISOString();

  // What leaves for Allkin: the card, never anything that would make it a
  // system agent or an integration's (the import strips it anyway).
  const card = {
    name: String(meta.name ?? "").trim(),
    description: String(meta.description ?? "").trim(),
    createdAt: now,
    ...(typeof meta.model === "string" && meta.model ? { model: meta.model } : {}),
    ...Object.fromEntries(RIGHTS.filter((r) => typeof meta[r] === "boolean").map((r) => [r, meta[r]])),
    ...(Array.isArray(meta.skillIds) ? { skillIds: meta.skillIds.map(slugify) } : {}),
  };

  const skills = (card.skillIds ?? []).map((id) => {
    const folder = join(repoSkills, id);
    if (!existsSync(join(folder, "skill.json"))) return { id };
    try {
      const manifest = JSON.parse(readFileSync(join(folder, "skill.json"), "utf8"));
      const header = /^---\r?\n[\s\S]*?^description:\s*(.*)$/m.exec(readFileSync(join(folder, "SKILL.md"), "utf8"));
      return { id, version: manifest.version, name: id, ...(header ? { description: header[1].trim() } : {}), ...(manifest.locales ? { locales: manifest.locales } : {}) };
    } catch {
      return { id };
    }
  });
  const services = (Array.isArray(meta.services) ? meta.services : [])
    .map((s) => (typeof s === "string" ? { provider: s } : s))
    .filter((s) => s && typeof s.provider === "string")
    .map((s) => ({ id: slugify(s.provider), provider: slugify(s.provider), ...(s.label ? { label: String(s.label) } : {}) }));
  const dependencies = {
    schemaVersion: 1,
    exportedAt: now,
    engine: card.model ? { model: card.model } : {},
    skills,
    services,
  };

  const files = [
    { name: "agent.json", data: JSON.stringify(card, null, 2) + "\n" },
    { name: "CLAUDE.md", data: role },
    { name: "dependencies.json", data: JSON.stringify(dependencies, null, 2) + "\n" },
  ];
  if (memory.kept.length) {
    files.push({ name: "memory.json", data: JSON.stringify({ next: memory.kept.length + 1, entries: memory.kept.map((text, i) => ({ id: `m${i + 1}`, text, at: now, by: "user" })) }, null, 2) + "\n" });
  }
  const avatarPath = typeof meta.avatar === "string" ? resolve(process.cwd(), meta.avatar) : ["png", "jpg", "webp"].map((ext) => join(dir, `avatar.${ext}`)).find(existsSync);
  if (avatarPath) {
    const ext = extname(avatarPath).slice(1).toLowerCase().replace("jpeg", "jpg");
    if (!["png", "jpg", "webp"].includes(ext) || !existsSync(avatarPath)) issues.push(`avatar: ${meta.avatar} is not a png, jpg or webp picture`);
    else files.push({ name: `avatar.${ext}`, data: readFileSync(avatarPath) });
  }
  let dataBytes = 0;
  const data = [...walk(join(dir, "data")).map((rel) => ({ name: `data/${rel}`, path: join(dir, "data", rel) })), ...carried(meta, sourceRoot, issues)];
  for (const file of data) {
    if (files.some((f) => f.name === file.name)) continue;
    dataBytes += statSync(file.path).size;
    files.push({ name: file.name, data: readFileSync(file.path) });
  }
  if (dataBytes > DATA_MAX_BYTES) issues.push(`data/ holds ${Math.round(dataBytes / 1048576)} MB: keep it under ${DATA_MAX_BYTES / 1048576} MB`);

  for (const file of files) {
    if (/\.(png|jpe?g|webp|gif|pdf|zip|db|sqlite3?)$/i.test(file.name)) continue;
    const found = findSecrets(Buffer.isBuffer(file.data) ? file.data.toString("utf8") : file.data);
    if (found.length) issues.push(`${file.name}: secret-looking value ${found.join(", ")}`);
  }
  if (issues.length) return { issues };
  return { card, files, memory, skills, services, dataFiles: files.filter((f) => f.name.startsWith("data/")).length };
}

if (isMain(import.meta.url)) {
  const { flags, positional } = parseArgs();
  if (flags.help || positional.length !== 1) usage(USAGE);
  const dir = resolve(process.cwd(), positional[0]);
  if (!existsSync(dir)) fail(`No folder at ${positional[0]}`);
  const migration = migrationDir(flags);
  const result = pack(dir, join(migration, "repo", "skills"), join(migration, "source"));
  if (result.issues) out({ packed: false, issues: result.issues }, EXIT_ISSUES);
  const outDir = join(migration, "out");
  mkdirSync(outDir, { recursive: true });
  const archive = join(outDir, `allkin-agent-${slugify(result.card.name)}.allkin`);
  writeFileSync(archive, writeZip(result.files));
  out({
    archive: relative(process.cwd(), archive),
    memory: { kept: result.memory.kept.length, left: result.memory.left },
    skills: result.skills.map((s) => (s.version ? s.id : `${s.id} (not in migration/repo)`)),
    services: result.services.map((s) => s.provider),
    files: result.dataFiles,
  });
}
