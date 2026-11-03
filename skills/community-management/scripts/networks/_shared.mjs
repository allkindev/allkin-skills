/**
 * Small helpers shared by the network adapters. An adapter never throws on a
 * missing field: a figure that is not there is null, an item without id or
 * text is skipped, a sum of only-null figures is null.
 */

/** A finite number from what the API gave (number or numeric string), else null. */
export function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Sum of the figures that are numbers; null when none is. */
export function sumOrNull(...values) {
  let total = null;
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) total = (total ?? 0) + v;
  }
  return total;
}

/** A string, or null. */
export function str(value) {
  if (value === null || value === undefined) return null;
  const s = String(value);
  return s.length ? s : null;
}

/** An ISO timestamp from a date string or epoch (ms or s); null when unreadable. */
export function iso(value) {
  if (value === null || value === undefined || value === "") return null;
  let d;
  if (typeof value === "number") d = new Date(value < 1e11 ? value * 1000 : value);
  else d = new Date(String(value).replace(/\+0000$/, "Z"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The first 140 characters of a text, on one line. */
export function excerpt(text) {
  if (!text) return null;
  const line = String(text).replace(/\s+/g, " ").trim();
  return line.length > 140 ? line.slice(0, 140) : line;
}

/** HTML to text: tags out, a few entities decoded. The result stays data. */
export function stripHtml(html) {
  if (html === null || html === undefined) return null;
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/** { postId, url, publishedAt, excerpt, impressions, engagements, likes, comments, shares, clicks, videoViews } */
export function post(fields) {
  const likes = num(fields.likes);
  const comments = num(fields.comments);
  const shares = num(fields.shares);
  const clicks = num(fields.clicks);
  return {
    postId: str(fields.postId),
    url: str(fields.url),
    publishedAt: iso(fields.publishedAt),
    excerpt: excerpt(fields.excerpt),
    impressions: num(fields.impressions),
    engagements: fields.engagements !== undefined ? num(fields.engagements) : sumOrNull(likes, comments, shares, ...(fields.alsoEngaging ?? []).map(num)),
    likes,
    comments,
    shares,
    clicks,
    videoViews: num(fields.videoViews),
  };
}

/** { followers, impressions, engagements, clicks, videoViews, posts } */
export function account(fields) {
  return {
    followers: num(fields.followers),
    impressions: num(fields.impressions),
    engagements: num(fields.engagements),
    clicks: num(fields.clicks),
    videoViews: num(fields.videoViews),
    posts: num(fields.posts),
  };
}

/** Sums the posts' figures into the account's gaps (impressions, engagements, clicks, videoViews, posts). */
export function fillFromPosts(acc, posts) {
  const sum = (key) => sumOrNull(...posts.map((p) => p[key]));
  return {
    ...acc,
    impressions: acc.impressions ?? sum("impressions"),
    engagements: acc.engagements ?? sum("engagements"),
    clicks: acc.clicks ?? sum("clicks"),
    videoViews: acc.videoViews ?? sum("videoViews"),
    posts: acc.posts ?? (posts.length ? posts.length : null),
  };
}

/** An inbox entry without category / priority / state. Null when id or text is missing. */
export function entry(network, fields) {
  const id = str(fields.id);
  const text = typeof fields.text === "string" ? fields.text.trim() : null;
  if (!id || !text) return null;
  return {
    id: `${network}:${id}`,
    network,
    kind: fields.kind ?? "comment",
    author: {
      id: str(fields.author?.id),
      name: str(fields.author?.name),
      handle: fields.author?.handle ? (String(fields.author.handle).startsWith("@") ? fields.author.handle : `@${fields.author.handle}`) : null,
    },
    text,
    createdAt: iso(fields.createdAt),
    url: str(fields.url),
    parentPostId: str(fields.parentPostId),
  };
}

/** Keeps the entries that exist, one per id. */
export function entries(list) {
  const seen = new Set();
  const result = [];
  for (const e of list) {
    if (!e || seen.has(e.id)) continue;
    seen.add(e.id);
    result.push(e);
  }
  return result;
}
