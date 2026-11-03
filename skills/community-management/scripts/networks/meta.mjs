/**
 * Meta Graph API adapter: Facebook pages, Instagram, Threads. The network is
 * the second argument.
 *
 * comments(json, network, options)
 *   facebook  `GET /<post>/comments?fields=id,message,from{id,name},created_time,permalink_url` → { data, paging }
 *   instagram `GET /<media>/comments?fields=id,text,username,timestamp` → { data }
 *   threads   `GET /<post>/replies?fields=id,text,username,timestamp,permalink` → { data }
 *   options.postId (or json.postId) names the post the comments were read under.
 * metrics(json, network)
 *   facebook  { insights: <GET /<page>/insights?metric=page_impressions,page_post_engagements,page_fans>,
 *               posts: <GET /<page>/posts?fields=id,message,created_time,permalink_url,
 *                       insights.metric(post_impressions,post_engaged_users),likes.summary(true),
 *                       comments.summary(true),shares> }
 *   instagram { account: <GET /<ig-user>?fields=followers_count,media_count>,
 *               media: <GET /<ig-user>/media?fields=id,caption,timestamp,permalink,like_count,
 *                       comments_count,media_type,insights.metric(impressions,reach,saved)> }
 *   threads   { account: <GET /<user>/threads_insights?metric=followers_count,views>,
 *               posts: <GET /<user>/threads?fields=id,text,timestamp,permalink,
 *                       insights.metric(views,likes,replies,reposts,quotes)> }
 *   A bare response ({ data: [...] }) is read as the posts (or insights) half alone.
 */
import { account, asArray, entries, entry, fillFromPosts, num, post, sumOrNull } from "./_shared.mjs";

export const networks = ["facebook", "instagram", "threads"];

/** Last value of an insights metric: `values[last].value`, or `total_value.value`. */
function metricValue(insights, name) {
  const item = asArray(insights?.data ?? insights).find((m) => m?.name === name);
  if (!item) return null;
  if (item.total_value && item.total_value.value !== undefined) return num(item.total_value.value);
  const values = asArray(item.values);
  if (!values.length) return num(item.value);
  const last = values[values.length - 1];
  const v = last?.value;
  if (v && typeof v === "object") return sumOrNull(...Object.values(v).map(num));
  return num(v);
}

export function comments(json, network, options = {}) {
  const postId = options.postId ?? json?.postId ?? json?.post?.id ?? null;
  return entries(
    asArray(json?.data).map((c) => {
      if (network === "facebook") {
        return entry(network, {
          id: c?.id,
          text: c?.message,
          kind: "comment",
          author: { id: c?.from?.id, name: c?.from?.name, handle: null },
          createdAt: c?.created_time,
          url: c?.permalink_url,
          parentPostId: c?.parent?.id ?? postId,
        });
      }
      return entry(network, {
        id: c?.id,
        text: c?.text,
        kind: "comment",
        author: { id: c?.from?.id ?? c?.user?.id ?? null, name: c?.from?.username ?? null, handle: c?.username ?? c?.from?.username ?? null },
        createdAt: c?.timestamp,
        url: c?.permalink ?? null,
        parentPostId: c?.parent_id ?? c?.replied_to?.id ?? postId,
      });
    }),
  );
}

function looksLikeInsights(resp) {
  const first = asArray(resp?.data)[0];
  return Boolean(first && typeof first.name === "string" && (first.values || first.total_value));
}

export function metrics(json, network) {
  if (network === "facebook") return facebookMetrics(json);
  if (network === "instagram") return instagramMetrics(json);
  return threadsMetrics(json);
}

function facebookMetrics(json) {
  const insights = json?.insights ?? (looksLikeInsights(json) ? json : null);
  const postsResp = json?.posts ?? (Array.isArray(json?.data) && !looksLikeInsights(json) ? json : null);
  if (!insights && !postsResp) return { account: null, posts: [] };
  const posts = asArray(postsResp?.data)
    .filter((p) => p?.id)
    .map((p) =>
      post({
        postId: p.id,
        url: p.permalink_url,
        publishedAt: p.created_time,
        excerpt: p.message,
        impressions: metricValue(p.insights, "post_impressions"),
        likes: p.likes?.summary?.total_count ?? p.reactions?.summary?.total_count,
        comments: p.comments?.summary?.total_count,
        shares: p.shares?.count,
        clicks: metricValue(p.insights, "post_clicks"),
        videoViews: metricValue(p.insights, "post_video_views"),
      }),
    );
  const base = account({
    followers: metricValue(insights, "page_fans") ?? metricValue(insights, "page_follows"),
    impressions: metricValue(insights, "page_impressions"),
    engagements: metricValue(insights, "page_post_engagements"),
    clicks: null,
    videoViews: metricValue(insights, "page_video_views"),
    posts: null,
  });
  return { account: fillFromPosts(base, posts), posts };
}

function instagramMetrics(json) {
  const acc = json?.account ?? (json?.followers_count !== undefined ? json : null);
  const media = json?.media ?? json?.posts ?? (Array.isArray(json?.data) ? json : null);
  if (!acc && !media) return { account: null, posts: [] };
  const posts = asArray(media?.data)
    .filter((m) => m?.id)
    .map((m) =>
      post({
        postId: m.id,
        url: m.permalink,
        publishedAt: m.timestamp,
        excerpt: m.caption,
        impressions: metricValue(m.insights, "impressions") ?? metricValue(m.insights, "reach"),
        likes: m.like_count,
        comments: m.comments_count,
        shares: metricValue(m.insights, "shares"),
        alsoEngaging: [metricValue(m.insights, "saved")],
        clicks: null,
        videoViews: m.media_type === "VIDEO" || m.media_type === "REELS" ? metricValue(m.insights, "plays") ?? metricValue(m.insights, "video_views") : null,
      }),
    );
  const base = account({ followers: acc?.followers_count, impressions: null, engagements: null, clicks: null, videoViews: null, posts: null });
  return { account: fillFromPosts(base, posts), posts };
}

function threadsMetrics(json) {
  const acc = json?.account ?? (looksLikeInsights(json) ? json : null);
  const postsResp = json?.posts ?? json?.threads ?? (Array.isArray(json?.data) && !looksLikeInsights(json) ? json : null);
  if (!acc && !postsResp) return { account: null, posts: [] };
  const posts = asArray(postsResp?.data)
    .filter((p) => p?.id)
    .map((p) =>
      post({
        postId: p.id,
        url: p.permalink,
        publishedAt: p.timestamp,
        excerpt: p.text,
        impressions: metricValue(p.insights, "views"),
        likes: metricValue(p.insights, "likes"),
        comments: metricValue(p.insights, "replies"),
        shares: sumOrNull(metricValue(p.insights, "reposts"), metricValue(p.insights, "quotes")),
        clicks: null,
        videoViews: null,
      }),
    );
  const followers = acc?.followers_count !== undefined ? num(acc.followers_count) : metricValue(acc, "followers_count");
  const base = account({ followers, impressions: metricValue(acc, "views"), engagements: null, clicks: null, videoViews: null, posts: null });
  return { account: fillFromPosts(base, posts), posts };
}

