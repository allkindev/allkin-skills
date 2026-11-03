#!/usr/bin/env node
/**
 * check_post — checks a draft (or a bare text) against each network's rules
 * (references/networks.json) and the workspace's rules.json: length as the
 * network counts it, hashtags, mentions, links in the body, forbidden words,
 * blank lines, media (presence, count, format, size, dimensions, ratio,
 * duration), title and alt texts, empty text, duplicates of a post already
 * published (publish_log.mjs).
 *
 * Usage: node scripts/check_post.mjs <drafts/<id>> [--network <id>] [--all] [--workspace <dir>] [--md]
 *        node scripts/check_post.mjs --text "…" --network <id> [--workspace <dir>] [--md]
 *
 * For a draft: the networks are those of draft.json plus every <network>.md
 * present (--all: every known network); a network without its own <network>.md
 * is checked on master.md. Writes check.json in the draft and prints it; exit
 * 1 when an error is found (warnings leave ok true). With --text nothing is
 * written.
 */
import { existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import {
  parseArgs, usage, out, mdTable, readJson, readText, writeJson, listFiles, loadRules, workspaceDir,
  requireWorkspace, resolveDraft, networkSpec, knownNetworks, networkLength, findUrls, findHashtags,
  findMentions, findWords, isMain, EXIT_OK, EXIT_ISSUES,
} from "./lib/common.mjs";
import { checkMedia, kindOfFormat } from "./media_check.mjs";

const USAGE = `
Usage: node scripts/check_post.mjs <drafts/<id>> [--network <id>] [--all] [--workspace <dir>] [--md]
       node scripts/check_post.mjs --text "…" --network <id> [--workspace <dir>] [--md]

Checks the draft's texts and media against each network's rules and
rules.json; writes check.json in the draft. Exit 0 fine, 1 errors found
(listed in issues[]), 2 bad invocation.
`;

const THREAD_SEPARATOR = /\n---\n/;

function maxNewlineRun(text) {
  let max = 0;
  for (const m of text.matchAll(/\n+/g)) max = Math.max(max, m[0].length);
  return max;
}

async function duplicateFinder() {
  try {
    const mod = await import("./publish_log.mjs");
    if (typeof mod.findDuplicates === "function") return mod.findDuplicates;
  } catch {
    /* publish_log.mjs absent or broken: the duplicate check is skipped */
  }
  return null;
}

/**
 * Checks one network. input: { text, comment, extras, media: [paths], hasDraft }
 * context: { rules, workspace, findDuplicates }. Returns the check.json entry.
 */
export function checkNetwork(network, input, context = {}) {
  const spec = networkSpec(network);
  const rules = context.rules ?? {};
  const issues = [];
  const push = (code, message, fix = null, level = "error") => issues.push({ code, level, message, ...(fix ? { fix } : {}) });

  const text = String(input.text ?? "").replace(/\r\n?/g, "\n").trim();
  const comment = String(input.comment ?? "").trim();
  const extras = input.extras ?? {};
  const parts = text ? text.split(THREAD_SEPARATOR).map((p) => p.trim()).filter(Boolean) : [];
  const lengths = parts.map((p) => networkLength(p, spec));
  const length = lengths.length ? Math.max(...lengths) : 0;
  const max = spec.text.max;
  const label = spec.label ?? network;

  if (!text) push("empty", "the text is empty", `write ${network}.md or master.md`);

  if (length > max) {
    const over = length - max;
    if (spec.text.threads) {
      push("too-long", `${length} characters as ${label} counts them, ${max} allowed`, `shorten by ${over} or make a thread (adapt_post --network ${network})`, parts.length > 1 ? "error" : "warning");
    } else {
      push("too-long", `${length} characters as ${label} counts them, ${max} allowed`, `shorten by ${over}`);
    }
  }

  // Hashtags: body and comment together.
  const bodyTags = findHashtags(text);
  const commentTags = findHashtags(comment);
  const tagCount = bodyTags.length + commentTags.length;
  if (spec.hashtags && tagCount > spec.hashtags.max) {
    push("too-many-hashtags", `${tagCount} hashtags, ${spec.hashtags.max} allowed on ${label}`, `keep ${spec.hashtags.max}${spec.hashtags.recommended ? ` (${spec.hashtags.recommended} recommended)` : ""}`);
  }
  if (spec.hashtags?.placement === "firstComment" && bodyTags.length) {
    push("hashtags-placement", `${bodyTags.length} hashtag${bodyTags.length > 1 ? "s" : ""} in the body; ${label} wants them in the first comment`, `move them to ${network}.comment.md (adapt_post --network ${network})`, "warning");
  }

  const mentions = findMentions(text);
  if (spec.mentions && mentions.length > spec.mentions.max) {
    push("too-many-mentions", `${mentions.length} mentions, ${spec.mentions.max} allowed on ${label}`, spec.mentions.max ? `keep ${spec.mentions.max}` : "remove them");
  }

  const urls = findUrls(text);
  if (spec.links && spec.links.inBody === false && urls.length) {
    push("link-in-body", `${urls.length} link${urls.length > 1 ? "s" : ""} in the body${spec.links.note ? ` (${spec.links.note})` : ""}`, `move the link to ${network}.comment.md (adapt_post --network ${network})`);
  }

  const forbidden = findWords(`${text}\n${comment}`, rules.forbiddenWords ?? []);
  if (forbidden.length) {
    push("forbidden-word", `forbidden word${forbidden.length > 1 ? "s" : ""}: ${forbidden.join(", ")}`, "reword (rules.json forbiddenWords)");
  }

  const maxNl = spec.text.maxConsecutiveNewlines;
  if (maxNl && maxNewlineRun(text) > maxNl) {
    push("newlines", `${maxNewlineRun(text) - 1} blank lines in a row, ${maxNl - 1} allowed on ${label}`, `collapse the blank lines (adapt_post --network ${network})`, "warning");
  }

  // Media.
  const media = input.media ?? [];
  const mediaReports = [];
  if (input.hasDraft) {
    if (spec.media?.required && !media.length) {
      push("media-missing", `${label} needs a media and the draft has none`, `add a file in media/ (${Object.entries(spec.media).filter(([k]) => k !== "required").map(([k, r]) => `${k}: ${r.formats?.join("/")}`).join("; ")})`);
    }
    const counts = {};
    for (const file of media) {
      const report = checkMedia(file, spec);
      mediaReports.push(report);
      for (const issue of report.issues) issues.push(issue);
      if (report.kind) counts[report.kind] = (counts[report.kind] ?? 0) + 1;
    }
    for (const [kind, n] of Object.entries(counts)) {
      const limit = spec.media?.[kind]?.maxCount;
      if (limit && n > limit) push("media-too-many", `${n} ${kind}s, ${limit} allowed on ${label}`, `keep ${limit}`);
    }
    if (counts.image && counts.video) {
      push("media-too-many", `images and a video together; ${label} takes one kind per post`, "keep the images or the video", "warning");
    }
  }

  // Title (YouTube, Pinterest).
  if (spec.text.titleMax && input.hasDraft) {
    const title = typeof extras.title === "string" ? extras.title.trim() : "";
    if (!title) push("title-missing", `${label} needs a title (${network}.json "title")`, `write ${network}.json with { "title": "…" }`);
    else if ([...title].length > spec.text.titleMax) push("title-too-long", `title of ${[...title].length} characters, ${spec.text.titleMax} allowed`, `shorten by ${[...title].length - spec.text.titleMax}`);
  }

  // Alt texts, one per image.
  if (spec.altText && input.hasDraft) {
    const images = mediaReports.filter((r) => r.kind === "image").length;
    const alts = Array.isArray(extras.altText) ? extras.altText.filter((a) => typeof a === "string" && a.trim()) : [];
    if (images && alts.length < images) {
      push("alt-missing", `${images - alts.length} image${images - alts.length > 1 ? "s" : ""} without alt text`, `add "altText": [] in ${network}.json, one per image`, "warning");
    }
    const tooLong = alts.filter((a) => [...a].length > spec.altText.max);
    if (tooLong.length) push("alt-too-long", `${tooLong.length} alt text${tooLong.length > 1 ? "s" : ""} over ${spec.altText.max} characters`, "shorten them");
  }

  // Tags (YouTube).
  if (spec.tags?.maxTotalChars && Array.isArray(extras.tags)) {
    const total = extras.tags.join(",").length;
    if (total > spec.tags.maxTotalChars) push("tags-too-long", `tags of ${total} characters in all, ${spec.tags.maxTotalChars} allowed`, "drop some tags");
  }

  // Duplicate of a post already published.
  if (text) {
    if (context.findDuplicates) {
      try {
        const found = context.findDuplicates(context.workspace, network, text, rules);
        const matches = Array.isArray(found) ? found : found?.matches ?? found?.duplicates ?? [];
        if (matches.length) {
          const first = matches[0] ?? {};
          const when = first.publishedAt ? ` on ${String(first.publishedAt).slice(0, 10)}` : "";
          const sim = typeof first.similarity === "number" ? ` (${Math.round(first.similarity * 100)} % alike)` : "";
          push("duplicate", `the same post went out${when} on ${label}${sim}${first.url ? `: ${first.url}` : ""}`, "reword it or drop it");
        }
      } catch (error) {
        push("duplicate-check-unavailable", `duplicate check failed: ${error.message}`, null, "warning");
      }
    } else {
      push("duplicate-check-unavailable", "publish_log.mjs is not available: duplicates not checked", null, "warning");
    }
  }

  const result = { ok: !issues.some((i) => i.level === "error"), length, max, issues };
  if (parts.length > 1) result.parts = parts.length;
  if (mediaReports.length) result.media = mediaReports.map((r) => ({ file: basename(r.file), kind: r.kind, format: r.format, bytes: r.bytes, width: r.width, height: r.height, seconds: r.seconds, ratio: r.ratio }));
  return result;
}

/** What a draft folder holds for one network. */
function draftInput(dir, network, draft) {
  const own = join(dir, `${network}.md`);
  const text = existsSync(own) ? readText(own) : existsSync(join(dir, "master.md")) ? readText(join(dir, "master.md")) : "";
  const commentFile = join(dir, `${network}.comment.md`);
  const comment = existsSync(commentFile) ? readText(commentFile) : "";
  const extras = existsSync(join(dir, `${network}.json`)) ? readJson(join(dir, `${network}.json`)) : {};
  let media;
  if (Array.isArray(extras.media)) media = extras.media.map((m) => join(dir, m));
  else media = listFiles(join(dir, "media"));
  return { text, comment, extras, media, hasDraft: true, source: existsSync(own) ? basename(own) : "master.md" };
}

function networksOfDraft(dir, draft, flags) {
  if (flags.network) return [flags.network];
  if (flags.all) return knownNetworks();
  const known = new Set(knownNetworks());
  const set = new Set((draft.networks ?? []).filter((n) => known.has(n)));
  for (const name of readdirSync(dir)) {
    const m = /^([a-z][a-z0-9-]*)\.md$/.exec(name);
    if (m && known.has(m[1])) set.add(m[1]);
  }
  return [...set];
}

function toMd(report) {
  const rows = [];
  for (const [network, r] of Object.entries(report.networks)) {
    if (!r.issues.length) rows.push([network, "ok", "", `${r.length}/${r.max}`, ""]);
    for (const i of r.issues) rows.push([network, i.level, i.code, i.message, i.fix ?? ""]);
  }
  return `${report.ok ? "Fine" : "Problems found"} — ${report.checkedAt}\n\n${mdTable(["Network", "Level", "Code", "Message", "Fix"], rows)}`;
}

/* ------------------------------------------------------------------- CLI */

async function main() {
  const { command, flags } = parseArgs();
  if (flags.help || command === "--help") usage(USAGE);
  const findDuplicates = await duplicateFinder();
  const checkedAt = new Date().toISOString();

  if (flags.text !== undefined) {
    if (!flags.network || command) usage(USAGE);
    const workspace = workspaceDir(flags);
    const rules = loadRules(workspace);
    const result = checkNetwork(flags.network, { text: String(flags.text), hasDraft: false }, { rules, workspace, findDuplicates: existsSync(workspace) ? findDuplicates : null });
    const report = { checkedAt, ok: result.ok, networks: { [flags.network]: result } };
    out({ ...report, md: toMd(report) }, flags);
    process.exit(report.ok ? EXIT_OK : EXIT_ISSUES);
  }

  if (!command) usage(USAGE);
  const workspace = requireWorkspace(flags);
  const dir = resolveDraft(workspace, command);
  const draft = readJson(join(dir, "draft.json"));
  const rules = loadRules(workspace);
  const networks = networksOfDraft(dir, draft, flags);
  if (!networks.length) usage(`The draft names no network (draft.json "networks") and holds no <network>.md.\n${USAGE}`);

  const report = { checkedAt, ok: true, draft: draft.id ?? basename(dir), networks: {} };
  for (const network of networks) {
    const input = draftInput(dir, network, draft);
    const result = checkNetwork(network, input, { rules, workspace, findDuplicates });
    result.source = input.source;
    report.networks[network] = result;
    if (!result.ok) report.ok = false;
  }
  writeJson(join(dir, "check.json"), report);
  out({ ...report, md: toMd(report) }, flags);
  process.exit(report.ok ? EXIT_OK : EXIT_ISSUES);
}

if (isMain(import.meta.url)) main();
