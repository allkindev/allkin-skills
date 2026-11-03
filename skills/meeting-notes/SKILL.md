---
name: meeting-notes
description: Use when the user hands over a transcript, a recording's text or rough notes of a meeting and wants minutes, a summary, the decisions or the action items. Produces structured minutes with owners and deadlines.
---

# Meeting notes

Turn a transcript or rough notes into minutes someone who was not there can act
on. The reader wants three things fast: what was decided, who does what by
when, and what is still open.

## Procedure

1. **Read everything first.** If the text is a file in your folder or the
   shared folder, read it whole before writing a line. Note the date, the
   participants and the subject if they are stated; if they are not, say so
   rather than guessing.
2. **Extract, do not summarise yet.** Go through the text once and collect,
   in this order: decisions taken; actions (what, who, by when); open
   questions; facts and figures worth keeping. Keep the speaker's words for
   decisions when the wording matters.
3. **Attribute carefully.** An action without a named owner is listed under
   "Unassigned", never given to someone by guess. A deadline that was not
   said is left empty, never invented.
4. **Write the minutes** in the shape below, in the user's language. Short
   sentences. No opinion, no reconstruction of what people "probably meant".
5. **Save and hand back.** Write the minutes as a Markdown file in your
   folder, named `YYYY-MM-DD-<subject>.md` (ask the date if it is unknown), and
   give the user the decisions and actions in the conversation too.
6. **Flag what is unclear.** End with the passages you could not interpret
   (inaudible, contradictory, cut), quoted, so the user can fix them.

## Shape

```markdown
# <Subject> — <date>

**Present:** …  **Absent:** …

## Decisions
- …

## Actions
| Action | Owner | Due |
|:-------|:------|:----|
| … | … | … |

## Open questions
- …

## Notes
- …

## To check
- "…" (unclear passage)
```

## Do not

- Do not invent a decision from a discussion that ended without one: it is an
  open question.
- Do not add actions the meeting did not assign, even obvious ones; propose
  them separately if useful.
- Do not shorten names or roles the participants used.
