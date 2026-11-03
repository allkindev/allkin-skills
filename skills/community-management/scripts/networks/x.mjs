/**
 * X (Twitter) API v2 adapter.
 *
 * comments(json, options): `GET /2/users/:id/mentions` or `/2/tweets/search/recent`
 *   { data: [{ id, text, author_id, created_at, conversation_id, in_reply_to_user_id,
 *     referenced_tweets, public_metrics }], includes: { users: [{ id, name, username }] } }
 *   options.accountId: our user id, to tell a comment under our post (in_reply_to_user_id
 *   is ours) from a mention elsewhere.
 * metrics(json): `GET /2/users/:id?user.fields=public_metrics` ({ data: { public_metrics } })
 *   and/or `GET /2/users/:id/tweets?tweet.fields=public_metrics,created_at` ({ data: [...] }).
 *   A file may hold both as { user: <users response>, tweets: <tweets response> }.
 */
import { account, asArray, entries, entry, fillFromPosts, num, post, str, sumOrNull } from "./_shared.mjs";

export const network = "x";

function usersById(json) {
  const map = new Map();
  for (const u of asArray(json?.includes?.users)) if (u?.id) map.set(String(u.id), u);
  return map;
}

export function statusUrl(username, id) {
  if (!id) return null;
  return username ? `https://x.com/${username}/status/${id}` : `https://x.com/i/web/status/${id}`;
}

export function comments(json, options = {}) {
  const users = usersById(json);
  const ours = options.accountId ? String(options.accountId) : null;
  return entries(
    asArray(json?.data).map((t) => {
      const user = users.get(String(t?.author_id ?? "")) ?? {};
      const repliedTo = asArray(t?.referenced_tweets).find((r) => r?.type === "replied_to");
      const replyTo = t?.in_reply_to_user_id ? String(t.in_reply_to_user_id) : null;
      let kind = "mention";
      if (replyTo && (!ours || replyTo === ours)) kind = "comment";
      return entry(network, {
        id: t?.id,
        text: t?.text,
        kind,
        author: { id: t?.author_id, name: user.name, handle: user.username },
        createdAt: t?.created_at,
        url: statusUrl(user.username, t?.id),
        parentPostId: repliedTo?.id ?? t?.conversation_id ?? null,
      });
    }),
  );
}

export function metrics(json) {
  const userResp = json?.user ?? (json?.data && !Array.isArray(json.data) && json.data.public_metrics ? json : null);
  const tweetsResp = json?.tweets ?? json?.posts ?? (Array.isArray(json?.data) ? json : null);
  const user = userResp?.data ?? (userResp?.public_metrics ? userResp : null);
  const username = str(user?.username) ?? str(json?.username);

  const posts = asArray(tweetsResp?.data)
    .filter((t) => t?.id)
    .map((t) => {
      const m = t.public_metrics ?? {};
      return post({
        postId: t.id,
        url: statusUrl(username, t.id),
        publishedAt: t.created_at,
        excerpt: t.text,
        impressions: m.impression_count,
        likes: m.like_count,
        comments: m.reply_count,
        shares: sumOrNull(num(m.retweet_count), num(m.quote_count)),
        alsoEngaging: [m.bookmark_count],
        clicks: null,
        videoViews: null,
      });
    });

  if (!user && !tweetsResp) return { account: null, posts: [] };
  const base = account({
    followers: user?.public_metrics?.followers_count,
    impressions: null,
    engagements: null,
    clicks: null,
    videoViews: null,
    posts: null,
  });
  return { account: fillFromPosts(base, posts), posts };
}
