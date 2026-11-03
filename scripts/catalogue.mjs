#!/usr/bin/env node
/**
 * Checks the content of a repository for Allkin and writes `catalogue.json` —
 * the one file an Allkin downloads to list what the repository offers:
 * models of agents (agents/), integrations (plugins/), competences (skills/)
 * and services (services/). A repository holds one of these folders or
 * several; the missing ones are simply empty in the catalogue.
 *
 *   node scripts/catalogue.mjs            rewrites catalogue.json and signs it (Allkin's repositories)
 *   node scripts/catalogue.mjs --check    checks without writing (exit 1 on a difference)
 *   node scripts/catalogue.mjs --unsigned writes without signing (a repository that is not Allkin's)
 *
 * SIGNATURE. Allkin only reads the catalogue of one of its own four
 * repositories (allkin-agents, allkin-integrations, allkin-skills,
 * allkin-services) when `catalogue.json.sig` holds the owner's Ed25519
 * signature of the bytes of `catalogue.json` (see src/catalogue-signature.ts
 * in Allkin, which carries the public key). The private key never enters a
 * repository: it is read from `~/.allkin-signing/catalogue.key` (PEM), or
 * from the path in ALLKIN_CATALOGUE_KEY. Without it this script refuses to
 * write unless `--unsigned` is passed — the way for a repository of your own,
 * which Allkin reads without a signature and shows as "not checked by Allkin".
 *
 * The repository is read by Allkin as raw files, which cannot list a folder:
 * the catalogue enumerates the files of every entry, with their size and
 * SHA-256 digest. Allkin refuses to install an entry whose files do not
 * match — hence running this script after EVERY change.
 *
 * No channel, no validation file: an entry of one of Allkin's repositories
 * is validated by construction, one of another repository is pending. The
 * code keeps the folder names of before — plugins/, skills/ —, the user
 * reads them as integrations and competences.
 *
 * No dependency.
 */
import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PLUGINS_DIR = join(ROOT, "plugins");
const CATALOGUE_PATH = join(ROOT, "catalogue.json");
const SIGNATURE_PATH = `${CATALOGUE_PATH}.sig`;
const KEY_PATH = process.env.ALLKIN_CATALOGUE_KEY || join(homedir(), ".allkin-signing", "catalogue.key");
/** The public half of the key, as Allkin carries it (SPKI, base64). */
const PUBLIC_KEY = "MCowBQYDK2VwAyEAVyrJSbeVS7qHsA7k7prO4ceOHN33gC4SVa8iEN+hDhk=";

const publicKey = () => createPublicKey({ key: Buffer.from(PUBLIC_KEY, "base64"), format: "der", type: "spki" });

/** Is the signature on disk the one of this content, by the key Allkin trusts? */
function signatureMatches(content) {
  try {
    const raw = Buffer.from(readFileSync(SIGNATURE_PATH, "utf-8").trim(), "base64");
    return verify(null, Buffer.from(content, "utf-8"), publicKey(), raw);
  } catch {
    return false;
  }
}

const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
/* Strict rule: always 1.0.N, N an integer without a leading zero, raised by
   one at every change of the entry. Allkin compares versions number by
   number: "1.0008" would read as 1.8. */
const VERSION_PATTERN = /^1\.0\.(?:0|[1-9]\d*)$/;
/* The categories of the Competences page of Allkin (skills-store.ts carries
   the same list, 2026-10-14): a skill names one in its skill.json; without
   one it goes under "other". */
const SKILL_CATEGORIES = new Set(["writing", "code", "analysis", "communication", "organisation", "operations", "other"]);
const SEGMENT_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;
const KNOWN_PERMISSIONS = new Set(["network", "filesystem", "exec", "root", "agents", "interface", "agent", "repository"]);
const IGNORED = new Set(["node_modules", ".git", ".DS_Store"]);
const MAX_FILES = 500;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** When the entry last changed: the date of the last commit that touched its
 *  folder. A folder not committed yet takes the newest of its files; outside
 *  git, the same. */
function updatedAt(dir) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", dir], { cwd: ROOT, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (out) return out;
  } catch {
    // Not a git checkout: the files say.
  }
  let newest = 0;
  for (const { st } of listFiles(dir)) newest = Math.max(newest, st.mtimeMs);
  return newest ? new Date(newest).toISOString() : undefined;
}
const stamp = (dir) => (updatedAt(dir) ? { updatedAt: updatedAt(dir) } : {});

