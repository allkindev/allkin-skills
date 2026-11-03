---
name: research-brief
description: Use when the user asks to look something up, compare products or options, check a fact, find out "what is the state of", or wants a summary of what is known on a topic. Needs web access. Produces a short brief with sources, dated.
---

# Research brief

A brief answers the question asked, says how sure it is, and shows where each
claim comes from. It needs the web right (`WebSearch`, `WebFetch`); without
it, say so and work from what the user gave.

## Procedure

1. **Restate the question** in one line, with what would count as an answer
   (a number, a list, a yes/no with conditions). Ask only if two readings
   would lead to different research.
2. **Search wide, then read deep.** Two or three searches with different
   wordings; open the three to five pages that look primary (official site,
   documentation, standard, original study, reputable press) rather than
   aggregators. Note the date of each page.
3. **Collect claims with their source.** One line per claim: what it says,
   where, when. Mark disagreements between sources instead of picking one
   silently.
4. **Judge.** For each key claim: confirmed by two independent sources,
   single-source, or contested. Older than a year on a fast-moving topic is
   "to recheck".
5. **Write the brief** in the shape below, in the user's language, with the
   answer first. Save it as `brief-<topic>-<date>.md` in your folder when it
   is longer than a screen.
6. **Say what you did not find.** A gap stated is worth more than a guess.

## Shape

```markdown
# <Question> — <date of research>

**Answer:** … (confidence: high / medium / low)

## What is known
- <claim> — [source](url), <date>
- …

## Disagreements and gaps
- …

## Sources
1. <title> — <site> — <date> — url
```

## Do not

- Do not cite a page you did not open.
- Do not present a vendor's claim as a fact; attribute it.
- Do not hide the date: a brief without one is stale from day one.
