/**
 * Mastodon API adapter.
 *
 * comments(json): `GET /api/v1/notifications?types[]=mention`
 *   [{ id, type, created_at, account: { id, acct, display_name, username },
 *      status: { id, content (HTML), url, in_reply_to_id, replies_count, reblogs_count, favourites_count } }]
 *   The status id is the entry's id (a notification id names the notice, not the post).
 * metrics(json): { account: <GET /api/v1/accounts/verify_credentials>, statuses: <GET /api/v1/accounts/:id/statuses> }
 *   account: { followers_count, statuses_count }; statuses: [{ id, content, created_at, url,
 *   replies_count, reblogs_count, favourites_count }]. A bare array is the statuses, a bare
 *   object with followers_count the account.
 */
import { account, asArray, entries, entry, fillFromPosts, post, stripHtml } from "./_shared.mjs";

export const network = "mastodon";

export function comments(json) {
  const list = Array.isArray(json) ? json : asArray(json?.notifications ?? json?.data);
  return entries(
    list
      .filter((n) => !n?.type || n.type === "mention")
      .map((n) => {
        const s = n?.status ?? {};
        const a = n?.account ?? s.account ?? {};
        return entry(network, {
          id: s.id ?? n?.id,
          text: stripHtml(s.content),
          kind: s.in_reply_to_id ? "comment" : "mention",
          author: { id: a.id, name: a.display_name || a.username || null, handle: a.acct ?? a.username ?? null },
          createdAt: s.created_at ?? n?.created_at,
          url: s.url,
          parentPostId: s.in_reply_to_id ?? null,
        });
      }),
  );
}

export function metrics(json) {
  const acc = json?.account ?? (!Array.isArray(json) && json?.followers_count !== undefined ? json : null);
  const statuses = Array.isArray(json) ? json : asArray(json?.statuses ?? json?.posts);
  if (!acc && !statuses.length) return { account: null, posts: [] };
  const posts = statuses
    .filter((s) => s?.id)
    .map((s) =>
      post({
        postId: s.id,
        url: s.url ?? s.uri,
        publishedAt: s.created_at,
        excerpt: stripHtml(s.content),
        impressions: null,
        likes: s.favourites_count,
        comments: s.replies_count,
        shares: s.reblogs_count,
        clicks: null,
        videoViews: null,
      }),
    );
  const base = account({ followers: acc?.followers_count, impressions: null, engagements: null, clicks: null, videoViews: null, posts: null });
  return { account: fillFromPosts(base, posts), posts };
}
