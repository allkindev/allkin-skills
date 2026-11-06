/**
 * Shared by every script of the competence. No dependency, no network, no
 * child process: a script reads and writes files under the current folder (the
 * agent's folder when Allkin runs it), prints a short JSON and exits 0 (fine),
 * 1 (problems found, listed) or 2 (bad invocation).
 *
 * The migration lives in `migration/` of that folder:
 *
 *   migration/source/<name>/   what unpack extracted from an uploaded archive
 *   migration/inventory.json   what inventory found there
 *   migration/agents/<id>/     an agent being prepared (agent.json, CLAUDE.md, memory.md, data/)
 *   migration/repo/skills/<id> the converted competences: a repository for Allkin
 *   migration/todo/            what could not be converted, kept for the user
 *   migration/out/             the .allkin archives to import
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const EXIT_OK = 0;
export const EXIT_ISSUES = 1;
export const EXIT_USAGE = 2;

/** `node x.mjs a b --flag value --bool` → { flags, positional } */
export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[a.slice(2)] = next;
          i++;
        } else flags[a.slice(2)] = true;
      }
    } else positional.push(a);
  }
  return { flags, positional };
}

export function usage(text) {
  process.stderr.write(text.trim() + "\n");
  process.exit(EXIT_USAGE);
}

export function fail(message, code = EXIT_USAGE) {
  process.stderr.write(message + "\n");
  process.exit(code);
}

export function out(value, code = EXIT_OK) {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
  process.exit(code);
}

export function migrationDir(flags = {}) {
  return resolve(process.cwd(), String(flags.migration || "migration"));
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

/** Every file under a folder, as paths relative to it, sorted. */
export function walk(dir, base = dir, found = []) {
  if (!existsSync(dir)) return found;
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    const stat = statSync(path, { throwIfNoEntry: false });
    if (!stat) continue;
    if (stat.isDirectory()) walk(path, base, found);
    else if (stat.isFile()) found.push(path.slice(base.length + 1));
  }
  return found;
}

/** An identifier Allkin accepts: lowercase letters, digits, hyphens. */
export function slugify(text) {
  return (
    String(text)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "agent"
  );
}

/* ---------------------------------------------------------------- secrets */

/** Keys whose value is a secret, whatever it looks like. */
const SECRET_KEY = /(token|secret|password|passwd|api[_-]?key|apikey|private[_-]?key|cookie|bearer|credential|auth[_-]?key|client[_-]?secret|session[_-]?key|webhook[_-]?url)/i;

/** Values that are secrets, wherever they sit. */
const SECRET_VALUES = [
  /sk-ant-[A-Za-z0-9_-]{16,}/g,
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,
  /xox[abposr]-[A-Za-z0-9-]{10,}/g,
  /gh[pousr]_[A-Za-z0-9]{30,}/g,
  /github_pat_[A-Za-z0-9_]{30,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /AIza[0-9A-Za-z_-]{30,}/g,
  /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g, // a Telegram bot token
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // a JWT
];

export const REDACTED = "[removed by the migration]";

export function isSecretKey(key) {
  return SECRET_KEY.test(String(key));
}

/**
 * The text with every secret-looking value replaced, and how many were. With
 * `keyLines` (configuration files), a `KEY=value` or `key: value` line whose
 * key names a secret is emptied too — never in prose, where "password: …"
 * is a sentence.
 */
export function scrubText(text, { keyLines = false } = {}) {
  let count = 0;
  let clean = String(text);
  for (const pattern of SECRET_VALUES) {
    clean = clean.replace(pattern, () => {
      count++;
      return REDACTED;
    });
  }
  if (!keyLines) return { text: clean, count };
  clean = clean.replace(/^(\s*(?:export\s+)?)(["']?)([A-Za-z0-9_.-]+)\2(\s*[=:]\s*)(["']?)([^"'\n]*?)\5(\s*,?\s*)$/gm, (whole, lead, kq, key, sep, vq, value, tail) => {
    if (!value || /^(-?\d+(\.\d+)?|true|false|null)$/.test(value) || !isSecretKey(key) || value === REDACTED || /^\$\{?[A-Z_]+\}?$/.test(value)) return whole;
    count++;
    return `${lead}${kq}${key}${kq}${sep}${vq}${REDACTED}${vq}${tail}`;
  });
  return { text: clean, count };
}

/** Does a text still hold something that looks like a secret? */
export function findSecrets(text) {
  const found = [];
  for (const pattern of SECRET_VALUES) {
    for (const match of String(text).matchAll(pattern)) found.push(match[0].slice(0, 8) + "…");
  }
  return found;
}

/** A parsed config with every secret value replaced, and how many were. */
export function scrubObject(value) {
  let count = 0;
  const visit = (node, key) => {
    if (typeof node === "string") {
      if (key !== undefined && isSecretKey(key) && node && !/^\$\{?[A-Z_]+\}?$/.test(node)) {
        count++;
        return REDACTED;
      }
      const scrubbed = scrubText(node);
      count += scrubbed.count;
      return scrubbed.text;
    }
    if (Array.isArray(node)) return node.map((item) => visit(item));
    if (node && typeof node === "object") {
      const copy = {};
      for (const [k, v] of Object.entries(node)) copy[k] = visit(v, k);
      return copy;
    }
    return node;
  };
  return { value: visit(value), count };
}

/** Is this module the script node was started with (not imported by a test)? */
export function isMain(moduleUrl) {
  return Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(moduleUrl);
}

/**
 * The header of a SKILL.md, read leniently: { fields, body }. A folded or
 * literal block (`description: >`) is joined on one line.
 */
export function readSkillHeader(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(String(text));
  const fields = {};
  if (!match) return { fields, body: String(text) };
  const lines = match[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    let value = kv[2].trim();
    if (/^[>|][-+]?$/.test(value)) {
      const parts = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) parts.push(lines[++i].trim());
      value = parts.join(" ");
    }
    fields[kv[1]] = value.replace(/^["']|["']$/g, "").replace(/\s+/g, " ").trim();
  }
  return { fields, body: String(text).slice(match[0].length) };
}
