/**
 * LinkedIn (Marketing API, versioned REST) adapter.
 *
 * comments(json): `GET /rest/socialActions/{urn}/comments`
 *   { elements: [{ id, $URN, actor, "actor~": { localizedFirstName, localizedLastName, vanityName },
 *     message: { text }, created: { time (ms) }, object, parentComment }] }
 *   `actor` is a person or organization URN; the name is only there when the call projected it.
 * metrics(json): { statistics: <organizationalEntityShareStatistics>, followers: <networkSizes>,
 *   posts: <GET /rest/posts?author=urn> }
 *   statistics: { elements: [{ totalShareStatistics: { impressionCount, likeCount, commentCount,
 *     shareCount, clickCount, engagement }, share? }] } — an element without `share` is the whole page.
 *   followers: { firstDegreeSize }. posts: { elements: [{ id, commentary, publishedAt | createdAt (ms) }] }.
 *   A bare `{ elements: [{ totalShareStatistics }] }` or `{ firstDegreeSize }` is read alone.
 */
import { account, asArray, entries, entry, fillFromPosts, num, post } from "./_shared.mjs";

export const network = "linkedin";

export function postUrl(urn) {
  return urn ? `https://www.linkedin.com/feed/update/${urn}` : null;
}

function actorName(c) {
  const a = c?.["actor~"] ?? c?.actorDetails ?? null;
  if (!a) return null;
  const name = [a.localizedFirstName, a.localizedLastName].filter(Boolean).join(" ") || a.localizedName || a.name || null;
  return name ? String(name) : null;
}

export function comments(json) {
  return entries(
    asArray(json?.elements).map((c) =>
      entry(network, {
        id: c?.id ?? (c?.$URN ? String(c.$URN).split(",").pop().replace(/\)$/, "") : null),
        text: c?.message?.text,
        kind: c?.parentComment ? "reply" : "comment",
        author: { id: c?.actor, name: actorName(c), handle: c?.["actor~"]?.vanityName ?? null },
        createdAt: c?.created?.time,
        url: postUrl(c?.object),
        parentPostId: c?.object,
      }),
    ),
  );
}

export function metrics(json) {
  const statsResp = json?.statistics ?? (asArray(json?.elements).some((e) => e?.totalShareStatistics) ? json : null);
  const followersResp = json?.followers ?? (json?.firstDegreeSize !== undefined ? json : null);
  const postsResp = json?.posts ?? null;
  if (!statsResp && !followersResp && !postsResp) return { account: null, posts: [] };

  const postInfo = new Map();
  for (const p of asArray(postsResp?.elements)) {
    if (p?.id) postInfo.set(String(p.id), p);
  }
  const perShare = asArray(statsResp?.elements).filter((e) => e?.share || e?.ugcPost);
  const whole = asArray(statsResp?.elements).find((e) => e?.totalShareStatistics && !e.share && !e.ugcPost);

  const posts = perShare.map((e) => {
    const urn = String(e.share ?? e.ugcPost);
    const s = e.totalShareStatistics ?? {};
    const info = postInfo.get(urn) ?? {};
    return post({
      postId: urn,
      url: postUrl(urn),
      publishedAt: info.publishedAt ?? info.createdAt ?? null,
      excerpt: info.commentary ?? null,
      impressions: s.impressionCount,
      likes: s.likeCount,
      comments: s.commentCount,
      shares: s.shareCount,
      clicks: s.clickCount,
      alsoEngaging: [s.clickCount],
      videoViews: null,
    });
  });
  // Posts known but without statistics still count as published.
  for (const [urn, info] of postInfo) {
    if (!posts.some((p) => p.postId === urn)) {
      posts.push(post({ postId: urn, url: postUrl(urn), publishedAt: info.publishedAt ?? info.createdAt, excerpt: info.commentary, impressions: null, likes: null, comments: null, shares: null, clicks: null, videoViews: null }));
    }
  }

  const ws = whole?.totalShareStatistics ?? {};
  const base = account({
    followers: followersResp?.firstDegreeSize,
    impressions: ws.impressionCount,
    engagements: whole ? sumOfNums(ws.likeCount, ws.commentCount, ws.shareCount, ws.clickCount) : null,
    clicks: ws.clickCount,
    videoViews: null,
    posts: null,
  });
  return { account: fillFromPosts(base, posts), posts };
}

function sumOfNums(...values) {
  let total = null;
  for (const v of values) {
    const n = num(v);
    if (n !== null) total = (total ?? 0) + n;
  }
  return total;
}