const errors = [];
const warnings = [];

const fail = (id, message) => errors.push(`plugins/${id} : ${message}`);

function listFiles(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (IGNORED.has(name)) continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) out.push(...listFiles(path, base));
    else if (st.isFile()) out.push({ path: relative(base, path).split(sep).join("/"), st });
  }
  return out;
}

function readPlugin(id) {
  const dir = join(PLUGINS_DIR, id);
  if (!ID_PATTERN.test(id)) return fail(id, "nom de dossier : minuscules, chiffres et tirets.");
  if (!existsSync(join(dir, "plugin.json"))) return fail(id, "plugin.json est absent.");
  if (!existsSync(join(dir, "README.md"))) return fail(id, "README.md est absent — la documentation est obligatoire.");

  let m;
  try {
    m = JSON.parse(readFileSync(join(dir, "plugin.json"), "utf-8"));
  } catch (err) {
    return fail(id, `plugin.json n'est pas un JSON valide (${err.message}).`);
  }
  if (typeof m.name !== "string" || !m.name.trim()) fail(id, "name est obligatoire.");
  if (!VERSION_PATTERN.test(String(m.version ?? ""))) fail(id, "version attendue : 1.0.N (1.0.0, 1.0.1, 1.0.12…).");
  if (typeof m.description !== "string" || !m.description.trim()) fail(id, "description est obligatoire.");
  if (m.web && !m.service) fail(id, "web suppose un service.");
  if (m.service && (typeof m.service.command !== "string" || !m.service.command)) fail(id, "service.command est obligatoire.");
  if (m.agent) {
    if (typeof m.agent.name !== "string" || !m.agent.name.trim()) fail(id, "agent.name est obligatoire.");
    // One Markdown file, or several joined in order (role + reference documents).
    const prompts = Array.isArray(m.agent.prompt) ? m.agent.prompt : [m.agent.prompt];
    if (!prompts.length || !prompts.every((f) => typeof f === "string" && f.endsWith(".md"))) fail(id, "agent.prompt doit désigner un ou plusieurs fichiers .md du plugin.");
    else for (const f of prompts) if (!existsSync(join(dir, f))) fail(id, `agent.prompt : ${f} est absent.`);
    const declared = (Array.isArray(m.permissions) ? m.permissions : []).some((p) => (typeof p === "string" ? p : p?.id) === "agent");
    if (!declared) fail(id, "un plugin qui déclare « agent » doit demander le droit « agent ».");
  }

  // Plugins it cannot work without: Allkin installs them with it.
  if (m.requires !== undefined && (!Array.isArray(m.requires) || !m.requires.every((r) => typeof r === "string" && ID_PATTERN.test(r) && r !== id))) {
    fail(id, "requires doit être une liste d'identifiants d'autres plugins.");
  }

  const permissions = (Array.isArray(m.permissions) ? m.permissions : []).map((p) => (typeof p === "string" ? { id: p } : p));
  for (const p of permissions) {
    if (!p || typeof p.id !== "string") fail(id, "chaque droit doit avoir un id.");
    else if (!KNOWN_PERMISSIONS.has(p.id)) warnings.push(`plugins/${id} : droit « ${p.id} » inconnu d'Allkin (affiché à risque élevé).`);
    else if (!p.reason) warnings.push(`plugins/${id} : droit « ${p.id} » sans « reason ».`);
  }

  const files = listFiles(dir).map(({ path, st }) => {
    if (!path.split("/").every((s) => SEGMENT_PATTERN.test(s))) fail(id, `nom de fichier refusé par Allkin : ${path}`);
    if (st.size > MAX_FILE_BYTES) fail(id, `${path} dépasse 20 Mo.`);
    return {
      path,
      size: st.size,
      sha256: createHash("sha256").update(readFileSync(join(dir, path))).digest("hex"),
      ...(st.mode & 0o100 ? { executable: true } : {}),
    };
  });
  if (files.length > MAX_FILES) fail(id, `plus de ${MAX_FILES} fichiers.`);
  const icon = ["icon.svg", "icon.png", "icon.webp", "icon.jpg"].find((f) => files.some((x) => x.path === f));

  return {
    id,
    name: m.name,
    version: m.version,
    description: m.description,
    ...(m.author ? { author: m.author } : {}),
    ...(m.homepage ? { homepage: m.homepage } : {}),
    permissions,
    service: Boolean(m.service),
    web: Boolean(m.web),
    ui: Boolean(m.ui),
    ...(m.agent ? { agent: { name: m.agent.name } } : {}),
    ...(icon ? { icon } : {}),
    ...(Array.isArray(m.requires) && m.requires.length ? { requires: m.requires } : {}),
    ...stamp(dir),
    // Translations of the texts above (name, description, permission reasons):
    // the gallery shows them before the plugin is installed.
    ...(m.locales && typeof m.locales === "object" ? { locales: catalogueLocales(m.locales) } : {}),
    files,
  };
}

