#!/usr/bin/env node
/**
 * thread_split — splits a text into the parts of a thread, each under the
 * network's limit as the network counts it (networkLength). Cuts fall on
 * paragraph boundaries first, then sentences (. ! ? …), then words; a word or
 * a URL is never cut. The numbering (" 1/5", or "1/5 " with
 * --numbering-position start) counts in the limit; a trailing block of
 * hashtags stays with the last part.
 *
 * Usage: node scripts/thread_split.mjs --network <id> (--text "…" | --file <path>)
 *          [--max N] [--numbering n/N|none] [--numbering-position end|start]
 *
 * Prints { network, max, parts: [...], lengths: [...] }.
 * Exports splitThread(text, { max, numbering, lengthFn, position }) → string[].
 */
import {
  parseArgs, usage, out, readText, networkSpec, networkLength, findUrls, isMain, EXIT_OK,
} from "./lib/common.mjs";

const USAGE = `
Usage: node scripts/thread_split.mjs --network <id> (--text "…" | --file <path>)
         [--max N] [--numbering n/N|none] [--numbering-position end|start] [--md]

Splits the text into parts under the network's limit (paragraphs, then
sentences, then words; never inside a word or a URL). Exit 0, or 2 on a bad
invocation.
`;

const HASHTAG_LINE_RE = /^\s*(#[\p{L}\p{N}_]+\s*)+$/u;

function numberingWidth(n, total, position) {
  return position === "start" ? `${n}/${total} ` : ` ${n}/${total}`;
}

/** The trailing lines made of hashtags only → [body, hashtagBlock]. */
function detachTrailingHashtags(text) {
  const lines = text.trimEnd().split("\n");
  const tail = [];
  while (lines.length > 1 && HASHTAG_LINE_RE.test(lines[lines.length - 1])) tail.unshift(lines.pop().trim());
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return [lines.join("\n"), tail.join(" ")];
}

/** Pieces of a text at one level: paragraphs, sentences or words. */
function pieces(text, level) {
  if (level === "paragraph") return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (level === "sentence") {
    // Sentence ends: . ! ? … followed by whitespace; URLs are kept whole.
    const urls = findUrls(text);
    const tokens = [];
    let safe = text;
    urls.forEach((u, i) => { safe = safe.replace(u, `\u0000${i}\u0000`); });
    for (const s of safe.split(/(?<=[.!?…])\s+/)) {
      if (s.trim()) tokens.push(s.replace(/\u0000(\d+)\u0000/g, (_, i) => urls[Number(i)]).trim());
    }
    return tokens;
  }
  return text.split(/\s+/).filter(Boolean);
}

const JOINERS = { paragraph: "\n\n", sentence: " ", word: " " };
const NEXT_LEVEL = { paragraph: "sentence", sentence: "word", word: null };

/**
 * Greedy fill of parts at a level; a piece too long for a part alone is split
 * at the next level. `room` is the budget per part (limit minus numbering).
 */
function fill(text, level, room, lengthFn) {
  const parts = [];
  let current = "";
  const flush = () => { if (current) parts.push(current); current = ""; };
  for (const piece of pieces(text, level)) {
    if (lengthFn(piece) > room) {
      flush();
      const next = NEXT_LEVEL[level];
      if (next) parts.push(...fill(piece, next, room, lengthFn));
      else parts.push(piece); // a single word or URL longer than the room: kept whole
      continue;
    }
    const candidate = current ? current + JOINERS[level] + piece : piece;
    if (lengthFn(candidate) <= room) current = candidate;
    else { flush(); current = piece; }
  }
  flush();
  return parts;
}

/**
 * Splits `text` into parts of at most `max` (as `lengthFn` counts), numbered
 * when `numbering` is "n/N" and there is more than one part.
 * options: { max, numbering: "n/N" | "none", lengthFn, position: "end" | "start" }
 */
export function splitThread(text, options = {}) {
  const max = options.max ?? 280;
  const numbering = options.numbering ?? "n/N";
  const position = options.position ?? "end";
  const lengthFn = options.lengthFn ?? ((s) => [...s].length);
  const clean = String(text ?? "").replace(/\r\n?/g, "\n").trim();
  if (!clean) return [];
  if (lengthFn(clean) <= max) return [clean];
  const [body, hashtags] = detachTrailingHashtags(clean);

  // The numbering takes room; its width depends on the total, found by iterating.
  let total = 1;
  let parts = [];
  for (let round = 0; round < 6; round++) {
    const reserve = numbering === "none" ? 0 : lengthFn(numberingWidth(total, total, position));
    const room = Math.max(1, max - reserve);
    parts = fill(body, "paragraph", room, lengthFn);
    if (hashtags) {
      const last = parts[parts.length - 1] ?? "";
      const withTags = last ? `${last}\n\n${hashtags}` : hashtags;
      if (lengthFn(withTags) <= room) parts[parts.length - 1] = withTags;
      else parts.push(hashtags);
    }
    if (parts.length <= total) { total = parts.length; break; }
    total = parts.length;
  }
  if (parts.length <= 1 || numbering === "none") return parts;
  return parts.map((p, i) => (position === "start" ? `${i + 1}/${parts.length} ${p}` : `${p} ${i + 1}/${parts.length}`));
}

/* ------------------------------------------------------------------- CLI */

function main() {
  const { command, flags } = parseArgs();
  if (flags.help || command === "--help" || !flags.network) usage(USAGE);
  if (flags.text === undefined && !flags.file) usage(USAGE);
  const spec = networkSpec(flags.network);
  const text = flags.file ? readText(flags.file) : String(flags.text);
  const max = flags.max ? Number(flags.max) : spec.text.max;
  if (!Number.isFinite(max) || max <= 0) usage(USAGE);
  const numbering = flags.numbering ?? spec.text.threadNumbering ?? "n/N";
  if (!["n/N", "none"].includes(numbering)) usage(USAGE);
  const position = flags["numbering-position"] ?? "end";
  if (!["end", "start"].includes(position)) usage(USAGE);
  const lengthFn = (s) => networkLength(s, spec);
  const parts = splitThread(text, { max, numbering, lengthFn, position });
  const lengths = parts.map(lengthFn);
  const md = parts.map((p, i) => `### ${i + 1} (${lengths[i]}/${max})\n\n${p}`).join("\n\n");
  out({ network: flags.network, max, parts, lengths, md }, flags);
  process.exit(EXIT_OK);
}

if (isMain(import.meta.url)) main();
