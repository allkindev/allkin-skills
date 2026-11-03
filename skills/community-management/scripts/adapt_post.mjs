#!/usr/bin/env node
/**
 * adapt_post — mechanical adaptation of a draft's text to one network. The
 * wording stays the model's: this script only strips Markdown, moves hashtags
 * and links where the network wants them (first comment, end of text), adds
 * UTM tags to the campaign link (utm_link.mjs), collapses blank lines, and
 * splits into a thread (thread_split.mjs) when the text is still too long and
 * the network allows threads.
 *
 * Usage: node scripts/adapt_post.mjs <drafts/<id>> --network <id> [--from master|<network>]
 *          [--dry-run] [--link URL] [--campaign id] [--workspace <dir>]
 *
 * Writes <network>.md (thread parts separated by a line "---") and
 * <network>.comment.md when something goes to the first comment; prints
 * { network, length, max, parts, files } (with --dry-run: the texts, nothing
 * written).
 */
import { existsSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import {
  parseArgs, usage, out, readJson, readText, writeText, requireWorkspace, resolveDraft,
  networkSpec, networkLength, findUrls, findHashtags, isMain, EXIT_OK,
} from "./lib/common.mjs";
import { splitThread } from "./thread_split.mjs";

const USAGE = `
Usage: node scripts/adapt_post.mjs <drafts/<id>> --network <id> [--from master|<network>]
         [--dry-run] [--link URL] [--campaign id] [--workspace <dir>]

Adapts the draft's text (master.md, or --from <network>.md) to the network:
plain text, hashtags and links where the network wants them, UTM on the
campaign link, blank lines collapsed, a thread when allowed and needed.
Exit 0, or 2 on a bad invocation.
`;

const HASHTAG_LINE_RE = /^\s*(#[\p{L}\p{N}_]+\s*)+$/u;

/** Markdown → plain text: networks show none of it. */
export function stripMarkdown(text) {
  return String(text)
    .replace(/\r\n?/g, "\n")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[^\n]*\n?/g, ""))
    .replace(/^#{1,6}\s+(.*)$/gm, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, "$2")
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, "$1 $2")
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "$2")
    .replace(/(?<![\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/g, "$1")
    .replace(/(?<![\w_])_(?=\S)([^_\n]*?\S)_(?![\w_])/g, "$1")
    .replace(/~~(?=\S)([^~\n]*?\S)~~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^[ \t]*[-*+]\s+/gm, "• ")
    .replace(/^[ \t]*(\d+)\.\s+/gm, "$1. ")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/[ \t]+$/gm, "");
}

/** At most `max` consecutive newlines. */
export function collapseNewlines(text, max = 2) {
  if (!max || max < 1) return text;
  return text.replace(new RegExp(`\\n{${max + 1},}`, "g"), "\n".repeat(max));
}

/**
 * Tidies the blanks a removal leaves: doubled spaces, a space before a comma
 * or a full stop (never before : ; ! ? — French keeps one), empty lines.
 */
function tidy(text) {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/ +([,.])(?!\d)/g, "$1").trim())
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

/**
 * Takes the hashtags out of the body. A hashtag standing in a line of its own
 * (a trailing block) goes; one inside a sentence leaves its word without "#".
 * Returns { body, hashtags } (unique, in order of appearance).
 */
