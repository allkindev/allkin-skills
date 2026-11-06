/**
 * Zip archives without a dependency: reading what the user uploaded, writing
 * the .allkin archives. Stored and deflated entries only, no zip64, no
 * encryption — what `zip`, Windows, macOS and Allkin's own export produce.
 *
 * Reading never trusts the archive: the sizes of the central directory decide
 * before anything is inflated (a bomb is refused, not decompressed), and a
 * name that climbs out of its folder, is absolute or holds a NUL is skipped.
 */
import { deflateRawSync, inflateRawSync, crc32 } from "node:zlib";

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

export const ZIP_LIMITS = {
  entries: 20000,
  entryBytes: 50 * 1024 * 1024,
  totalBytes: 400 * 1024 * 1024,
};

/** A clean relative path, or null when the name must not be extracted. */
export function safeEntryName(raw) {
  const name = String(raw).replace(/\\/g, "/");
  if (!name || name.includes("\0") || name.startsWith("/") || /^[A-Za-z]:/.test(name)) return null;
  const parts = [];
  for (const part of name.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") return null;
    parts.push(part);
  }
  return parts.length ? parts.join("/") : null;
}

/**
 * The entries of a zip: [{ name, size, isDirectory, read() }]. `read()`
 * inflates one entry. Throws on what is not a zip or is too large.
 */
export function readZip(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip archive");
  const count = buffer.readUInt16LE(eocd + 10);
  const cdOffset = buffer.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdOffset === 0xffffffff) throw new Error("zip64 archives are not supported: zip the folder again with a smaller selection");
  if (count > ZIP_LIMITS.entries) throw new Error(`too many entries (${count}, at most ${ZIP_LIMITS.entries})`);

  const entries = [];
  let total = 0;
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (p + 46 > buffer.length || buffer.readUInt32LE(p) !== CENTRAL) throw new Error("damaged zip archive (central directory)");
    const flags = buffer.readUInt16LE(p + 8);
    const method = buffer.readUInt16LE(p + 10);
    const compressed = buffer.readUInt32LE(p + 20);
    const size = buffer.readUInt32LE(p + 24);
    const nameLength = buffer.readUInt16LE(p + 28);
    const extraLength = buffer.readUInt16LE(p + 30);
    const commentLength = buffer.readUInt16LE(p + 32);
    const localOffset = buffer.readUInt32LE(p + 42);
    const rawName = buffer.subarray(p + 46, p + 46 + nameLength).toString(flags & 0x800 ? "utf8" : "latin1");
    p += 46 + nameLength + extraLength + commentLength;

    const isDirectory = rawName.endsWith("/");
    const name = safeEntryName(rawName);
    if (!name) continue;
    if (!isDirectory) {
      if (size > ZIP_LIMITS.entryBytes) throw new Error(`${name} is too large (${size} bytes)`);
      total += size;
      if (total > ZIP_LIMITS.totalBytes) throw new Error("the archive is too large once decompressed");
    }
    entries.push({
      name,
      size,
      isDirectory,
      encrypted: Boolean(flags & 1),
      read() {
        if (flags & 1) throw new Error(`${name} is encrypted`);
        if (buffer.readUInt32LE(localOffset) !== LOCAL) throw new Error(`damaged zip archive (${name})`);
        const start = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
        const data = buffer.subarray(start, start + compressed);
        if (method === 0) return Buffer.from(data);
        if (method === 8) return inflateRawSync(data, { maxOutputLength: Math.max(size, 1) });
        throw new Error(`${name}: compression method ${method} not supported`);
      },
    });
  }
  return entries;
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/** A zip of [{ name, data }] (data a Buffer or a string), deflated, UTF-8 names. */
export function writeZip(files, date = new Date()) {
  const { time, day } = dosDateTime(date);
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(String(file.data), "utf8");
    const deflated = deflateRawSync(data);
    const stored = deflated.length >= data.length;
    const body = stored ? data : deflated;
    const crc = crc32(data) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(stored ? 0 : 8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const cdSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(EOCD, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
