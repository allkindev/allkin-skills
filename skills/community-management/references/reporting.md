# Reporting: the indicators, their one definition

Every network counts differently. `stats_digest` brings them to these definitions, and the
report uses these words. When a network does not give a figure, the figure is **null** and the
report says "not provided", never 0.

## Account level

| Indicator | Definition | X | Facebook page | Instagram | LinkedIn | YouTube | Mastodon | Bluesky |
|---|---|---|---|---|---|---|---|---|
| **followers** | people subscribed to the account at collection time | `followers_count` | `page_fans` / `followers_count` | `followers_count` | `firstDegreeSize` (org) / connections | `subscriberCount` | `followers_count` | `followersCount` |
| **impressions** | times a post of the period was shown | sum of `impression_count` | `page_impressions` | sum of media `impressions` (or `reach` when impressions is gone) | `impressionCount` | sum of `viewCount` | null | null |
| **engagements** | interactions with the posts of the period | likes + replies + reposts + quotes + bookmarks | `page_post_engagements` | likes + comments + saved | likes + comments + shares + clicks (`engagement` × impressions when only the rate is given) | likes + comments | favourites + reblogs + replies | likes + reposts + replies + quotes |
| **clicks** | clicks on links of the posts | `url_link_clicks` when the tier gives it | `post_clicks` | null | `clickCount` | null | null | null |
| **videoViews** | views of the videos of the period | `view_count` of video tweets when given | `post_video_views` | `video_views` / `plays` | `videoViews` | `viewCount` | null | null |
| **posts** | posts published in the period | count in `published.jsonl`, else the API's list | | | | | | |

## Post level

| Field | Definition |
|---|---|
| `impressions` | times the post was shown (reach when impressions is not provided — the digest says which in `source`) |
| `engagements` | the network's sum as above |
| `likes`, `comments`, `shares`, `clicks`, `videoViews` | as named by the network: `shares` = reposts / reblogs / retweets / shares |
| `engagementRate` | engagements ÷ impressions × 100, two decimals; null without impressions |

## Derived figures (`stats_digest digest`)

- **delta** and **deltaPct** between the last collection of the period and the last of the
  previous period of the same length; null when one is missing.
- **engagementRate** of an account = Σ engagements ÷ Σ impressions × 100 over the posts of the
  period that have both.
- **topPosts**: the five posts of the period with the most engagements (ties by engagement
  rate), across networks.
- **bestSlots**: weekday × hour of publication (workspace timezone), slots with at least two
  posts, sorted by average engagement rate. Say "not enough posts" under five slots.
- **themes**: posts joined to `published.jsonl` by post id, grouped by theme: count and average
  engagement rate.

## What a report says, and does not

- Figures first, in tables; one line of reading under each table at most.
- A comparison is always against the previous period of the same length, never against a
  cherry-picked week.
- A figure the network does not provide is "not provided", with the network named.
- No "virality", no "sentiment" scores: nothing the scripts did not compute.
- Three proposals at the end, each tied to a figure of the report ("Tuesday 9:00 holds the
  best rate: move the product posts there").