export function extractHashtags(text) {
  const hashtags = [];
  const seen = new Set();
  const add = (tag) => { const k = tag.toLowerCase(); if (!seen.has(k)) { seen.add(k); hashtags.push(tag); } };
  const lines = text.split("\n").map((line) => {
    if (HASHTAG_LINE_RE.test(line)) { findHashtags(line).forEach(add); return ""; }
    findHashtags(line).forEach(add);
    return line.replace(/(^|[^\w&/])#([\p{L}\p{N}_]+)/gu, "$1$2");
  });
  return { body: tidy(lines.join("\n")), hashtags };
}

/** Takes the URLs out of the body. Returns { body, urls }. */
export function extractUrls(text) {
  const urls = [];
  let body = text;
  for (const url of findUrls(text)) {
    if (!urls.includes(url)) urls.push(url);
    body = body.split(url).join("");
  }
  return { body: tidy(body), urls };
}

/** The same URL without its query and fragment, to recognise a link once tagged. */
function bareUrl(url) {
  return String(url).replace(/[?#].*$/, "").replace(/\/+$/, "");
}

async function utmBuilder() {
  try {
    const mod = await import("./utm_link.mjs");
    if (typeof mod.buildUtmLink === "function") return mod.buildUtmLink;
  } catch {
    /* utm_link.mjs absent: links go through unchanged */
  }
  return null;
}

/**
 * Adapts `text` for `network`. options: { spec, links: [], campaign, buildUtmLink }
 * Returns { body, comment, parts, length, max, threaded }.
 */
export function adaptText(text, network, options = {}) {
  const spec = options.spec ?? networkSpec(network);
  const placement = spec.hashtags?.placement ?? "inline";
  const maxNl = spec.text?.maxConsecutiveNewlines ?? 2;
  const lengthFn = (s) => networkLength(s, spec);
  const commentLines = [];

  let body = stripMarkdown(text);

  // Campaign links: tagged with UTM, replaced in the body or appended to it.
  const campaignLinks = (options.links ?? []).filter(Boolean);
  const build = options.buildUtmLink;
  for (const link of campaignLinks) {
    let tagged = link;
    if (build) {
      try {
        const built = build(link, network, options.campaign ?? null);
        tagged = (typeof built === "string" ? built : built?.tracked) || link;
      } catch { tagged = link; }
    }
    const inBody = findUrls(body).filter((u) => bareUrl(u) === bareUrl(link));
    if (inBody.length) for (const u of inBody) body = body.split(u).join(tagged);
    else body = `${body.trimEnd()}\n\n${tagged}`;
  }

  // Hashtags: first comment, end of the text, or left where they are.
  let hashtagLine = "";
  if (placement === "firstComment" || placement === "end") {
    const extracted = extractHashtags(body);
    body = extracted.body;
    if (extracted.hashtags.length) {
      const kept = spec.hashtags?.max ? extracted.hashtags.slice(0, spec.hashtags.max) : extracted.hashtags;
      hashtagLine = kept.join(" ");
      if (placement === "firstComment") commentLines.push(hashtagLine);
    }
  }

  // Links: out of the body into the comment when the network wants none there.
  if (spec.links && spec.links.inBody === false) {
    const extracted = extractUrls(body);
    body = extracted.body;
    if (extracted.urls.length) commentLines.unshift(extracted.urls.join("\n"));
  }

  if (placement === "end" && hashtagLine) body = `${body}\n\n${hashtagLine}`;
  body = collapseNewlines(tidy(body), maxNl);

  const max = spec.text?.max ?? Infinity;
  let parts = [body];
  let threaded = false;
  if (lengthFn(body) > max && spec.text?.threads) {
    parts = splitThread(body, { max, numbering: spec.text.threadNumbering ?? "n/N", lengthFn });
    threaded = parts.length > 1;
  }
  const comment = collapseNewlines(commentLines.join("\n\n"), maxNl).trim();
  return { body, comment, parts, threaded, max, length: Math.max(...parts.map(lengthFn)) };
}

/* ------------------------------------------------------------------- CLI */

async function main() {
  const { command, flags } = parseArgs();
  if (flags.help || command === "--help" || !command || !flags.network) usage(USAGE);
  const workspace = requireWorkspace(flags);
  const dir = resolveDraft(workspace, command);
  const draft = readJson(join(dir, "draft.json"));
  const network = flags.network;
  const spec = networkSpec(network);
  const from = flags.from && flags.from !== "master" ? `${flags.from}.md` : "master.md";
  const source = readText(join(dir, from));
  const links = [draft.link, flags.link].filter((l) => typeof l === "string" && l.trim());
  const campaign = flags.campaign ?? draft.campaign ?? draft.id ?? null;
  const result = adaptText(source, network, { spec, links: [...new Set(links)], campaign, buildUtmLink: await utmBuilder() });

  const textFile = join(dir, `${network}.md`);
  const commentFile = join(dir, `${network}.comment.md`);
  const text = result.parts.join("\n---\n");
  const files = [];
  if (flags["dry-run"]) {
    out({ network, length: result.length, max: result.max, parts: result.parts.length, threaded: result.threaded, text, comment: result.comment || null, files, dryRun: true, md: `${text}${result.comment ? `\n\n--- first comment ---\n${result.comment}` : ""}` }, flags);
    process.exit(EXIT_OK);
  }
  writeText(textFile, text);
  files.push(basename(textFile));
  if (result.comment) {
    writeText(commentFile, result.comment);
    files.push(basename(commentFile));
  } else if (existsSync(commentFile)) {
    unlinkSync(commentFile); // nothing goes to the comment any more: an old one would mislead
  }
  out({ network, length: result.length, max: result.max, parts: result.parts.length, threaded: result.threaded, files, md: `Wrote ${files.join(", ")} (${result.length}/${result.max}, ${result.parts.length} part${result.parts.length > 1 ? "s" : ""})` }, flags);
  process.exit(EXIT_OK);
}

if (isMain(import.meta.url)) main();
