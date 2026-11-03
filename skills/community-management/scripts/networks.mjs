#!/usr/bin/env node
/**
 * networks — shows the limits of one network (references/networks.json) in a
 * compact sheet, or a table of every network; --validate checks the file's
 * structure.
 *
 * Usage: node scripts/networks.mjs [--network <id>] [--validate] [--md]
 *
 * Prints the sheet { network, label, text, hashtags, links, media, notes } or
 * { networks: [...] }; with --validate { ok, issues } (exit 1 on a problem).
 */
import { parseArgs, usage, out, mdTable, loadNetworks, networkSpec, knownNetworks, isMain, EXIT_OK, EXIT_ISSUES } from "./lib/common.mjs";

const USAGE = `
Usage: node scripts/networks.mjs [--network <id>] [--validate] [--md]

Without flags: a table of every network (label, max text, hashtags, links in
body, media required, threads). --network <id>: one network's sheet.
--validate: checks networks.json (text.max, hashtags.max, links.inBody, media
for every network) and exits 1 on a problem.
`;

/** Structural problems of networks.json, as [{ network, code, message }]. */
export function validateNetworks(data = loadNetworks()) {
  const issues = [];
  const push = (network, code, message) => issues.push({ network, code, level: "error", message });
  if (!data || typeof data.networks !== "object" || !data.networks) {
    push(null, "networks-missing", "no \"networks\" object");
    return issues;
  }
  if (data.ratioTolerance !== undefined && !(typeof data.ratioTolerance === "number" && data.ratioTolerance >= 0)) {
    push(null, "ratio-tolerance", "ratioTolerance must be a number >= 0");
  }
  const isPos = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;
  for (const [id, spec] of Object.entries(data.networks)) {
    if (!/^[a-z][a-z0-9-]*$/.test(id)) push(id, "id", "a network id is lower-case letters, digits and dashes");
    if (!spec || typeof spec !== "object") { push(id, "spec", "not an object"); continue; }
    if (typeof spec.label !== "string" || !spec.label) push(id, "label", "label missing");
    if (!spec.text || !isPos(spec.text.max)) push(id, "text-max", "text.max missing or not a positive number");
    if (spec.text?.titleMax !== undefined && !isPos(spec.text.titleMax)) push(id, "title-max", "text.titleMax must be a positive number");
    if (spec.text?.threads !== undefined && typeof spec.text.threads !== "boolean") push(id, "threads", "text.threads must be a boolean");
    if (spec.text?.counting && !["plain", "x", "mastodon", "graphemes"].includes(spec.text.counting)) push(id, "counting", `unknown counting "${spec.text.counting}"`);
    if (!spec.hashtags || typeof spec.hashtags.max !== "number" || spec.hashtags.max < 0) push(id, "hashtags-max", "hashtags.max missing or negative");
    if (spec.hashtags?.placement && !["inline", "end", "firstComment"].includes(spec.hashtags.placement)) push(id, "hashtags-placement", `unknown placement "${spec.hashtags.placement}"`);
    if (spec.mentions && typeof spec.mentions.max !== "number") push(id, "mentions-max", "mentions.max must be a number");
    if (!spec.links || typeof spec.links.inBody !== "boolean") push(id, "links-in-body", "links.inBody missing or not a boolean");
    if (!spec.media || typeof spec.media !== "object") { push(id, "media", "media object missing"); continue; }
    for (const [kind, rules] of Object.entries(spec.media)) {
      if (kind === "required") { if (typeof rules !== "boolean") push(id, "media-required", "media.required must be a boolean"); continue; }
      if (!rules || typeof rules !== "object") { push(id, `media-${kind}`, `media.${kind} is not an object`); continue; }
      if (!Array.isArray(rules.formats) || !rules.formats.length) push(id, `media-${kind}-formats`, `media.${kind}.formats missing`);
      for (const key of ["maxCount", "maxBytes", "minWidth", "maxWidth", "minSeconds", "maxSeconds", "maxPages"]) {
        if (rules[key] !== undefined && !isPos(rules[key])) push(id, `media-${kind}-${key}`, `media.${kind}.${key} must be a positive number`);
      }
      if (rules.ratios !== undefined) {
        if (!Array.isArray(rules.ratios) || rules.ratios.some((r) => !/^\d+(\.\d+)?:\d+(\.\d+)?$/.test(String(r)))) {
          push(id, `media-${kind}-ratios`, `media.${kind}.ratios must be a list like ["16:9", "1.91:1"]`);
        }
      }
    }
    if (spec.altText && !isPos(spec.altText.max)) push(id, "alt-max", "altText.max must be a positive number");
  }
  return issues;
}

