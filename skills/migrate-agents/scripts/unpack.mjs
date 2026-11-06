#!/usr/bin/env node
/**
 * unpack — extracts an uploaded archive of another agent platform into
 * migration/source/<name>/, leaving the secrets behind.
 *
 *   node scripts/unpack.mjs <archive.zip> [--name openclaw] [--migration dir]
 *
 * Never extracted: credential folders and files (credentials/, auth-profiles,
 * keys, WhatsApp auth state), conversation transcripts (sessions/), node_modules,
 * .git. An `.env` file is replaced by `<file>.keys.json`, the names of its
 * variables without their values. Configuration files are written back with
 * every secret value replaced; Markdown keeps its prose, only secret-looking
 * values (tokens, keys) are replaced.
 *
 * Output: { source, extracted, skipped, secretsRemoved, envKeys, next }.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { EXIT_OK, isMain, migrationDir, out, parseArgs, scrubObject, scrubText, slugify, usage, fail } from "./lib/common.mjs";
import { parseJson5 } from "./lib/json5.mjs";
import { readZip } from "./lib/zip.mjs";

const USAGE = `
Usage: node scripts/unpack.mjs <archive.zip> [--name name] [--migration dir] [--replace]
  archive.zip   the upload, e.g. Upload/openclaw.zip
  --name        the folder under migration/source/ (default: from the file name)
  --replace     empty that folder first when it exists
`;

/** Paths never extracted, with why. */
const SKIPPED = [
  [/(^|\/)node_modules\//, "dependencies"],
  [/(^|\/)\.git\//, "git"],
  [/(^|\/)__MACOSX\//, "system"],
  [/(^|\/)\.DS_Store$/, "system"],
  [/(^|\/)credentials\//, "secrets"],
  [/(^|\/)auth-profiles?\.json$/, "secrets"],
  [/(^|\/)(store\/)?auth\//, "secrets"],
  [/(^|\/)\.ssh\//, "secrets"],
  [/(^|\/)(id_rsa|id_ed25519|id_ecdsa)(\.pub)?$/, "secrets"],
  [/\.(pem|key|p12|pfx|keystore)$/i, "secrets"],
  [/(^|\/)sessions\/.*\.jsonl?$/, "transcripts"],
  [/(^|\/)data\/sessions\//, "transcripts"],
  [/(^|\/)(logs?|tmp|cache|\.cache)\//, "logs"],
  [/\.log$/, "logs"],
];

const CONFIG_EXT = new Set([".json", ".json5", ".yaml", ".yml", ".toml", ".ini", ".conf", ".cfg"]);
const TEXT_EXT = new Set([".md", ".txt", ".mdx", ".js", ".mjs", ".cjs", ".ts", ".py", ".sh", ".bash", ".rb", ".go", ".rs", ".html", ".css", ".csv", ".xml", ".sql", ".jsonl"]);
const DATABASE_EXT = new Set([".db", ".sqlite", ".sqlite3"]);
const HEAVY_BYTES = 5 * 1024 * 1024;

function skipReason(name) {
  for (const [pattern, reason] of SKIPPED) if (pattern.test(name)) return reason;
  return null;
}

function isEnvFile(name) {
  return /(^|\/)\.env(\.[A-Za-z0-9_-]+)?$/.test(name) && !/\.example$|\.sample$|\.template$/.test(name);
}

function envKeys(text) {
  return [...String(text).matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)].map((m) => m[1]);
}

export function unpack(archivePath, target) {
  const entries = readZip(readFileSync(archivePath));
  const result = { extracted: 0, skipped: {}, secretsRemoved: 0, envKeys: {} };
  const skip = (reason) => (result.skipped[reason] = (result.skipped[reason] ?? 0) + 1);

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const reason = skipReason(entry.name) ?? (entry.encrypted ? "encrypted" : null);
    if (reason) {
      skip(reason);
      continue;
    }
    const dest = join(target, entry.name);
    const ext = extname(entry.name).toLowerCase();

    if (isEnvFile(entry.name)) {
      const keys = envKeys(entry.read().toString("utf8"));
      result.envKeys[entry.name] = keys;
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(`${dest}.keys.json`, JSON.stringify({ file: entry.name, keys, note: "values left behind by the migration" }, null, 2) + "\n");
      skip("secrets");
      continue;
    }

    let data;
    if (CONFIG_EXT.has(ext) || TEXT_EXT.has(ext) || ext === "") {
      if (entry.size > HEAVY_BYTES) {
        skip("heavy");
        continue;
      }
      const text = entry.read().toString("utf8");
      if (ext === ".json" || ext === ".json5") {
        try {
          const scrubbed = scrubObject(parseJson5(text));
          result.secretsRemoved += scrubbed.count;
          data = JSON.stringify(scrubbed.value, null, 2) + "\n";
        } catch {
          const scrubbed = scrubText(text, { keyLines: true });
          result.secretsRemoved += scrubbed.count;
          data = scrubbed.text;
        }
      } else {
        const scrubbed = scrubText(text, { keyLines: CONFIG_EXT.has(ext) || ext === "" });
        result.secretsRemoved += scrubbed.count;
        data = scrubbed.text;
      }
    } else if (DATABASE_EXT.has(ext)) {
      data = entry.read();
    } else {
      if (entry.size > HEAVY_BYTES) {
        skip("heavy");
        continue;
      }
      data = entry.read();
    }
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, data);
    result.extracted++;
  }
  return result;
}

if (isMain(import.meta.url)) {
  const { flags, positional } = parseArgs();
  if (flags.help || positional.length !== 1) usage(USAGE);
  const archive = resolve(process.cwd(), positional[0]);
  if (!existsSync(archive)) fail(`No file at ${positional[0]}`);
  const name = slugify(flags.name || basename(archive).replace(/\.(zip|allkin)$/i, ""));
  const target = join(migrationDir(flags), "source", name);
  if (existsSync(target)) {
    if (!flags.replace) fail(`migration/source/${name} already exists: pass --replace to extract again, or --name another`);
    rmSync(target, { recursive: true, force: true });
  }
  mkdirSync(target, { recursive: true });
  let result;
  try {
    result = unpack(archive, target);
  } catch (error) {
    rmSync(target, { recursive: true, force: true });
    fail(`Cannot read ${positional[0]}: ${error.message}`, 1);
  }
  out(
    {
      source: `migration/source/${name}`,
      ...result,
      next: `node scripts/inventory.mjs --source migration/source/${name}`,
      reminder: "Tell the user the uploaded archive still holds their secrets: they may delete it from Upload/ once the migration is done.",
    },
    EXIT_OK,
  );
}
