#!/usr/bin/env node
/**
 * init_workspace — puts the template workspace in place, or checks one.
 *
 *   node scripts/init_workspace.mjs [--workspace dir]
 *   node scripts/init_workspace.mjs [--workspace dir] --check
 *
 * Copies assets/workspace/ of the competence into the workspace and creates
 * the folders the template cannot carry (drafts/, inbox/raw/, stats/raw/,
 * watch/, reports/). An existing file is never overwritten. With --check,
 * nothing is written: every expected file and folder is looked for and every
 * JSON / JSONL file parsed; exit 1 lists what is missing or broken.
 *
 * Output: { workspace, created: [...], kept: [...] } or
 *         { workspace, ok, issues: [...] } with --check.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, copyFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { EXIT_ISSUES, EXIT_OK, SKILL_ROOT, out, parseArgs, usage, workspaceDir } from "./lib/common.mjs";

const USAGE = `
Usage: node scripts/init_workspace.mjs [--workspace dir] [--check]
  --workspace dir  the workspace (default: community, or $COMMUNITY_WORKSPACE)
  --check          verify the structure, write nothing (exit 1 when something is missing)
`;

const TEMPLATE = join(SKILL_ROOT, "assets", "workspace");
/** Folders the template has no file for, relative to the workspace. */
const FOLDERS = ["drafts", "inbox/raw", "stats/raw", "watch", "reports"];

/** Every file of the template, as a path relative to it. */
function templateFiles(dir = TEMPLATE, base = TEMPLATE) {
  const files = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...templateFiles(path, base));
    else files.push(relative(base, path));
  }
  return files;
}

function init(workspace) {
  const created = [];
  const kept = [];
  mkdirSync(workspace, { recursive: true });
  const hadFolder = Object.fromEntries(FOLDERS.map((f) => [f, existsSync(join(workspace, f))]));
  for (const rel of templateFiles()) {
    const target = join(workspace, rel);
    if (existsSync(target)) {
      kept.push(rel);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(TEMPLATE, rel), target);
    created.push(rel);
  }
  for (const folder of FOLDERS) {
    mkdirSync(join(workspace, folder), { recursive: true });
    (hadFolder[folder] ? kept : created).push(folder + "/");
  }
  return { workspace, created, kept };
}

function parseIssues(workspace, rel) {
  const path = join(workspace, rel);
  const text = readFileSync(path, "utf-8");
  if (rel.endsWith(".json")) {
    try {
      JSON.parse(text);
    } catch (error) {
      return [`${rel}: not valid JSON (${error.message})`];
    }
  } else if (rel.endsWith(".jsonl")) {
    const bad = [];
    text.split("\n").forEach((line, i) => {
      if (!line.trim()) return;
      try {
        JSON.parse(line);
      } catch {
        bad.push(`${rel}: line ${i + 1} is not valid JSON`);
      }
    });
    return bad;
  }
  return [];
}

function check(workspace) {
  const issues = [];
  if (!existsSync(workspace)) {
    return { workspace, ok: false, issues: ["workspace folder missing"] };
  }
  for (const rel of templateFiles()) {
    const target = join(workspace, rel);
    if (!existsSync(target)) issues.push(`missing file: ${rel}`);
    else if (!statSync(target).isFile()) issues.push(`not a file: ${rel}`);
    else issues.push(...parseIssues(workspace, rel));
  }
  for (const folder of FOLDERS) {
    const target = join(workspace, folder);
    if (!existsSync(target)) issues.push(`missing folder: ${folder}/`);
    else if (!statSync(target).isDirectory()) issues.push(`not a folder: ${folder}/`);
  }
  // Files the other scripts write, when present, must parse too.
  for (const rel of ["published.jsonl", "stats/digest.json", "inbox/triage.json", "inbox/answered.jsonl"]) {
    const target = join(workspace, rel);
    if (existsSync(target) && statSync(target).isFile()) {
      const found = parseIssues(workspace, rel);
      for (const issue of found) if (!issues.includes(issue)) issues.push(issue);
    }
  }
  return { workspace, ok: issues.length === 0, issues };
}

function main() {
  const { command, flags } = parseArgs();
  if (flags.help || command) usage(USAGE);
  const workspace = workspaceDir(flags);
  if (flags.check) {
    const result = check(workspace);
    out(result, flags);
    process.exit(result.ok ? EXIT_OK : EXIT_ISSUES);
  }
  out(init(workspace), flags);
  process.exit(EXIT_OK);
}

main();
