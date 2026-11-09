---
name: topic-watch
description: Use when the user wants a subject followed over time — competitors, prices, a product, a technology, a regulation, a call for tenders, mentions of a name — "keep an eye on", "tell me when", "every week", "what's new on", or when an action wakes you for a watch run. Sets a watch up in files, then at each run reports only what is new since the last one. Needs web access.
---

# Topic watch

A watch is worth having only if it remembers. Run after run, it must know
what it already told the user, so that it reports **the new, and only the
new** — and says "nothing new" in one line when that is the case. The memory
of a watch is not yours: it is three files in a folder.

It needs the web right (`WebSearch`, `WebFetch`; the browser when you have it,
for pages a simple fetch cannot read). Without it, say so and stop.

## The files

One folder per watch in your own folder: `watch/<subject>/` (a short name in
lower case, with hyphens).

```
watch/<subject>/
├── watch.md        what is watched and how — written at setup, changed with the user
├── seen.jsonl      one line per item already reported or dismissed
├── state.json      the last readings of the values that are tracked (prices, versions, counts)
└── reports/<date>.md   one report per run that had something to say
```

**`watch.md`**

```markdown
# Watch — <subject>

**For:** <what the user will do with it>
**Rhythm:** <daily | weekly on Monday | …>      **Since:** <date>

## Questions
1. <what the user wants to know each time, e.g. "Did a competitor change its prices?">
2. …

## Sources to visit each run
- <name> — <url> — <what to look at there>

## Searches to run each run
- "<query>" (<language>)

## Tracked values
- <key> — <what it is, where it is read, its unit>

## Worth an alert
- <what must be told at once, e.g. "a price drop of more than 10 %", "a new entrant">

## Not wanted
- <what the user said to ignore>
```

**`seen.jsonl`** — one JSON object per line, appended, never rewritten:

```json
{"date":"2026-11-09","key":"https://example.com/blog/new-pricing","title":"New pricing page","source":"example.com","status":"reported"}
```

`key` is the item's address without its tracking parameters, or, for a fact
without an address, a short stable phrase ("acme:price:pro-plan:49"). `status`
is `reported` or `dismissed` (seen, judged not worth telling).

**`state.json`** — the tracked values at the last run:

```json
{"updated":"2026-11-09","values":{"acme.pro.monthly":{"value":49,"unit":"EUR","read":"2026-11-09","url":"https://…"}}}
```

## Setting a watch up

1. **Ask once, in one form**: what exactly is to be followed and why; the
   two to five questions to answer at each run; the sources the user already
   knows and trusts; the rhythm; what would deserve an alert; what to ignore;
   the languages to search in.
2. **Find the sources.** Prefer the origin: the competitor's own pricing and
   news pages, the regulator's publication page, the project's release notes,
   the official journal — before the press that comments on them. Open each
   one and check that it is alive and says what you expect. Five to twelve
   sources; more is noise.
3. **Write `watch.md`** and show it. Correct it with the user.
4. **Take the baseline**: visit every source, record the tracked values in
   `state.json`, and write every item that already exists to `seen.jsonl` as
   `dismissed` — so that the first real run does not report the past as news.
   Tell the user the state of things today in a few lines.
5. **Offer the schedule**: with the right "Can schedule actions" and the
   competence Manage actions, propose the action that wakes you at the rhythm
   chosen, with an instruction that names the watch ("Run the watch
   `<subject>`"). Without them, say so; the user asks for a run when they
   want one.

## A run

1. **Read** `watch.md`, the tail of `seen.jsonl`, `state.json`, and the last
   report. Note today's date and the date of the last run.
2. **Visit every source** of the list. For each: what is there that was not
   last time? Read the page, not a search snippet.
3. **Run every search**, limited to the period since the last run when the
   search allows it; open what looks relevant.
4. **Read the tracked values** again and compare with `state.json`: a value
   that moved is an item, with the old value, the new one and the difference
   stated as both figures.
5. **Filter against `seen.jsonl`**: an item whose key is there is not new. An
   old item with a real development is new under a new key.
6. **Judge each new item** against the questions and the "not wanted" list:
   report it, or dismiss it. Verify what matters at its origin; one source
   is "single-source", said as such.
7. **Write the report** (below) when there is something to report; **append**
   every item judged — reported or dismissed — to `seen.jsonl`; **update**
   `state.json`.
8. **Tell the user**: the headline first. With nobody there (an action woke
   you), keep it to a few lines: the alert if there is one, the count of new
   items, the path of the report.

## The report

```markdown
# Watch — <subject> — <date>   (since <date of the last run>)

**Headline:** <the one thing to know, or "Nothing new.">

## Alerts
- **<what happened>** — <the fact, with figures and date> — [source](url), <date of the page>
  Why it matters: <one line, tied to the user's questions>

## New
### <question 1>
- <fact> — [source](url), <date>

## Tracked values
| Value | Last time | Now | Read on |
|---|---|---|---|

## Sources
- Not reachable this time: <source> — <why>
```

- Sort by importance for the user, not by source.
- Each item is a fact, dated, with its link; opinion is marked as opinion.
- Sections with nothing are left out. A run with nothing new writes no
  report: one line to the user, "Nothing new since <date>" — and the
  unreachable sources if any.

## Keeping a watch healthy

- **A source that is dead, moved or blocked** twice in a row is reported and
  replaced, with the user's agreement; a result that begins with `BLOCKED`
  means the site refuses automated visits — do not insist, find another
  source for the same information.
- **Too much noise**: when most items are dismissed, tighten the searches or
  ask the user what to drop.
- **Too quiet**: after several empty runs, ask whether to widen the watch,
  slow its rhythm or stop it.
- **Stopping** a watch: say which action to delete (or delete it when you may),
  keep the folder.

## Do not

- Do not report an item twice, nor report the past as news at the first run.
- Do not fill a report to justify a run.
- Do not state a change you did not read at its source, nor a figure without
  the date it was read.
- Do not sign in to a site, fill a form or get round a wall to read a source.
- Do not rewrite `seen.jsonl`; append to it.
- Do not watch a private person.