/** Only what the catalogue shows: name, description, permission reasons. */
function catalogueLocales(locales) {
  const out = {};
  for (const [language, l] of Object.entries(locales)) {
    if (!/^[a-z]{2}$/.test(language) || !l || typeof l !== "object") continue;
    out[language] = {
      ...(typeof l.name === "string" ? { name: l.name } : {}),
      ...(typeof l.description === "string" ? { description: l.description } : {}),
      ...(l.permissions && typeof l.permissions === "object" ? { permissions: l.permissions } : {}),
    };
  }
  return out;
}

const plugins = existsSync(PLUGINS_DIR)
  ? readdirSync(PLUGINS_DIR)
      .filter((name) => statSync(join(PLUGINS_DIR, name)).isDirectory())
      .sort()
      .map(readPlugin)
      .filter(Boolean)
  : [];

/* Services (see SERVICE-STANDARD.md): a folder services/<id>/ holding a
   declarative service.json and its README files. Allkin reads the definition
   from the catalogue itself — it is data, there is nothing to download — and
   fetches a README only when its help is opened. */
const SERVICES_DIR = join(ROOT, "services");
const SERVICE_READMES = ["README.md", "README-FR.md", "README-ES.md", "README-DE.md"];

function readService(id) {
  const dir = join(SERVICES_DIR, id);
  const failService = (message) => errors.push(`services/${id} : ${message}`);
  if (!ID_PATTERN.test(id)) return failService("nom de dossier : minuscules, chiffres et tirets.");
  if (!existsSync(join(dir, "service.json"))) return failService("service.json est absent.");
  if (!existsSync(join(dir, "README.md"))) return failService("README.md est absent — l'aide est obligatoire.");
  let definition;
  try {
    definition = JSON.parse(readFileSync(join(dir, "service.json"), "utf-8"));
  } catch (err) {
    return failService(`service.json n'est pas un JSON valide (${err.message}).`);
  }
  for (const field of ["label", "authType", "category"]) {
    if (typeof definition[field] !== "string" || !definition[field]) failService(`${field} est obligatoire.`);
  }
  if (!definition.apiBaseUrl && !definition.needsBaseUrl && !definition.baseUrlTemplate) {
    failService("apiBaseUrl, needsBaseUrl ou baseUrlTemplate est obligatoire.");
  }
  return {
    id,
    definition,
    readmes: SERVICE_READMES.filter((name) => existsSync(join(dir, name))),
  };
}

const services = existsSync(SERVICES_DIR)
  ? readdirSync(SERVICES_DIR)
      .filter((name) => statSync(join(SERVICES_DIR, name)).isDirectory())
      .sort()
      .map(readService)
      .filter(Boolean)
  : [];

/* Skills (see SKILL-STANDARD.md): a folder skills/<id>/ holding a standard
   SKILL.md (header `name` / `description`, then the procedure), Allkin's own
   skill.json (version 1.0.N, author, icon, category, translations) and its
   README files. Listed with its files and their digests, like a plugin;
   Allkin downloads a skill when an agent is given it (2026-11-03). The user
   reads a skill as a "competence". */
const SKILLS_DIR = join(ROOT, "skills");

