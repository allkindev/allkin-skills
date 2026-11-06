#!/usr/bin/env node
/**
 * convert_skill — turns a competence of another platform (the same open
 * "Agent Skills" format) into a competence of Allkin, in the migration's
 * repository: migration/repo/skills/<id>/.
 *
 *   node scripts/convert_skill.mjs <skill folder> [--id id] [--locales file.json] [--author name] [--force]
 *
 * - SKILL.md: `name` set to the folder id, `allowed-tools` and the platform's
 *   metadata dropped, the body kept as it is.
 * - skill.json: version 1.0.0, category "other", the locales of --locales
 *   (a JSON { "fr": { "name", "description" }, … }) or the English ones alone.
 * - README.md: written from the description, with what was set aside;
 *   validation.json: pending, as everything of a user's own repository.
 * - Code: a Node script that only works on files (no child process, no
 *   network, no package) is kept in scripts/; anything else — Python, shell,
 *   a script that calls the network or another program — goes to
 *   migration/todo/<id>/ with why, never into the competence.
 *
 * Output: { id, path, kept, setAside, notes }. Exit 1 when the id is taken
 * (pass --force to replace it).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { EXIT_ISSUES, findSecrets, isMain, migrationDir, out, parseArgs, readSkillHeader, scrubText, slugify, usage, walk, writeJson, fail } from "./lib/common.mjs";

const USAGE = `
Usage: node scripts/convert_skill.mjs <skill folder> [--id id] [--locales file.json] [--author name] [--force] [--migration dir]
`;

const NODE_EXT = new Set([".mjs", ".js", ".cjs"]);
const CODE_EXT = new Set([".mjs", ".js", ".cjs", ".ts", ".py", ".sh", ".bash", ".zsh", ".rb", ".go", ".rs", ".php", ".pl", ".ps1"]);

/** Why a script cannot run in Allkin's closed frame; empty when it can. */
export function frameIssues(file, text) {
  const ext = extname(file).toLowerCase();
  if (!NODE_EXT.has(ext)) return [`written in ${ext.slice(1) || "an unknown language"}: only Node runs in a competence`];
  const issues = [];
  if (/\b(child_process|execSync|spawnSync|execFile)\b|\bexec\(|\bspawn\(/.test(text)) issues.push("starts another program");
  if (/\bfetch\(|\bXMLHttpRequest\b|\bWebSocket\b|["'](node:)?(https?|net|tls|dgram|http2)["']/.test(text)) issues.push("uses the network");
  const packages = [...text.matchAll(/(?:from\s+|require\(\s*|import\(\s*)["']([^"'./][^"']*)["']/g)].map((m) => m[1]).filter((p) => !p.startsWith("node:") && !NODE_BUILTINS.has(p.split("/")[0]));
  if (packages.length) issues.push(`needs packages: ${[...new Set(packages)].join(", ")}`);
  if (/process\.env\.[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD)/.test(text)) issues.push("expects a secret in its environment");
  return issues;
}

const NODE_BUILTINS = new Set(["fs", "path", "url", "os", "util", "crypto", "zlib", "stream", "events", "buffer", "assert", "readline", "string_decoder", "querystring", "timers", "perf_hooks"]);

/** SKILL.md with Allkin's header: name = id, description on one line, nothing else. */
export function rewriteSkillMd(text, id) {
  const { fields, body } = readSkillHeader(text);
  let description = fields.description ?? "";
  if (!description) {
    const firstParagraph = body.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith("#"));
    description = (firstParagraph ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  }
  return { text: `---\nname: ${id}\ndescription: ${description}\n---\n\n${body.replace(/^\s+/, "")}`, description };
}

function title(id) {
  return id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function convertSkill(source, repoSkills, todoRoot, { id, locales, author, force }) {
  const target = join(repoSkills, id);
  if (existsSync(target)) {
    if (!force) return { error: `migration/repo/skills/${id} already exists: pass --force to replace it, or --id another` };
    rmSync(target, { recursive: true, force: true });
  }
  rmSync(join(todoRoot, id), { recursive: true, force: true });
  const kept = [];
  const setAside = [];
  const notes = [];

  const original = readFileSync(join(source, "SKILL.md"), "utf8");
  const { text: skillMd, description } = rewriteSkillMd(scrubText(original).text, id);
  if (/\{baseDir\}/.test(skillMd)) notes.push("SKILL.md uses {baseDir} (OpenClaw): replace it with paths relative to the competence's folder");
  if (/\b(curl|wget|python3?|pip|npm|npx|brew|apt)\b/.test(skillMd)) notes.push("the procedure names programs (curl, python, npm…): check that each step still holds in Allkin, where the competence's scripts are Node only");
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, "SKILL.md"), skillMd);

  for (const rel of walk(source)) {
    if (rel === "SKILL.md" || /(^|\/)(node_modules|\.git)\//.test(rel) || /^(skill|package)\.json$|^README[^/]*\.md$|^_meta\.json$/i.test(rel)) continue;
    const from = join(source, rel);
    const ext = extname(rel).toLowerCase();
    if (CODE_EXT.has(ext)) {
      const issues = frameIssues(rel, readFileSync(from, "utf8"));
      if (issues.length) {
        const dest = join(todoRoot, id, rel);
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(from, dest);
        setAside.push({ file: rel, why: issues });
        continue;
      }
      // Allkin runs the scripts of scripts/ named *.mjs (or .js / .cjs).
      const dest = join(target, rel.startsWith("scripts/") ? rel : `scripts/${basename(rel)}`);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(from, dest);
      kept.push(relative(target, dest));
      continue;
    }
    const dest = join(target, rel);
    mkdirSync(dirname(dest), { recursive: true });
    if (/\.(md|txt|json|ya?ml|csv)$/i.test(rel)) writeFileSync(dest, scrubText(readFileSync(from, "utf8")).text);
    else copyFileSync(from, dest);
    kept.push(rel);
  }

  const name = locales?.en?.name ?? title(id);
  const manifest = {
    version: "1.0.0",
    author: author || "Imported",
    category: "other",
    locales: { en: { name, description: locales?.en?.description ?? description }, ...Object.fromEntries(Object.entries(locales ?? {}).filter(([k]) => k !== "en")) },
  };
  writeJson(join(target, "skill.json"), manifest);
  writeJson(join(target, "validation.json"), { status: "pending" });
  const missing = ["fr", "es", "de"].filter((l) => !manifest.locales[l]);
  if (missing.length) notes.push(`skill.json has no ${missing.join(", ")} translation: pass --locales to add them`);

  const readme = [
    `# ${name}`,
    "",
    manifest.locales.en.description,
    "",
    "Imported from another agent platform by the Migrator.",
    ...(setAside.length ? ["", "Set aside, to be rewritten for Allkin:", "", ...setAside.map((s) => `- \`${s.file}\`: ${s.why.join("; ")}`)] : []),
    "",
  ].join("\n");
  writeFileSync(join(target, "README.md"), readme);

  const leftovers = walk(target).flatMap((f) => (/\.(md|txt|json|mjs|js|cjs)$/.test(f) ? findSecrets(readFileSync(join(target, f), "utf8")).map((s) => `${f}: ${s}`) : []));
  if (leftovers.length) notes.push(`secret-looking values remain: ${leftovers.join(", ")}`);
  return { id, path: relative(process.cwd(), target), kept, setAside, notes };
}

if (isMain(import.meta.url)) {
  const { flags, positional } = parseArgs();
  if (flags.help || positional.length !== 1) usage(USAGE);
  const source = resolve(process.cwd(), positional[0]);
  if (!existsSync(join(source, "SKILL.md"))) fail(`No SKILL.md in ${positional[0]}`);
  const id = slugify(flags.id || basename(source));
  let locales = null;
  if (flags.locales) {
    try {
      locales = JSON.parse(readFileSync(resolve(process.cwd(), String(flags.locales)), "utf8"));
    } catch (error) {
      fail(`--locales: ${error.message}`);
    }
  }
  const migration = migrationDir(flags);
  const result = convertSkill(source, join(migration, "repo", "skills"), join(migration, "todo", "skills"), { id, locales, author: flags.author, force: Boolean(flags.force) });
  if (result.error) out(result, EXIT_ISSUES);
  out(result);
}