function mediaSummary(media) {
  return Object.entries(media)
    .filter(([k]) => k !== "required")
    .map(([kind, r]) => {
      const bits = [r.formats?.join("/")];
      if (r.maxCount) bits.push(`x${r.maxCount}`);
      if (r.maxBytes) bits.push(`≤${Math.round(r.maxBytes / 1048576)} MB`);
      if (r.minWidth) bits.push(`≥${r.minWidth}px`);
      if (r.maxSeconds) bits.push(`≤${r.maxSeconds}s`);
      if (r.ratios) bits.push(r.ratios.join(" "));
      return `${kind}: ${bits.filter(Boolean).join(", ")}`;
    });
}

export function networkSheet(id) {
  const spec = networkSpec(id);
  const notes = [];
  for (const [key, group] of Object.entries(spec)) {
    if (group && typeof group === "object" && typeof group.note === "string") notes.push(`${key}: ${group.note}`);
  }
  if (spec.bestHoursHint) notes.push(`best hours: ${spec.bestHoursHint}`);
  return {
    network: id,
    label: spec.label,
    service: spec.service ?? null,
    text: { max: spec.text.max, recommended: spec.text.recommended ?? null, counting: spec.text.counting ?? "plain", threads: Boolean(spec.text.threads), titleMax: spec.text.titleMax ?? null, maxConsecutiveNewlines: spec.text.maxConsecutiveNewlines ?? null },
    hashtags: { max: spec.hashtags.max, recommended: spec.hashtags.recommended ?? null, placement: spec.hashtags.placement ?? "inline" },
    mentions: { max: spec.mentions?.max ?? null },
    links: { inBody: spec.links.inBody, preview: Boolean(spec.links.preview) },
    media: { required: Boolean(spec.media.required), summary: mediaSummary(spec.media) },
    altText: spec.altText ?? null,
    notes,
  };
}

function sheetMd(s) {
  const rows = [
    ["Text", `${s.text.max} max${s.text.recommended ? ` (${s.text.recommended} recommended)` : ""}, counted ${s.text.counting}${s.text.threads ? ", threads" : ""}${s.text.titleMax ? `, title ≤ ${s.text.titleMax}` : ""}`],
    ["Hashtags", `${s.hashtags.max} max${s.hashtags.recommended ? ` (${s.hashtags.recommended} recommended)` : ""}, ${s.hashtags.placement}`],
    ["Mentions", s.mentions.max ?? "—"],
    ["Links in body", s.links.inBody ? "yes" : "no"],
    ["Media", `${s.media.required ? "required; " : ""}${s.media.summary.join("; ")}`],
    ["Alt text", s.altText ? `≤ ${s.altText.max}` : "—"],
  ];
  return `## ${s.label} (${s.network})\n\n${mdTable(["Rule", "Value"], rows)}${s.notes.length ? `\n\nNotes:\n${s.notes.map((n) => `- ${n}`).join("\n")}` : ""}`;
}

/* ------------------------------------------------------------------- CLI */

function main() {
  const { command, flags } = parseArgs();
  if (flags.help || command === "--help" || command) usage(USAGE);
  if (flags.validate) {
    const issues = validateNetworks();
    out({ ok: !issues.length, networks: knownNetworks().length, issues, md: issues.length ? mdTable(["Network", "Code", "Problem"], issues.map((i) => [i.network ?? "", i.code, i.message])) : "networks.json: fine" }, flags);
    process.exit(issues.length ? EXIT_ISSUES : EXIT_OK);
  }
  if (flags.network) {
    const sheet = networkSheet(flags.network);
    out({ ...sheet, md: sheetMd(sheet) }, flags);
    process.exit(EXIT_OK);
  }
  const rows = knownNetworks().map((id) => {
    const s = networkSpec(id);
    return { network: id, label: s.label, textMax: s.text.max, hashtagsMax: s.hashtags.max, hashtagsPlacement: s.hashtags.placement ?? "inline", linksInBody: s.links.inBody, mediaRequired: Boolean(s.media.required), threads: Boolean(s.text.threads) };
  });
  const md = mdTable(
    ["Network", "Label", "Max text", "Hashtags", "Links in body", "Media required", "Threads"],
    rows.map((r) => [r.network, r.label, r.textMax, `${r.hashtagsMax} (${r.hashtagsPlacement})`, r.linksInBody ? "yes" : "no", r.mediaRequired ? "yes" : "no", r.threads ? "yes" : "no"]),
  );
  out({ networks: rows, md }, flags);
  process.exit(EXIT_OK);
}

if (isMain(import.meta.url)) main();
