/**
 * Bluesky (AT Protocol, app.bsky.*) adapter.
 *
 * comments(json): `app.bsky.notification.listNotifications`
 *   { notifications: [{ uri, cid, author: { did, handle, displayName }, reason, record: { text, createdAt, reply }, indexedAt }] }
 *   Kept: reason mention / reply / quote. reply → kind comment, the others → mention.
 *   url = https://bsky.app/profile/<handle>/post/<rkey of uri>.
 * metrics(json): { profile: <app.bsky.actor.getProfile>, feed: <app.bsky.feed.getAuthorFeed> }
 *   profile: { followersCount, postsCount }; feed: { feed: [{ post: { uri, author: { handle },
 *   record: { text, createdAt }, likeCount, replyCount, repostCount, quoteCount } }] }.
 *   A bare `{ feed: [...] }` or `{ followersCount }` is read alone.
 */
import { account, asArray, entries, entry, fillFromPosts, post } from "./_shared.mjs";

export const network = "bluesky";
const KEPT = new Set(["mention", "reply", "quote"]);

export function rkeyOf(uri) {
  if (!uri) return null;
  const parts = String(uri).split("/");
  return parts.length ? parts[parts.length - 1] : null;
}

export function postUrl(handle, uri) {
  const rkey = rkeyOf(uri);
  return handle && rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : null;
}

export function comments(json) {
  return entries(
    asArray(json?.notifications)
      .filter((n) => KEPT.has(n?.reason))
      .map((n) =>
        entry(network, {
          id: n?.uri,
          text: n?.record?.text,
          kind: n.reason === "reply" ? "comment" : "mention",
          author: { id: n?.author?.did, name: n?.author?.displayName || n?.author?.handle || null, handle: n?.author?.handle },
          createdAt: n?.record?.createdAt ?? n?.indexedAt,
          url: postUrl(n?.author?.handle, n?.uri),
          parentPostId: n?.record?.reply?.parent?.uri ?? n?.reasonSubject ?? null,
        }),
      ),
  );
}

export function metrics(json) {
  const profile = json?.profile ?? (json?.followersCount !== undefined ? json : null);
  const feedResp = json?.feed && !Array.isArray(json.feed) ? json.feed : Array.isArray(json?.feed) ? json : null;
  if (!profile && !feedResp) return { account: null, posts: [] };
  const posts = asArray(feedResp?.feed)
    .map((f) => f?.post ?? f)
    .filter((p) => p?.uri)
    .map((p) =>
      post({
        postId: p.uri,
        url: postUrl(p.author?.handle ?? profile?.handle, p.uri),
        publishedAt: p.record?.createdAt ?? p.indexedAt,
        excerpt: p.record?.text,
        impressions: null,
        likes: p.likeCount,
        comments: p.replyCount,
        shares: p.repostCount,
        alsoEngaging: [p.quoteCount],
        clicks: null,
        videoViews: null,
      }),
    );
  const base = account({ followers: profile?.followersCount, impressions: null, engagements: null, clicks: null, videoViews: null, posts: null });
  return { account: fillFromPosts(base, posts), posts };
}
