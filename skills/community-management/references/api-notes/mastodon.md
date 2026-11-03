# Mastodon (service `mastodon`)

Base: the instance the user chose (`https://<instance>/api`). Open, stable, no review, no quota
to speak of (300 calls per 5 minutes): the network to test the whole chain on.

- **Who am I**: `GET /v1/accounts/verify_credentials` → `id`, `acct`, `followers_count`, `statuses_count`, `url`.
- **Publish**: `POST /v1/statuses` `{"status": "…", "visibility": "public", "language": "fr", "spoiler_text": "…" (optional content warning)}` → `id`, `url`. A thread: add `"in_reply_to_id": "<previous id>"`. Media: `POST /v2/media` wants a file — not possible yet.
- **Delete**: `DELETE /v1/statuses/<id>`.
- **Mentions and replies**: `GET /v1/notifications?types[]=mention&limit=40` → `[].status` (`id`, `content` is HTML — the adapter strips it —, `account.acct`, `created_at`, `url`, `in_reply_to_id`).
- **Reply**: `POST /v1/statuses` with `in_reply_to_id` and the author's `@acct` at the start of the text.
- **Hide / block**: `POST /v1/accounts/<id>/mute` or `/block` (a card). Report: `POST /v1/reports`.
- **Metrics**: `GET /v1/accounts/<id>/statuses?limit=40&exclude_replies=true` → per post `replies_count`, `reblogs_count`, `favourites_count`, `created_at`, `url`. No impressions on Mastodon: the rate cannot be computed, the report says so.
- **Search / watch**: `GET /v2/search?q=<words>&type=statuses&limit=20` (full-text search depends on the instance); hashtag timeline `GET /v1/timelines/tag/<tag>`.
