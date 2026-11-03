/**
 * Tests of the text and media scripts: check_post, adapt_post, thread_split,
 * media_check, networks. Fixtures (a workspace, tiny real PNG / JPEG / GIF /
 * MP4 files) are generated in a temporary folder.
 *
 * Run from the skill folder: node --test tests/text-media.test.mjs
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(SKILL, "scripts");

import { networkSpec, networkLength } from "../scripts/lib/common.mjs";
import { splitThread } from "../scripts/thread_split.mjs";
import { inspectMedia, checkMedia } from "../scripts/media_check.mjs";
import { adaptText, stripMarkdown } from "../scripts/adapt_post.mjs";
import { validateNetworks } from "../scripts/networks.mjs";

/* ---------------------------------------------------------------- fixtures */

function png(width, height) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write("IHDR", 4, "latin1");
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8; ihdr[17] = 6; // 8-bit RGBA
  const idat = Buffer.from([0, 0, 0, 1, 0x49, 0x44, 0x41, 0x54, 0x00, 0, 0, 0, 0]);
  const iend = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  return Buffer.concat([sig, ihdr, idat, iend]);
}

function jpeg(width, height) {
  const soi = Buffer.from([0xff, 0xd8]);
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const sof0 = Buffer.alloc(19);
  sof0[0] = 0xff; sof0[1] = 0xc0; sof0.writeUInt16BE(17, 2); sof0[4] = 8;
  sof0.writeUInt16BE(height, 5); sof0.writeUInt16BE(width, 7); sof0[9] = 3;
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([soi, app0, sof0, eoi]);
}

function gif(width, height) {
  const b = Buffer.alloc(13);
  b.write("GIF89a", 0, "latin1");
  b.writeUInt16LE(width, 6); b.writeUInt16LE(height, 8);
  return Buffer.concat([b, Buffer.from([0x3b])]);
}

function atom(type, payload) {
  const h = Buffer.alloc(8);
  h.writeUInt32BE(8 + payload.length, 0);
  h.write(type, 4, "latin1");
  return Buffer.concat([h, payload]);
}

function mp4({ width, height, seconds, brand = "isom" }) {
  const ftyp = atom("ftyp", Buffer.concat([Buffer.from(brand, "latin1"), Buffer.from([0, 0, 2, 0]), Buffer.from("isommp41", "latin1")]));
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(1000, 12); // timescale
  mvhd.writeUInt32BE(Math.round(seconds * 1000), 16); // duration
  const tkhd = Buffer.alloc(84);
  tkhd.writeUInt32BE(Math.round(width * 65536), 76);
  tkhd.writeUInt32BE(Math.round(height * 65536), 80);
  const moov = atom("moov", Buffer.concat([atom("mvhd", mvhd), atom("trak", atom("tkhd", tkhd))]));
  const mdat = atom("mdat", Buffer.alloc(16));
  return Buffer.concat([ftyp, moov, mdat]);
}

let root;
let ws;
const drafts = {};

function makeDraft(id, draft, files) {
  const dir = join(ws, "drafts", id);
  mkdirSync(join(dir, "media"), { recursive: true });
  writeFileSync(join(dir, "draft.json"), JSON.stringify({ id, calendarId: id, networks: [], theme: "product", link: null, campaign: null, createdAt: "2026-11-01T00:00:00Z", ...draft }, null, 2));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  drafts[id] = dir;
  return dir;
}

function run(script, args, options = {}) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, `${script}.mjs`), ...args, "--workspace", ws], { encoding: "utf-8", cwd: root, ...options });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* --md or no JSON */ }
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

const codes = (result, network) => result.networks[network].issues.map((i) => i.code);
const issue = (result, network, code) => result.networks[network].issues.find((i) => i.code === code);

const LONG_X = Array.from({ length: 6 }, (_, i) => `Phrase numéro ${i + 1} qui raconte ce que fait Allkin pour vos agents, avec quelques détails.`).join(" ");

