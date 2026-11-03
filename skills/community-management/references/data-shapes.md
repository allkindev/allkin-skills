# Data shapes of the workspace

Every script reads and writes these files, in these shapes, and nothing else. A field not
listed is kept as it is (scripts never drop unknown fields). Dates are ISO 8601 (`YYYY-MM-DD`
or a full timestamp in UTC). Ids are strings.

## Conventions shared by every script

- Invocation: `node <skill>/scripts/<name>.mjs <command> [positional] [--flag value]`, from the
  agent's folder. `--workspace <dir>` names the workspace (default `community` under the
  current folder, or `$COMMUNITY_WORKSPACE`). `--md` asks for Markdown instead of JSON when the
  script has a readable form.
- Output: one JSON object on stdout (short: the model reads it), errors on stderr.
- Exit code: `0` fine, `1` problems found (listed in the JSON, `issues[]`), `2` bad invocation
  or missing file.
- No network, no `child_process`, no dependency, Node 22. `scripts/lib/common.mjs` holds the
  helpers (args, files, networks.json, text measures, dates, output).
- The network ids are those of `references/networks.json`: `x`, `facebook`, `instagram`,
  `threads`, `linkedin`, `youtube`, `tiktok`, `mastodon`, `bluesky`, `pinterest`.

## `accounts.json`

```json
{
  "timezone": "Europe/Paris",
  "country": "FR",
  "accounts": [
    { "network": "x", "service": "x", "handle": "@allkin", "name": "Allkin", "id": "123", "language": "fr", "tier": 1 }
  ]
}
```

`tier`: 0 none (the user pastes), 1 writes, 2 reads too, 3 metrics too. `service` is the id of
the Allkin service to call for that account.

## `calendar.json`

```json
{
  "entries": [
    {
      "id": "2026-11-05-launch",
      "date": "2026-11-05",
      "time": "09:00",
      "networks": ["x", "linkedin"],
      "theme": "product",
      "title": "Launch of the autumn offer",
      "state": "ready",
      "draft": "drafts/2026-11-05-launch",
      "actionId": null,
      "notes": ""
    }
  ]
}
```

`state`: `idea` → `draft` → `ready` → `scheduled` → `published`, or `cancelled`. `time` is local
to `accounts.json`'s timezone. `draft` is a path relative to the workspace, or null.

## `drafts/<id>/`

```
draft.json          { "id", "calendarId", "networks": [], "theme", "link", "campaign", "createdAt" }
master.md           the message of substance, written by the agent
<network>.md        the text as it will be posted on that network
<network>.comment.md  optional: the first comment (hashtags, link) when the network wants it there
<network>.json      optional structured extras: { "title", "altText": [], "tags": [] } (YouTube title, alt texts…)
media/              the files to attach, in posting order (01-….jpg, 02-….mp4); a media listed in
                    <network>.json "media": ["media/01.jpg"] applies to that network only
check.json          the last verdict of check_post (shape below)
```

## `check.json` (written by `check_post`)

```json
{
  "checkedAt": "2026-11-01T10:00:00Z",
  "ok": false,
  "networks": {
    "x": {
      "ok": false,
      "length": 291,
      "max": 280,
      "issues": [
        { "code": "too-long", "level": "error", "message": "291 characters as X counts them, 280 allowed", "fix": "shorten by 11 or make a thread (adapt_post --network x)" }
      ]
    }
  }
}
```

Issue codes: `too-long`, `too-many-hashtags`, `too-many-mentions`, `link-in-body`,
`forbidden-word`, `newlines`, `media-missing`, `media-too-many`, `media-format`, `media-size`,
`media-ratio`, `media-duration`, `media-dimensions`, `duplicate`, `title-missing`,
`title-too-long`, `alt-missing` (warning), `alt-too-long`, `empty`. `level` is `error` or
`warning`; only errors make `ok` false and exit 1.

## `published.jsonl` (one line per post that went out)

```json
{ "id": "pub-…", "draftId": "2026-11-05-launch", "calendarId": "2026-11-05-launch", "network": "x", "account": "@allkin", "publishedAt": "2026-11-05T08:00:12Z", "postId": "178…", "url": "https://x.com/allkin/status/178…", "fingerprint": "…", "excerpt": "first 140 chars", "theme": "product", "actionId": null }
```

## `inbox/raw/<network>-<anything>.json`

The raw answer of the network's API, as Allkin wrote it to a file (or as the agent saved it).
The file name starts with the network id (`x-mentions-2026-11-01.json`): that prefix picks the
adapter. For `meta`, the prefix is the network (`facebook-`, `instagram-`, `threads-`).

