#!/usr/bin/env node
/**
 * media_check — inspects image and video files by reading their headers (no
 * library) and checks them against a network's media rules (networks.json).
 *
 * Usage: node scripts/media_check.mjs <file...> --network <id> [--kind image|video] [--md]
 *
 * Formats read: PNG (IHDR), JPEG (SOF markers), GIF (logical screen), WebP
 * (VP8 / VP8L / VP8X), MP4 / MOV (moov → mvhd duration, trak → tkhd or stsd
 * dimensions), WebM (format only), PDF (format only).
 *
 * Prints { network, files: [{ file, kind, format, bytes, width, height, seconds,
 * ratio, issues }], issues } and exits 1 when a file breaks a rule.
 * Exports inspectMedia(path) and checkMedia(path, networkSpec, kind) for check_post.
 */
import { existsSync, openSync, readSync, closeSync, statSync } from "node:fs";
import { extname, basename } from "node:path";
import {
  parseArgs, usage, out, mdTable, loadNetworks, networkSpec, isMain, EXIT_OK, EXIT_ISSUES,
} from "./lib/common.mjs";

const USAGE = `
Usage: node scripts/media_check.mjs <file...> --network <id> [--kind image|video] [--md]

Reads the headers of each file (PNG, JPEG, GIF, WebP, MP4, MOV, WebM, PDF) and
checks format, size, dimensions, ratio and duration against the network's rules.
Exit 0 fine, 1 issues found, 2 bad invocation.
`;

const EXT_FORMATS = {
  ".jpg": "jpeg", ".jpeg": "jpeg", ".png": "png", ".gif": "gif", ".webp": "webp",
  ".mp4": "mp4", ".m4v": "mp4", ".mov": "mov", ".webm": "webm", ".pdf": "pdf",
};
const VIDEO_FORMATS = new Set(["mp4", "mov", "webm"]);
const IMAGE_FORMATS = new Set(["jpeg", "png", "gif", "webp"]);

/** Kind of a format: image, video, document, or null when unknown. */
export function kindOfFormat(format) {
  if (IMAGE_FORMATS.has(format)) return "image";
  if (VIDEO_FORMATS.has(format)) return "video";
  if (format === "pdf") return "document";
  return null;
}

/* --------------------------------------------------------------- reading */

function readBytes(fd, position, length) {
  const buf = Buffer.alloc(length);
  const n = readSync(fd, buf, 0, length, position);
  return n < length ? buf.subarray(0, n) : buf;
}

function readHead(path, max = 64 * 1024) {
  const size = statSync(path).size;
  const fd = openSync(path, "r");
  try {
    return { head: readBytes(fd, 0, Math.min(size, max)), size, fd: null };
  } finally {
    closeSync(fd);
  }
}

function parsePng(b) {
  if (b.length < 24 || b.toString("latin1", 12, 16) !== "IHDR") return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function parseJpeg(b) {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker === 0xff) { i++; continue; }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    if (marker === 0xda) break; // start of scan: no SOF before it
    i += 2 + len;
  }
  return null;
}

function parseGif(b) {
  if (b.length < 10) return null;
  return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
}

function parseWebp(b) {
  if (b.length < 30) return null;
  const chunk = b.toString("latin1", 12, 16);
  const d = 20; // chunk data start
  if (chunk === "VP8 ") {
    return { width: b.readUInt16LE(d + 6) & 0x3fff, height: b.readUInt16LE(d + 8) & 0x3fff };
  }
  if (chunk === "VP8L") {
    const bits = b.readUInt32LE(d + 1);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    return { width: b.readUIntLE(d + 4, 3) + 1, height: b.readUIntLE(d + 7, 3) + 1 };
  }
  return null;
}

