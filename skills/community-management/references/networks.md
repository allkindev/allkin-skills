# The networks: what works where

The figures (limits, formats) are in `networks.json` and nowhere else — read them with
`networks --network <id>`. This page is the usage: how each network reads a post, what gets
reach, what gets ignored. Read it once; come back when a network is new to you.

## X

Short, one idea, a hook in the first line. 280 characters as X counts them: a URL weighs 23
whatever its length, an emoji or a CJK character weighs 2. Longer thoughts are a **thread**:
numbered parts ("1/6"), each standing on its own, the first one being the hook, the last one the
call (follow, link, question). One or two hashtags at most, inline; more reads as spam. Links
are fine in the body and get a preview card. Images get far more reach than text alone; four at
most. Alt text on every image. Answer fast: a conversation in the first hour carries the post.
Best slots: weekday mornings and lunch time in the audience's timezone — but your `digest.json`
knows better than this page once you have a month of figures.

## Facebook (page)

Longer texts work; the first 400 characters show before "See more", so the point goes first. A
link gets a preview card; a native video or image gets more reach than a link post. Few
hashtags (two) — they do little here. Questions and polls start conversations. Pages publish
through the Graph API; a personal profile cannot be posted to by any API.

## Instagram

A visual network: **a post needs a media** (image, carousel of up to ten, or a video / reel).
The caption's first 125 characters show before "more". Links in a caption are not clickable:
"link in bio" or a story. Hashtags go in the **first comment** (the API posts the caption, then
a comment): five to ten, specific; thirty is allowed, twenty is already noise. Vertical formats
(4:5, 9:16 for reels) take the most screen. Alt text on every image. Only a professional
account linked to a Facebook page publishes through the API.

## Threads

Conversational, 500 characters, one topic tag per post (not a hashtag flood). Threads of replies
work like X's. Images and videos welcome. Published through Meta's Threads API, a separate
token from the Instagram one.

## LinkedIn

Professional, longer: up to 3 000 characters, the first 210 showing before "see more" — the hook
goes there. Line breaks and white space help reading; no Markdown. **A link in the body lowers
the reach**: put it in the first comment and say "link in the comments". Three hashtags at the
end, specific to the sector. A document (PDF carousel) and a native video are the formats that
reach furthest. Tag people only when they really are in the story. Posting to a **company
page** needs the organisation's permission scopes and, for its statistics, LinkedIn's partner
programme; a personal profile is simpler to start with.

## YouTube

The text is the **description** of a video (5 000 characters; the first two lines show above
the fold: the point and the link), the **title** (100 characters, the first 60 visible in
lists), and **tags** (500 characters in all). Hashtags at the end of the description: the first
three show above the title. Chapters are timestamps in the description ("00:00 Intro"). A
custom thumbnail (16:9, 1280 wide). Community posts have no API: the user posts them. Comments
are answered through `commentThreads` / `comments`. The Data API has a daily quota: an upload
costs a large share of it, a comment list little.

## TikTok

Vertical video (9:16), 15 seconds to a few minutes, the caption short (150 characters is
plenty), three to five hashtags, no clickable link. The first second decides. Published through
the Content Posting API once the application is audited; before that, private only.

## Mastodon

500 characters by default (the instance may allow more; `accounts.json` can carry
`maxChars` per account). URLs weigh 23; a mention counts its local part only
(`@user@instance` counts as `@user`). Hashtags at the end, three or four: they are the way
people find posts (no algorithm). A **content warning** (`spoiler_text`) for sensitive or long
posts is good manners. Alt text is expected on every image, more so than anywhere else. Threads
work as replies to your own post. The API is open and stable: the best place to test the whole
chain.

## Bluesky

300 **graphemes** (an emoji counts one). Links need a facet to be clickable: the API call
builds it from the URL's byte offsets (the adapter note explains). Hashtags are facets too.
Images up to four, under 1 MB each (compress first), alt text expected. Threads by reply to
your own post. Custom feeds: hashtags and keywords matter for discovery.

## Pinterest

A pin is an image (2:3 is the format) with a **title**, a description (500 characters, keywords
first: Pinterest is a search engine) and the **link as a field**, not in the text. Boards
organise pins; a pin lives for months, unlike a post. Video pins work too.

## Reddit, Discord, Telegram (services already in Allkin)

Not broadcast networks: communities. Reddit — read with the app-only service; posting needs a
user token and the subreddit's rules read first; self-promotion gets removed. Discord — a
server's channels: announcements, answers, a bot voice; 2 000 characters, Markdown works.
Telegram — a channel or group through the bot; 4 096 characters, Markdown or HTML.

## Across networks

- **One message, several writings.** Never the same text everywhere: the hook, the length, the
  place of the link and the hashtags differ. The scripts do the mechanics; the words are yours.
- **The tracked link** (`utm_link`) tells the user which network sends visitors.
- **Alt text** everywhere an image goes: accessibility first, and the networks reward it.
- **Answer** within the first hours; the figures of `stats_digest` will show it.
- **Never buy reach**, never ask for follows, never post the same thing twice in a month on one
  network (`publish_log check` refuses it).