## `inbox/triage.json` (written by `inbox_triage`)

```json
{
  "updatedAt": "…",
  "entries": [
    {
      "id": "x:1788…",
      "network": "x",
      "kind": "comment",
      "author": { "id": "…", "name": "…", "handle": "@…" },
      "text": "…",
      "createdAt": "…",
      "url": "https://…",
      "parentPostId": "…",
      "category": "question",
      "priority": 3,
      "signals": ["question-mark"],
      "state": "todo",
      "suggestedAnswer": null,
      "ingestedAt": "…",
      "answeredAt": null
    }
  ]
}
```

`kind`: `comment` (under one of our posts), `mention` (we are named elsewhere), `message`
(private), `reply` (an answer to our comment). `category`: `urgent`, `complaint`, `question`,
`lead`, `praise`, `mention`, `spam`, `abuse`, `other`. `priority`: 1 (first) to 9. `state`:
`todo`, `answered`, `ignored`. Ingesting again never changes `state`, `suggestedAnswer` or
`answeredAt` of an entry already there.

## `inbox/answered.jsonl`

```json
{ "entryId": "x:1788…", "network": "x", "answeredAt": "…", "answer": "the text sent", "postId": "…" }
```

## `stats/raw/<network>-<anything>.json`

The raw metrics answer of the API, prefix = network, as for the inbox.

## `stats/<network>.jsonl` (written by `stats_digest ingest`, one line per collection)

```json
{
  "network": "x",
  "collectedAt": "2026-11-01T07:00:00Z",
  "account": { "followers": 1200, "impressions": 54000, "engagements": 1300, "clicks": 210, "videoViews": 0, "posts": 12 },
  "posts": [
    { "postId": "…", "url": "…", "publishedAt": "…", "excerpt": "…", "impressions": 4000, "engagements": 120, "likes": 80, "comments": 10, "shares": 30, "clicks": 20, "videoViews": 0 }
  ]
}
```

Any figure the network does not give is `null`, never 0. `engagements` = likes + comments +
shares (+ saves, quotes, clicks when the network counts them in) — `references/reporting.md`
fixes the definition per network.

## `stats/digest.json` (written by `stats_digest digest`)

```json
{
  "generatedAt": "…",
  "period": { "from": "2026-10-01", "to": "2026-10-31" },
  "previous": { "from": "2026-09-01", "to": "2026-09-30" },
  "networks": {
    "x": {
      "followers": { "now": 1200, "before": 1150, "delta": 50, "deltaPct": 4.35 },
      "impressions": { "now": 54000, "before": 49000, "delta": 5000, "deltaPct": 10.2 },
      "engagements": { "now": 1300, "before": 1100, "delta": 200, "deltaPct": 18.18 },
      "engagementRate": { "now": 2.41, "before": 2.24 },
      "clicks": { "now": 210, "before": null, "delta": null, "deltaPct": null },
      "posts": 12
    }
  },
  "total": { "followers": 5400, "impressions": 120000, "engagements": 3100, "engagementRate": 2.58, "posts": 31 },
  "topPosts": [ { "network": "x", "postId": "…", "url": "…", "excerpt": "…", "engagements": 320, "impressions": 9000, "engagementRate": 3.56 } ],
  "bestSlots": [ { "weekday": 2, "hour": 9, "posts": 4, "avgEngagementRate": 3.1 } ],
  "themes": [ { "theme": "product", "posts": 6, "avgEngagementRate": 2.9 } ]
}
```

`weekday`: 1 Monday … 7 Sunday, in the workspace timezone. `topPosts` at most 5, `bestSlots`
at most 5 (slots with at least 2 posts).

## `reports/<period>.md`

Built by `report` from `assets/report.md`: `{{placeholders}}` filled, the `<!-- agent: … -->`
comments left for the model to write under.

## `watch/keywords.json`

```json
{ "keywords": ["allkin", "allk.in", "\"gestion d'agents\""], "competitors": [] }
```

## Adapter modules `scripts/networks/<network>.mjs`

```js
export const network = "x";
export function comments(json) { return [/* inbox entries without category/priority/state */]; }
export function metrics(json) { return { account: {...} | null, posts: [...] }; }
```

`facebook`, `instagram` and `threads` live in `meta.mjs`, which exports `comments(json,
network)` and `metrics(json, network)`; `index.mjs` maps a network id to its module. An adapter
reads what the API returns (`references/samples/<network>-comments.json`,
`<network>-metrics.json` are real-shaped examples) and never throws on a missing field: it
returns `null` for the figure.