/** Walks the atoms of an ISO base media file (MP4 / MOV), whole file read in slices. */
function parseMp4(path, size) {
  const fd = openSync(path, "r");
  const info = { seconds: null, width: null, height: null, brand: null };
  try {
    const atoms = (start, end, depth, visit) => {
      let pos = start;
      while (pos + 8 <= end) {
        const h = readBytes(fd, pos, 16);
        if (h.length < 8) break;
        let len = h.readUInt32BE(0);
        const type = h.toString("latin1", 4, 8);
        let hdr = 8;
        if (len === 1 && h.length >= 16) { len = Number(h.readBigUInt64BE(8)); hdr = 16; }
        else if (len === 0) len = end - pos;
        if (len < hdr) break;
        visit(type, pos + hdr, Math.min(pos + len, end), depth);
        pos += len;
      }
    };
    const containers = new Set(["moov", "trak", "mdia", "minf", "stbl"]);
    const visit = (type, start, end, depth) => {
      if (type === "ftyp") {
        info.brand = readBytes(fd, start, 4).toString("latin1");
      } else if (type === "mvhd") {
        const d = readBytes(fd, start, 32);
        const version = d[0];
        if (version === 1) {
          const timescale = d.readUInt32BE(20);
          const duration = Number(d.readBigUInt64BE(24));
          if (timescale) info.seconds = duration / timescale;
        } else {
          const timescale = d.readUInt32BE(12);
          const duration = d.readUInt32BE(16);
          if (timescale) info.seconds = duration / timescale;
        }
      } else if (type === "tkhd" && !info.width) {
        const d = readBytes(fd, start, 96);
        const off = d[0] === 1 ? 88 : 76;
        if (d.length >= off + 8) {
          const w = d.readUInt32BE(off) / 65536;
          const h = d.readUInt32BE(off + 4) / 65536;
          if (w > 0 && h > 0) { info.width = Math.round(w); info.height = Math.round(h); }
        }
      } else if (type === "stsd" && !info.width) {
        const d = readBytes(fd, start, 48);
        const entryType = d.toString("latin1", 12, 16);
        if (/^(avc1|avc3|hvc1|hev1|mp4v|vp09|av01)$/.test(entryType) && d.length >= 44) {
          const w = d.readUInt16BE(40);
          const h = d.readUInt16BE(42);
          if (w > 0 && h > 0) { info.width = w; info.height = h; }
        }
      } else if (containers.has(type) && depth < 6) {
        atoms(start, end, depth + 1, visit);
      }
    };
    atoms(0, size, 0, visit);
  } finally {
    closeSync(fd);
  }
  return info;
}

function detectFormat(head) {
  const s = (a, b) => head.toString("latin1", a, b);
  if (head.length >= 8 && head.readUInt32BE(0) === 0x89504e47) return "png";
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  if (head.length >= 6 && /^GIF8[79]a$/.test(s(0, 6))) return "gif";
  if (head.length >= 12 && s(0, 4) === "RIFF" && s(8, 12) === "WEBP") return "webp";
  if (head.length >= 12 && s(4, 8) === "ftyp") {
    const brand = s(8, 12);
    return brand.startsWith("qt") ? "mov" : "mp4";
  }
  if (head.length >= 8 && /^(moov|mdat|free|wide|skip)$/.test(s(4, 8))) return "mp4";
  if (head.length >= 4 && head.readUInt32BE(0) === 0x1a45dfa3) return "webm";
  if (head.length >= 5 && s(0, 5) === "%PDF-") return "pdf";
  return null;
}

/** Nearest ratio of `ratios` ("16:9", "1.91:1") within tolerance, else the decimal. */
export function nearestRatio(width, height, ratios = [], tolerance = 0.03) {
  if (!width || !height) return null;
  const value = width / height;
  let best = null;
  for (const r of ratios) {
    const [a, b] = String(r).split(":").map(Number);
    if (!a || !b) continue;
    const target = a / b;
    const diff = Math.abs(value - target) / target;
    if (diff <= tolerance && (!best || diff < best.diff)) best = { r, diff };
  }
  return best ? best.r : String(Math.round(value * 100) / 100);
}

/**
 * Reads a file's header: { file, kind, format, bytes, width, height, seconds }.
 * `format` is null when the header is of no known kind (the extension is then
 * reported in `extension`).
 */
export function inspectMedia(path) {
  if (!existsSync(path)) return { file: path, kind: null, format: null, bytes: 0, width: null, height: null, seconds: null, missing: true };
  const { head, size } = readHead(path);
  const format = detectFormat(head);
  const extension = EXT_FORMATS[extname(path).toLowerCase()] ?? null;
  const info = { file: path, kind: kindOfFormat(format), format, extension, bytes: size, width: null, height: null, seconds: null };
  let dims = null;
  if (format === "png") dims = parsePng(head);
  else if (format === "jpeg") dims = parseJpeg(head);
  else if (format === "gif") dims = parseGif(head);
  else if (format === "webp") dims = parseWebp(head);
  else if (format === "mp4" || format === "mov") {
    const mp4 = parseMp4(path, size);
    info.seconds = mp4.seconds === null ? null : Math.round(mp4.seconds * 100) / 100;
    dims = mp4.width ? { width: mp4.width, height: mp4.height } : null;
  }
  if (dims) { info.width = dims.width; info.height = dims.height; }
  return info;
}

/**
 * Checks one file against a network spec (the whole entry of networks.json).
 * `kind` forces image | video | document; by default the format decides.
 * Returns { ...info, ratio, issues: [{ code, level, message, fix }] }.
 */
