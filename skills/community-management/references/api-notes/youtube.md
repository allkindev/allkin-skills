# YouTube (service `youtube`)

Base `https://www.googleapis.com/youtube/v3`. A **daily quota** (10 000 units): a list costs 1,
a comment insert 50, a video upload 1 600 — say when something would spend it. Uploading a video
needs a file: not possible yet through Allkin; the user uploads, you write the title,
description and tags, and update them.

- **My channel**: `GET /channels?part=id,snippet,statistics&mine=true` → `items[0].id`, `statistics.subscriberCount`, `viewCount`, `videoCount`.
- **My videos**: `GET /search?part=id&forMine=true&type=video&order=date&maxResults=50` → ids; then `GET /videos?part=snippet,statistics&id=<ids comma>` → `snippet.title`, `publishedAt`, `statistics.viewCount`, `likeCount`, `commentCount`.
- **Update title / description / tags**: `PUT /videos?part=snippet` `{"id": "<video id>", "snippet": {"title": "…", "description": "…", "tags": ["…"], "categoryId": "<keep the current one>"}}` — send the whole snippet: a missing field is erased.
- **Comments of a video**: `GET /commentThreads?part=snippet,replies&videoId=<id>&order=time&maxResults=50` → `items[].snippet.topLevelComment.snippet.textOriginal`, `authorDisplayName`, `publishedAt`, `totalReplyCount`.
- **Reply**: `POST /comments?part=snippet` `{"snippet": {"parentId": "<comment id>", "textOriginal": "…"}}`.
- **Moderate**: `POST /comments/setModerationStatus?id=<id>&moderationStatus=rejected` (hide), `DELETE /comments?id=<id>` (own comments only).
- **Analytics** (service scope `yt-analytics.readonly`, base `https://youtubeanalytics.googleapis.com/v2`): `GET /reports?ids=channel==MINE&startDate=<d>&endDate=<d>&metrics=views,estimatedMinutesWatched,likes,comments,shares,subscribersGained&dimensions=day`.
