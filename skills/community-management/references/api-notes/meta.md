# Facebook, Instagram, Threads (service `meta`)

Graph API, base `https://graph.facebook.com/v21.0` (the version is the service's). The token is
a **page** token for Facebook and Instagram; Threads has its own API and token
(`https://graph.threads.net`). Publishing to a page or an Instagram professional account needs
the application's review for `pages_manage_posts`, `instagram_content_publish`: before it, only
the accounts of the app's roles work — a 200 in test, a 403 in production means that.

## Facebook page
- **Pages of the user**: `GET /me/accounts` → `data[].id`, `name`, `access_token` (Allkin keeps it).
- **Publish text (+ link)**: `POST /<page-id>/feed` `{"message": "…", "link": "https://…"}`.
- **Comments of a post**: `GET /<post-id>/comments?fields=id,message,from{id,name},created_time,permalink_url&limit=50`.
- **Reply**: `POST /<comment-id>/comments` `{"message": "…"}`. **Hide**: `POST /<comment-id>` `{"is_hidden": true}`. **Delete**: `DELETE /<comment-id>`.
- **Metrics**: `GET /<page-id>/insights?metric=page_impressions,page_post_engagements,page_fans&period=day&since=<date>&until=<date>`; per post `GET /<page-id>/posts?fields=id,message,created_time,permalink_url,shares,likes.summary(true),comments.summary(true),insights.metric(post_impressions,post_clicks,post_engaged_users)`.

## Instagram (professional account linked to the page)
- **Account id**: `GET /<page-id>?fields=instagram_business_account` → `.id`.
- **Publish**: two steps — `POST /<ig-user-id>/media` `{"image_url": "https://…", "caption": "…"}` (the image must be reachable by URL: no file sending yet) → `id`; then `POST /<ig-user-id>/media_publish` `{"creation_id": "<id>"}`. The hashtags of `<network>.comment.md` go as a comment: `POST /<media-id>/comments` `{"message": "…"}`.
- **Comments**: `GET /<media-id>/comments?fields=id,text,username,timestamp,like_count`; **reply**: `POST /<comment-id>/replies` `{"message": "…"}`; **hide**: `POST /<comment-id>` `{"hide": true}`.
- **Metrics**: `GET /<ig-user-id>?fields=followers_count,media_count`; `GET /<ig-user-id>/media?fields=id,caption,timestamp,permalink,like_count,comments_count,media_type,media_product_type&limit=50`; per media `GET /<media-id>/insights?metric=impressions,reach,saved` (`plays` for a reel, `impressions` is gone for recent media: use `reach`).

## Threads
- **Publish**: `POST /<threads-user-id>/threads` `{"media_type": "TEXT", "text": "…"}` → `id`; then `POST /<threads-user-id>/threads_publish` `{"creation_id": "<id>"}`. A reply: add `"reply_to_id": "<post id>"`.
- **Replies to our post**: `GET /<post-id>/replies?fields=id,text,username,timestamp,permalink`.
- **Metrics**: `GET /<post-id>/insights?metric=views,likes,replies,reposts,quotes`; `GET /<threads-user-id>/threads_insights?metric=views,likes,followers_count`.