before(() => {
  root = mkdtempSync(join(tmpdir(), "community-test-"));
  ws = join(root, "community");
  mkdirSync(ws, { recursive: true });
  writeFileSync(join(ws, "line.md"), "# Editorial line\n");
  writeFileSync(join(ws, "rules.json"), JSON.stringify({ duplicateWindowDays: 30, duplicateSimilarity: 0.9, forbiddenWords: ["gratuit", "100% garanti"] }));
  writeFileSync(join(ws, "published.jsonl"), "");

  // One draft for x, linkedin and instagram: too long for X, a link and hashtags in the body, no media.
  makeDraft("2026-11-05-launch", { networks: ["x", "linkedin", "instagram"], link: "https://allk.in/offre", campaign: "autumn" }, {
    "master.md": `# Lancement\n\n**L'offre d'automne** est là : _un agent_ pour chaque équipe.\n\n${LONG_X}\n\nDétails : https://allk.in/offre\n\n\n\n#Allkin #Agents #Lancement`,
  });

  // A draft whose text is fine but says a forbidden word, with pictures for X.
  makeDraft("2026-11-06-free", { networks: ["x"] }, {
    "x.md": "Essai GRATUIT pendant un mois, écrivez-nous.",
    "media/01.png": png(1200, 675),
    "media/02.jpg": jpeg(400, 400),
  });

  // A YouTube draft with a video and no title.
  makeDraft("2026-11-07-video", { networks: ["youtube"] }, {
    "youtube.md": "La démo d'Allkin en trois minutes.",
    "media/01.mp4": mp4({ width: 1920, height: 1080, seconds: 180 }),
  });

  // An Instagram draft already adapted: hashtags in the comment, a square picture.
  makeDraft("2026-11-08-insta", { networks: ["instagram"] }, {
    "instagram.md": "Une image vaut mille agents.",
    "instagram.comment.md": "#Allkin #Agents",
    "instagram.json": JSON.stringify({ altText: ["Le logo d'Allkin"] }),
    "media/01.jpg": jpeg(1080, 1080),
  });
});

