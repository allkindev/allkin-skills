/**
 * YouTube Data API v3 adapter.
 *
 * comments(json): `commentThreads.list?part=snippet`
 *   { items: [{ id, snippet: { videoId, topLevelComment: { id, snippet: { textDisplay, textOriginal,
 *     authorDisplayName, authorChannelId: { value }, publishedAt } }, totalReplyCount } }] }
 * metrics(json): { channel: <channels.list?part=statistics>, videos: <videos.list?part=snippet,statistics> }
 *   channel: items[0].statistics { subscriberCount, viewCount, videoCount }
 *   videos:  items[].statistics { viewCount, likeCount, commentCount }, snippet { title, publishedAt }
 *   A bare `{ items: [...] }` is told apart by `kind` ("youtube#channel" / "youtube#video").
 */
import { account, asArray, entries, entry, fillFromPosts, post, stripHtml } from "./_shared.mjs";

export const network = "youtube";

export function videoUrl(videoId, commentId) {
  if (!videoId) return null;
  return `https://www.youtube.com/watch?v=${videoId}${commentId ? `&lc=${commentId}` : ""}`;
}

export function comments(json) {
  return entries(
    asArray(json?.items).map((t) => {
      const top = t?.snippet?.topLevelComment ?? t;
      const s = top?.snippet ?? {};
      const text = s.textOriginal ?? (s.textDisplay ? stripHtml(s.textDisplay) : null);
      const videoId = t?.snippet?.videoId ?? s.videoId ?? null;
      return entry(network, {
        id: top?.id ?? t?.id,
        text,
        kind: s.parentId ? "reply" : "comment",
        author: { id: s.authorChannelId?.value ?? null, name: s.authorDisplayName ?? null, handle: null },
        createdAt: s.publishedAt,
        url: videoUrl(videoId, top?.id ?? t?.id),
        parentPostId: videoId,
      });
    }),
  );
}

function split(json) {
  const items = asArray(json?.items);
  if (json?.channel || json?.videos) return { channel: json.channel, videos: json.videos };
  if (items.some((i) => i?.kind === "youtube#channel" || i?.statistics?.subscriberCount !== undefined)) return { channel: json, videos: null };
  if (items.length) return { channel: null, videos: json };
  return { channel: null, videos: null };
}

export function metrics(json) {
  const { channel, videos } = split(json);
  if (!channel && !videos) return { account: null, posts: [] };
  const stats = asArray(channel?.items)[0]?.statistics ?? null;
  const posts = asArray(videos?.items)
    .filter((v) => v?.id)
    .map((v) => {
      const id = typeof v.id === "object" ? v.id.videoId : v.id;
      const s = v.statistics ?? {};
      return post({
        postId: id,
        url: videoUrl(id),
        publishedAt: v.snippet?.publishedAt,
        excerpt: v.snippet?.title,
        impressions: null,
        likes: s.likeCount,
        comments: s.commentCount,
        shares: null,
        clicks: null,
        videoViews: s.viewCount,
      });
    });
  const base = account({
    followers: stats?.subscriberCount,
    impressions: null,
    engagements: null,
    clicks: null,
    videoViews: stats?.viewCount,
    posts: stats?.videoCount,
  });
  return { account: fillFromPosts(base, posts), posts };
}