export function checkMedia(path, spec, kind = null) {
  const tolerance = loadNetworks().ratioTolerance ?? 0.03;
  const info = inspectMedia(path);
  const issues = [];
  const name = basename(path);
  const push = (code, message, fix, level = "error") => issues.push({ code, level, message, fix, file: name });
  if (info.missing) {
    push("media-missing", `${name} does not exist`, "fix the path or add the file");
    return { ...info, ratio: null, issues };
  }
  const resolvedKind = kind || info.kind || kindOfFormat(info.extension);
  const rules = resolvedKind ? spec.media?.[resolvedKind] : null;
  if (!info.format) {
    push("media-format", `${name}: unknown file format`, `use one of ${Object.values(spec.media ?? {}).flatMap((m) => m.formats ?? []).join(", ")}`);
    return { ...info, kind: resolvedKind, ratio: null, issues };
  }
  if (!rules) {
    push("media-format", `${name}: ${spec.label ?? "the network"} takes no ${resolvedKind ?? info.format}`, "remove it or pick another kind of file");
    return { ...info, kind: resolvedKind, ratio: null, issues };
  }
  if (rules.formats && !rules.formats.includes(info.format)) {
    push("media-format", `${name}: ${info.format} is not accepted (${rules.formats.join(", ")})`, `convert to ${rules.formats[0]}`);
  } else if (info.extension && info.extension !== info.format) {
    push("media-format", `${name}: the file is ${info.format} but its name says ${info.extension}`, `rename it .${info.format === "jpeg" ? "jpg" : info.format}`, "warning");
  }
  if (rules.maxBytes && info.bytes > rules.maxBytes) {
    push("media-size", `${name}: ${mb(info.bytes)} MB, ${mb(rules.maxBytes)} MB allowed`, "compress or shorten the file");
  }
  if (info.width && info.height) {
    if (rules.minWidth && info.width < rules.minWidth) {
      push("media-dimensions", `${name}: ${info.width}px wide, at least ${rules.minWidth} needed`, "use a larger picture");
    }
    if (rules.maxWidth && info.width > rules.maxWidth) {
      push("media-dimensions", `${name}: ${info.width}px wide, at most ${rules.maxWidth} allowed`, "resize it");
    }
    if (rules.minHeight && info.height < rules.minHeight) {
      push("media-dimensions", `${name}: ${info.height}px high, at least ${rules.minHeight} needed`, "use a larger picture");
    }
    if (rules.maxHeight && info.height > rules.maxHeight) {
      push("media-dimensions", `${name}: ${info.height}px high, at most ${rules.maxHeight} allowed`, "resize it");
    }
  }
  const ratio = nearestRatio(info.width, info.height, rules.ratios ?? [], tolerance);
  if (ratio && rules.ratios?.length && !rules.ratios.includes(ratio)) {
    push("media-ratio", `${name}: ratio ${ratio} (${info.width}x${info.height}), expected ${rules.ratios.join(", ")}`, `crop to ${rules.ratios[0]}`);
  }
  if (info.seconds !== null) {
    if (rules.minSeconds && info.seconds < rules.minSeconds) {
      push("media-duration", `${name}: ${info.seconds} s, at least ${rules.minSeconds} s needed`, "use a longer video");
    }
    if (rules.maxSeconds && info.seconds > rules.maxSeconds) {
      push("media-duration", `${name}: ${info.seconds} s, at most ${rules.maxSeconds} s allowed`, "cut the video");
    }
  }
  return { ...info, kind: resolvedKind, ratio, issues };
}

function mb(bytes) {
  return Math.round((bytes / 1048576) * 100) / 100;
}

/* ------------------------------------------------------------------- CLI */

function main() {
  const { command, flags, positional } = parseArgs();
  if (flags.help || command === "--help") usage(USAGE);
  const files = [command, ...positional].filter(Boolean);
  if (!files.length || !flags.network) usage(USAGE);
  if (flags.kind && !["image", "video", "document"].includes(flags.kind)) usage(USAGE);
  const spec = networkSpec(flags.network);
  const results = files.map((f) => checkMedia(f, spec, flags.kind || null));
  const issues = results.flatMap((r) => r.issues);
  const files_ = results.map(({ issues: _i, extension: _e, ...rest }) => ({ ...rest, issues: _i.map(({ file: _f, ...i }) => i) }));
  const md = mdTable(
    ["File", "Kind", "Format", "Bytes", "Size", "Seconds", "Ratio", "Issues"],
    results.map((r) => [basename(r.file), r.kind, r.format, r.bytes, r.width ? `${r.width}x${r.height}` : "", r.seconds ?? "", r.ratio ?? "", r.issues.map((i) => i.code).join(", ") || "ok"]),
  );
  out({ network: flags.network, ok: !issues.some((i) => i.level === "error"), files: files_, issues, md }, flags);
  process.exit(issues.some((i) => i.level === "error") ? EXIT_ISSUES : EXIT_OK);
}

if (isMain(import.meta.url)) main();
