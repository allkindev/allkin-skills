# X (service `x`)

Base `https://api.x.com/2`. The user's tier decides what answers: the free tier **writes only**
(a few hundred posts a month); reading mentions, searching, and most metrics need a paid tier.
A 402 or 403 on a read means that: say it, do not retry.

- **Who am I**: `GET /users/me` → `data.id`, `data.username`. Keep the id in `accounts.json`.
- **Publish**: `POST /tweets` body `{"text": "…"}`. A thread: post the first, then each next with
  `{"text": "…", "reply": {"in_reply_to_tweet_id": "<previous id>"}}`. Answer: `data.id`;
  url `https://x.com/<username>/status/<id>`.
- **Reply to a comment**: same call with `reply.in_reply_to_tweet_id` = the comment's id.
- **Delete**: `DELETE /tweets/<id>` (a card).
- **Mentions** (paid): `GET /users/<id>/mentions?tweet.fields=created_at,public_metrics,conversation_id&expansions=author_id&user.fields=username,name&max_results=50`.
- **Replies to our posts** (paid): `GET /tweets/search/recent?query=conversation_id:<post id>&tweet.fields=created_at,author_id,public_metrics&expansions=author_id`.
- **Metrics**: `GET /users/<id>?user.fields=public_metrics` (followers); `GET /users/<id>/tweets?tweet.fields=public_metrics,created_at&max_results=100` (per post: likes, replies, retweets, quotes, impressions, bookmarks).
- Rate limits: 429 with `x-rate-limit-reset`; wait, do not loop.