after(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

/* -------------------------------------------------------------- check_post */

test("check_post: too long on X is a warning that suggests a thread", () => {
  const r = run("check_post", ["drafts/2026-11-05-launch", "--network", "x"]);
  assert.equal(r.code, 0, r.stderr);
  const tooLong = issue(r.json, "x", "too-long");
  assert.ok(tooLong, "too-long expected");
  assert.equal(tooLong.level, "warning");
  assert.match(tooLong.fix, /adapt_post --network x/);
  assert.ok(r.json.networks.x.length > 280);
  assert.equal(r.json.networks.x.max, 280);
  assert.ok(existsSync(join(drafts["2026-11-05-launch"], "check.json")));
});

test("check_post: a link in the body on LinkedIn is an error; a blank-line run is a warning", () => {
  const r = run("check_post", ["drafts/2026-11-05-launch", "--network", "linkedin"]);
  assert.equal(r.code, 1);
  assert.ok(codes(r.json, "linkedin").includes("link-in-body"));
  assert.equal(issue(r.json, "linkedin", "link-in-body").level, "error");
  assert.equal(issue(r.json, "linkedin", "newlines").level, "warning");
  assert.equal(r.json.ok, false);
});

test("check_post: Instagram wants hashtags in the first comment and a media", () => {
  const r = run("check_post", ["drafts/2026-11-05-launch", "--network", "instagram"]);
  assert.equal(r.code, 1);
  const c = codes(r.json, "instagram");
  assert.ok(c.includes("hashtags-placement"));
  assert.equal(issue(r.json, "instagram", "hashtags-placement").level, "warning");
  assert.ok(c.includes("media-missing"));
  assert.ok(c.includes("link-in-body"));
});

test("check_post: the whole draft writes check.json with every network", () => {
  const r = run("check_post", ["drafts/2026-11-05-launch"]);
  assert.equal(r.code, 1);
  assert.deepEqual(Object.keys(r.json.networks).sort(), ["instagram", "linkedin", "x"]);
  const written = JSON.parse(readFileSync(join(drafts["2026-11-05-launch"], "check.json"), "utf-8"));
  assert.equal(written.ok, false);
  assert.ok(written.checkedAt);
  assert.equal(Object.keys(written.networks).length, 3);
});

test("check_post: a forbidden word, case-insensitive, on whole words; media reported", () => {
  const r = run("check_post", ["drafts/2026-11-06-free"]);
  assert.equal(r.code, 1);
  const f = issue(r.json, "x", "forbidden-word");
  assert.ok(f);
  assert.match(f.message, /gratuit/);
  // 400px JPEG is under X's 600px minimum, and 1:1 of 400x400 is accepted as a ratio.
  assert.ok(codes(r.json, "x").includes("media-dimensions"));
  assert.ok(!codes(r.json, "x").includes("media-ratio"));
  assert.equal(r.json.networks.x.media.length, 2);
  assert.equal(r.json.networks.x.media[0].ratio, "16:9");
  // No <x>.json: alt texts missing is a warning.
  assert.equal(issue(r.json, "x", "alt-missing").level, "warning");
});

test("check_post: forbidden word matching does not fire inside another word", () => {
  const r = run("check_post", ["--text", "Gratuité : un mot qui contient le mot interdit sans l'être.", "--network", "x"]);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(!codes(r.json, "x").includes("forbidden-word"));
});

test("check_post: YouTube needs a title; the video is read", () => {
  const r = run("check_post", ["drafts/2026-11-07-video"]);
  assert.equal(r.code, 1);
  assert.ok(codes(r.json, "youtube").includes("title-missing"));
  const video = r.json.networks.youtube.media[0];
  assert.equal(video.kind, "video");
  assert.equal(video.format, "mp4");
  assert.equal(video.width, 1920);
  assert.equal(video.height, 1080);
  assert.equal(video.seconds, 180);
  assert.equal(video.ratio, "16:9");
  writeFileSync(join(drafts["2026-11-07-video"], "youtube.json"), JSON.stringify({ title: "x".repeat(120) }));
  const r2 = run("check_post", ["drafts/2026-11-07-video"]);
  assert.ok(codes(r2.json, "youtube").includes("title-too-long"));
});

test("check_post: a well-formed Instagram draft passes", () => {
  const r = run("check_post", ["drafts/2026-11-08-insta"]);
  assert.equal(r.code, 0, JSON.stringify(r.json?.networks?.instagram?.issues) + r.stderr);
  assert.equal(r.json.ok, true);
  const c = codes(r.json, "instagram");
  assert.ok(!c.includes("hashtags-placement"));
  assert.ok(!c.includes("alt-missing"));
});

test("check_post: --text checks a bare text and writes nothing; empty text is an error", () => {
  const r = run("check_post", ["--text", "Un texte court. #a #b #c #d", "--network", "x"]);
  assert.equal(r.code, 1);
  assert.ok(codes(r.json, "x").includes("too-many-hashtags"));
  const e = run("check_post", ["--text", "", "--network", "x"]);
  assert.equal(e.code, 1);
  assert.ok(codes(e.json, "x").includes("empty"));
});

test("check_post: --md and --help", () => {
  const md = run("check_post", ["drafts/2026-11-05-launch", "--network", "x", "--md"]);
  assert.match(md.stdout, /\| Network \| Level \|/);
  const help = run("check_post", ["--help"]);
  assert.equal(help.code, 2);
  assert.match(help.stderr, /Usage:/);
});

/* -------------------------------------------------------------- adapt_post */

test("adapt_post: LinkedIn gets no link in the body, hashtags at the end, the link in the comment", () => {
  const r = run("adapt_post", ["drafts/2026-11-05-launch", "--network", "linkedin"]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.files, ["linkedin.md", "linkedin.comment.md"]);
  const body = readFileSync(join(drafts["2026-11-05-launch"], "linkedin.md"), "utf-8");
  const comment = readFileSync(join(drafts["2026-11-05-launch"], "linkedin.comment.md"), "utf-8");
  assert.ok(!/https?:\/\//.test(body), "no link in the body");
  assert.ok(!/\*\*|^#\s/m.test(body), "no Markdown left");
  assert.match(body, /L'offre d'automne est là/);
  assert.ok(body.trimEnd().endsWith("#Allkin #Agents #Lancement"), body);
  assert.ok(!/\n{3,}/.test(body), "blank lines collapsed");
  assert.match(comment, /https:\/\/allk\.in\/offre\?utm_source=linkedin&utm_medium=social&utm_campaign=autumn/);
  const check = run("check_post", ["drafts/2026-11-05-launch", "--network", "linkedin"]);
  assert.equal(check.code, 0, JSON.stringify(check.json?.networks?.linkedin?.issues));
});

test("adapt_post: Instagram gets its hashtags in the first comment; a hashtag inside a sentence keeps its word", () => {
  const r = run("adapt_post", ["drafts/2026-11-05-launch", "--network", "instagram", "--dry-run"]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.dryRun, true);
  assert.ok(!existsSync(join(drafts["2026-11-05-launch"], "instagram.md")), "dry run writes nothing");
  assert.ok(!/#/.test(r.json.text));
  assert.match(r.json.comment, /#Allkin #Agents #Lancement/);
  assert.match(r.json.comment, /https:\/\/allk\.in\/offre\?utm_source=instagram/);
  const inline = adaptText("Nous aimons #Allkin et ses agents.\n\n#Agents", "instagram");
  assert.equal(inline.body, "Nous aimons Allkin et ses agents.");
  assert.equal(inline.comment, "#Allkin #Agents");
});

test("adapt_post: X keeps hashtags inline and splits into a thread when too long", () => {
  const r = run("adapt_post", ["drafts/2026-11-05-launch", "--network", "x"]);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(r.json.parts > 1, "a thread");
  assert.equal(r.json.threaded, true);
  assert.ok(r.json.length <= 280);
  const text = readFileSync(join(drafts["2026-11-05-launch"], "x.md"), "utf-8");
  const parts = text.split(/\n---\n/);
  assert.equal(parts.length, r.json.parts);
  const spec = networkSpec("x");
  for (const p of parts) assert.ok(networkLength(p.trim(), spec) <= 280);
  assert.match(parts[parts.length - 1], /#Allkin #Agents #Lancement \d+\/\d+\s*$/);
  assert.match(text, /utm_source=x/);
  const check = run("check_post", ["drafts/2026-11-05-launch", "--network", "x"]);
  assert.equal(check.code, 0, JSON.stringify(check.json?.networks?.x?.issues));
  assert.equal(check.json.networks.x.parts, r.json.parts);
});

test("stripMarkdown: headings, emphasis, links, lists", () => {
  assert.equal(stripMarkdown("# Titre\n\n**gras** et _italique_, [lire](https://a.b/c) `code`\n\n- un\n- deux"), "Titre\n\ngras et italique, lire https://a.b/c code\n\n• un\n• deux");
});

/* ------------------------------------------------------------ thread_split */

test("splitThread: parts under the limit, numbered, no word cut, hashtags on the last part", () => {
  const spec = networkSpec("x");
  const lengthFn = (s) => networkLength(s, spec);
  const text = `${LONG_X} Et un lien https://allk.in/une-adresse-assez-longue-pour-compter. Fin.\n\n#Allkin #Agents`;
  const parts = splitThread(text, { max: 280, numbering: "n/N", lengthFn });
  assert.ok(parts.length >= 3);
  parts.forEach((p, i) => {
    assert.ok(lengthFn(p) <= 280, `part ${i + 1}: ${lengthFn(p)}`);
    assert.ok(p.endsWith(` ${i + 1}/${parts.length}`), p);
  });
  const words = new Set(text.replace(/\s+/g, " ").split(" "));
  const bodies = parts.map((p) => p.replace(/ \d+\/\d+$/, ""));
  for (const w of bodies.join(" ").split(/\s+/)) assert.ok(words.has(w), `cut word: ${w}`);
  assert.ok(bodies[bodies.length - 1].includes("#Allkin #Agents"));
  assert.ok(bodies.join(" ").includes("https://allk.in/une-adresse-assez-longue-pour-compter."));
});

test("splitThread: a short text is one part without numbering; none keeps parts bare; start puts the number first", () => {
  assert.deepEqual(splitThread("Court.", { max: 280 }), ["Court."]);
  const none = splitThread("Un deux trois quatre cinq six sept huit neuf dix", { max: 20, numbering: "none" });
  assert.ok(none.length > 1);
  none.forEach((p) => assert.ok(!/\d+\/\d+/.test(p) && p.length <= 20));
  const start = splitThread("Un deux trois quatre cinq six sept huit neuf dix", { max: 20, position: "start" });
  start.forEach((p, i) => assert.ok(p.startsWith(`${i + 1}/${start.length} `) && p.length <= 20, p));
});

test("thread_split CLI prints parts and lengths", () => {
  const r = run("thread_split", ["--network", "bluesky", "--text", LONG_X]);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(r.json.parts.length > 1);
  assert.deepEqual(r.json.lengths, r.json.parts.map((p) => [...p].length));
  r.json.lengths.forEach((n) => assert.ok(n <= 300));
});

/* ------------------------------------------------------------- media_check */

test("inspectMedia reads PNG, JPEG, GIF, MP4 and MOV headers", () => {
  const dir = join(root, "media");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "a.png"), png(1, 1));
  writeFileSync(join(dir, "b.jpg"), jpeg(1280, 720));
  writeFileSync(join(dir, "c.gif"), gif(640, 480));
  writeFileSync(join(dir, "d.mp4"), mp4({ width: 1080, height: 1920, seconds: 12.5 }));
  writeFileSync(join(dir, "e.mov"), mp4({ width: 1920, height: 1080, seconds: 200, brand: "qt  " }));
  writeFileSync(join(dir, "f.txt"), "hello");
  const a = inspectMedia(join(dir, "a.png"));
  assert.deepEqual([a.format, a.kind, a.width, a.height], ["png", "image", 1, 1]);
  const b = inspectMedia(join(dir, "b.jpg"));
  assert.deepEqual([b.format, b.width, b.height], ["jpeg", 1280, 720]);
  const c = inspectMedia(join(dir, "c.gif"));
  assert.deepEqual([c.format, c.width, c.height], ["gif", 640, 480]);
  const d = inspectMedia(join(dir, "d.mp4"));
  assert.deepEqual([d.format, d.kind, d.width, d.height, d.seconds], ["mp4", "video", 1080, 1920, 12.5]);
  const e = inspectMedia(join(dir, "e.mov"));
  assert.deepEqual([e.format, e.seconds], ["mov", 200]);
  assert.equal(inspectMedia(join(dir, "f.txt")).format, null);
});

test("checkMedia applies the network's rules", () => {
  const dir = join(root, "media");
  const x = networkSpec("x");
  assert.deepEqual(checkMedia(join(dir, "b.jpg"), x).issues, []);
  assert.equal(checkMedia(join(dir, "b.jpg"), x).ratio, "16:9");
  const tooSmall = checkMedia(join(dir, "a.png"), x);
  assert.ok(tooSmall.issues.some((i) => i.code === "media-dimensions"));
  const tooLong = checkMedia(join(dir, "e.mov"), x);
  assert.ok(tooLong.issues.some((i) => i.code === "media-duration"));
  const linkedinMov = checkMedia(join(dir, "e.mov"), networkSpec("linkedin"));
  assert.ok(linkedinMov.issues.some((i) => i.code === "media-format"));
  const tiktok = checkMedia(join(dir, "d.mp4"), networkSpec("tiktok"));
  assert.deepEqual(tiktok.issues, []);
  assert.equal(tiktok.ratio, "9:16");
  const unknown = checkMedia(join(dir, "f.txt"), x);
  assert.equal(unknown.issues[0].code, "media-format");
  const missing = checkMedia(join(dir, "nope.png"), x);
  assert.equal(missing.issues[0].code, "media-missing");
});

test("media_check CLI: exit 1 on an issue, --md table", () => {
  const dir = join(root, "media");
  const bad = run("media_check", [join(dir, "a.png"), join(dir, "b.jpg"), "--network", "x"]);
  assert.equal(bad.code, 1);
  assert.equal(bad.json.files.length, 2);
  assert.equal(bad.json.ok, false);
  const good = run("media_check", [join(dir, "b.jpg"), "--network", "x", "--md"]);
  assert.equal(good.code, 0);
  assert.match(good.stdout, /\| b\.jpg \| image \| jpeg \|/);
  assert.equal(run("media_check", ["--help"]).code, 2);
});

/* ---------------------------------------------------------------- networks */

test("networks --validate passes on the shipped file and catches a broken one", () => {
  const r = run("networks", ["--validate"]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.networks, 10);
  const broken = validateNetworks({ networks: { x: { label: "X", text: {}, hashtags: {}, links: {}, media: { image: { formats: [] } } }, "Bad Id": null } });
  const codes_ = broken.map((i) => i.code);
  for (const c of ["text-max", "hashtags-max", "links-in-body", "media-image-formats", "id", "spec"]) assert.ok(codes_.includes(c), c);
  assert.ok(validateNetworks({}).length === 1);
});

test("networks: the table and one sheet", () => {
  const all = run("networks", []);
  assert.equal(all.code, 0);
  assert.equal(all.json.networks.length, 10);
  assert.equal(all.json.networks.find((n) => n.network === "linkedin").linksInBody, false);
  const one = run("networks", ["--network", "youtube"]);
  assert.equal(one.json.text.titleMax, 100);
  assert.equal(one.json.media.required, true);
  const md = run("networks", ["--network", "x", "--md"]);
  assert.match(md.stdout, /^## X \(x\)/);
  assert.equal(run("networks", ["--network", "myspace"]).code, 2);
  assert.equal(run("networks", ["--help"]).code, 2);
});