/** The two keys of the SKILL.md header, one per line each; null when the header is missing. */
function readSkillHeader(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end < 0) return null;
  const fields = {};
  for (const line of lines.slice(1, end)) {
    const match = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (match) fields[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return { ...fields, body: lines.slice(end + 1).join("\n").trim() };
}

function readSkill(id) {
  const dir = join(SKILLS_DIR, id);
  const failSkill = (message) => errors.push(`skills/${id} : ${message}`);
  if (!ID_PATTERN.test(id)) return failSkill("nom de dossier : minuscules, chiffres et tirets.");
  if (!existsSync(join(dir, "SKILL.md"))) return failSkill("SKILL.md est absent.");
  if (!existsSync(join(dir, "skill.json"))) return failSkill("skill.json est absent (version 1.0.N, auteur, traductions).");
  if (!existsSync(join(dir, "README.md"))) return failSkill("README.md est absent — l'aide est obligatoire.");
  const header = readSkillHeader(readFileSync(join(dir, "SKILL.md"), "utf-8"));
  if (!header) return failSkill("SKILL.md doit commencer par un en-tête entre deux lignes « --- ».");
  if (header.name !== id) failSkill(`l'en-tête de SKILL.md dit name: ${header.name ?? "(absent)"} — attendu ${id}, le nom du dossier.`);
  if (!header.description) failSkill("l'en-tête de SKILL.md doit donner description:, sur une ligne.");
  if (!header.body) warnings.push(`skills/${id} : SKILL.md n'a pas de corps après son en-tête.`);
  if (header["allowed-tools"]) warnings.push(`skills/${id} : allowed-tools est ignoré par Allkin (une compétence n'élargit aucun droit).`);
  let m;
  try {
    m = JSON.parse(readFileSync(join(dir, "skill.json"), "utf-8"));
  } catch (err) {
    return failSkill(`skill.json n'est pas un JSON valide (${err.message}).`);
  }
  if (!VERSION_PATTERN.test(String(m.version ?? ""))) failSkill("skill.json : version attendue 1.0.N (1.0.0, 1.0.1, 1.0.12…).");
  if (m.category === undefined) warnings.push(`skills/${id} : skill.json ne donne pas de category — Allkin la rangera sous « other » (Autres).`);
  else if (!SKILL_CATEGORIES.has(m.category)) failSkill(`skill.json : catégorie inconnue « ${m.category} » — attendu l'une de : ${[...SKILL_CATEGORIES].join(", ")}.`);
  const files = listFiles(dir).map(({ path, st }) => {
    if (!path.split("/").every((s) => SEGMENT_PATTERN.test(s))) failSkill(`nom de fichier refusé par Allkin : ${path}`);
    if (st.size > MAX_FILE_BYTES) failSkill(`${path} dépasse 20 Mo.`);
    return {
      path,
      size: st.size,
      sha256: createHash("sha256").update(readFileSync(join(dir, path))).digest("hex"),
      ...(st.mode & 0o100 ? { executable: true } : {}),
    };
  });
  if (files.length > MAX_FILES) failSkill(`plus de ${MAX_FILES} fichiers.`);
  const icon = ["icon.svg", "icon.png", "icon.webp", "icon.jpg"].find((f) => files.some((x) => x.path === f));
  const locales = {};
  for (const [language, l] of Object.entries(m.locales && typeof m.locales === "object" ? m.locales : {})) {
    if (!/^[a-z]{2}$/.test(language) || !l || typeof l !== "object") continue;
    locales[language] = {
      ...(typeof l.name === "string" ? { name: l.name } : {}),
      ...(typeof l.description === "string" ? { description: l.description } : {}),
    };
  }
  return {
    id,
    name: header.name ?? id,
    version: m.version,
    description: header.description ?? "",
    ...(m.author ? { author: m.author } : {}),
    ...(m.homepage ? { homepage: m.homepage } : {}),
    ...(icon ? { icon } : {}),
    ...(SKILL_CATEGORIES.has(m.category) ? { category: m.category } : {}),
    ...stamp(dir),
    ...(Object.keys(locales).length ? { locales } : {}),
    files,
  };
}

const skills = existsSync(SKILLS_DIR)
  ? readdirSync(SKILLS_DIR)
      .filter((name) => statSync(join(SKILLS_DIR, name)).isDirectory())
      .sort()
      .map(readSkill)
      .filter(Boolean)
  : [];

/* Agents (2026-10-27; the models of agents since 2026-11-03): a folder
   agents/<id>/ holding what an export of an agent holds, unzipped — agent.json (the card: name, version 1.0.N,
   description, author, translations), CLAUDE.md (the role), README files,
   and optionally memory.json, dependencies.json, a picture (avatar.*) and a
   banner. Allkin installs one through the identity card of an import: the
   agent arrives with no right at all, whatever the card says. */
const AGENTS_DIR = join(ROOT, "agents");

function readAgent(id) {
  const dir = join(AGENTS_DIR, id);
  const failAgent = (message) => errors.push(`agents/${id}: ${message}`);
  if (!ID_PATTERN.test(id)) return failAgent("folder name: lowercase letters, digits and dashes.");
  if (!existsSync(join(dir, "agent.json"))) return failAgent("agent.json is missing (name, version 1.0.N, description).");
  if (!existsSync(join(dir, "CLAUDE.md"))) return failAgent("CLAUDE.md is missing: the role of the agent is required.");
  if (!existsSync(join(dir, "README.md"))) return failAgent("README.md is missing: the documentation is required.");
  let m;
  try {
    m = JSON.parse(readFileSync(join(dir, "agent.json"), "utf-8"));
  } catch (err) {
    return failAgent(`agent.json is not valid JSON (${err.message}).`);
  }
  if (typeof m.name !== "string" || !m.name.trim()) failAgent("name is required.");
  if (!VERSION_PATTERN.test(String(m.version ?? ""))) failAgent("version expected as 1.0.N (1.0.0, 1.0.1, 1.0.12…).");
  if (typeof m.description !== "string" || !m.description.trim()) failAgent("description is required.");
  const files = listFiles(dir).map(({ path, st }) => {
    if (!path.split("/").every((s) => SEGMENT_PATTERN.test(s))) failAgent(`file name Allkin refuses: ${path}`);
    if (st.size > MAX_FILE_BYTES) failAgent(`${path} exceeds 20 MB.`);
    return {
      path,
      size: st.size,
      sha256: createHash("sha256").update(readFileSync(join(dir, path))).digest("hex"),
    };
  });
  if (files.length > MAX_FILES) failAgent(`more than ${MAX_FILES} files.`);
  const icon = ["avatar.webp", "avatar.png", "avatar.jpg", "icon.svg", "icon.png", "icon.webp"].find((f) => files.some((x) => x.path === f));
  return {
    id,
    name: m.name,
    version: m.version,
    description: m.description,
    ...(m.author ? { author: m.author } : {}),
    ...(typeof m.job === "string" ? { job: m.job } : {}),
    ...(icon ? { icon } : {}),
    ...stamp(dir),
    ...(m.locales && typeof m.locales === "object" ? { locales: catalogueLocales(m.locales) } : {}),
    files,
  };
}

const agents = existsSync(AGENTS_DIR)
  ? readdirSync(AGENTS_DIR)
      .filter((name) => statSync(join(AGENTS_DIR, name)).isDirectory())
      .sort()
      .map(readAgent)
      .filter(Boolean)
  : [];

for (const w of warnings) console.warn(`warning    ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error      ${e}`);
  process.exit(1);
}

