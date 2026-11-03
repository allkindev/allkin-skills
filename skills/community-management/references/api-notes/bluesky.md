# Bluesky (service `bluesky`)

Base `https://bsky.social/xrpc` (the user's PDS). The service opens the session with an **app
password**; every call is an XRPC method. Open, no review.

- **Who am I**: `GET /app.bsky.actor.getProfile?actor=<handle>` → `did`, `handle`, `followersCount`, `postsCount`.
- **Publish**: `POST /com.atproto.repo.createRecord` `{"repo": "<did>", "collection": "app.bsky.feed.post", "record": {"$type": "app.bsky.feed.post", "text": "…", "createdAt": "<ISO now>", "langs": ["fr"], "facets": [...]}}` → `uri` (at://…/app.bsky.feed.post/<rkey>), `cid`. Url: `https://bsky.app/profile/<handle>/post/<rkey>`.
  **Facets** make links and hashtags clickable: for each URL or #tag, `{"index": {"byteStart": <UTF-8 byte offset>, "byteEnd": …}, "features": [{"$type": "app.bsky.richtext.facet#link", "uri": "https://…"}]}` (or `#tag` with `"tag": "name"`). Byte offsets, not characters: compute them on the UTF-8 encoding of the text. A thread: `"reply": {"root": {"uri", "cid"}, "parent": {"uri", "cid"}}` of the previous post. Images need a blob upload: not possible yet.
- **Delete**: `POST /com.atproto.repo.deleteRecord` `{"repo": "<did>", "collection": "app.bsky.feed.post", "rkey": "<rkey>"}`.
- **Mentions, replies, quotes**: `GET /app.bsky.notification.listNotifications?limit=50` → `notifications[]` with `reason` (mention, reply, quote, like, repost, follow), `author.handle`, `record.text`, `uri`, `indexedAt`. Keep mention / reply / quote for the inbox.
- **Reply**: a `createRecord` with `reply` set to the notification's `uri`/`cid` (root = the thread's first post).
- **Metrics**: `GET /app.bsky.feed.getAuthorFeed?actor=<did>&limit=50` → `feed[].post` (`likeCount`, `replyCount`, `repostCount`, `quoteCount`, `record.createdAt`, `uri`). No impressions on Bluesky.
- **Search / watch**: `GET /app.bsky.feed.searchPosts?q=<words>&limit=25`.