// The four sections are always there, empty or not.
const content = JSON.stringify({ schemaVersion: 1, plugins, skills, agents, services }, null, 2) + "\n";
if (process.argv.includes("--check")) {
  const current = existsSync(CATALOGUE_PATH) ? readFileSync(CATALOGUE_PATH, "utf-8") : "";
  if (current !== content) {
    console.error("catalogue.json is not up to date: run node scripts/catalogue.mjs");
    process.exit(1);
  }
  if (!process.argv.includes("--unsigned") && !signatureMatches(content)) {
    console.error("catalogue.json.sig is missing or does not match: run node scripts/catalogue.mjs");
    process.exit(1);
  }
  console.log(`catalogue.json up to date (${agents.length} agents, ${plugins.length} plugins, ${skills.length} skills, ${services.length} services).`);
} else if (process.argv.includes("--unsigned")) {
  writeFileSync(CATALOGUE_PATH, content);
  console.log(`catalogue.json written, not signed (${agents.length} agents, ${plugins.length} plugins, ${skills.length} skills, ${services.length} services).`);
} else {
  if (!existsSync(KEY_PATH)) {
    console.error(`error      signing key not found (${KEY_PATH}): the catalogue is not written. For a repository that is not Allkin's, pass --unsigned.`);
    process.exit(1);
  }
  const signature = sign(null, Buffer.from(content, "utf-8"), createPrivateKey(readFileSync(KEY_PATH, "utf-8")));
  // The key on this machine must be the one Allkin carries, or every installation would refuse the result.
  if (!verify(null, Buffer.from(content, "utf-8"), publicKey(), signature)) {
    console.error(`error      ${KEY_PATH} is not the key Allkin trusts (see PUBLIC_KEY): the catalogue is not written.`);
    process.exit(1);
  }
  writeFileSync(CATALOGUE_PATH, content);
  writeFileSync(SIGNATURE_PATH, signature.toString("base64") + "\n");
  console.log(`catalogue.json written and signed (${agents.length} agents, ${plugins.length} plugins, ${skills.length} skills, ${services.length} services).`);
}
