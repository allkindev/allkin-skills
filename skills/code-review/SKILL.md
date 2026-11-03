---
name: code-review
description: Use when the user asks to review, check, audit or critique code, a diff, a pull request or a script, or asks "is this correct / safe / good". Produces findings ranked by severity, each with the line and a concrete failure case.
---

# Code review

A review finds what will break, then what will hurt later. It is not a list
of preferences. Every finding names a place, says what goes wrong and how one
would see it.

## Procedure

1. **Read the whole change** before judging a line: the files given, and the
   files they call into when you can read them. A function looks wrong until
   you see how it is used.
2. **Hunt in this order**, and stop at each level before the next:
   1. *Correctness*: wrong result, crash, unhandled error, off-by-one, race,
      wrong type, missing null case.
   2. *Security*: input reaching a shell, a query or a path unescaped; secrets
      in code or logs; permissions wider than needed.
   3. *Data loss*: a write without a check, a delete without a backup, a
      migration with no way back.
   4. *Behaviour change*: callers that relied on the old behaviour.
   5. *Clarity and tests*: only when the above is clean.
3. **For each finding**, write: severity (blocker / should fix / nit), the
   file and line, what is wrong in one sentence, and a **failure case**:
   concrete input or state → wrong output. A finding without a failure case
   is a nit.
4. **Verify before reporting.** Re-read the lines you cite. Trace the input
   you claim is dangerous. Drop anything you cannot show.
5. **Report** as below, blockers first, in the user's language. If nothing is
   wrong, say so in one line and name what you checked.
6. **Propose fixes** only after the findings, and only for blockers and
   should-fix items, as minimal patches — never a rewrite.

## Shape

```markdown
## Findings
1. **Blocker** — `src/pay.ts:42` — the amount is parsed as float.
   Failure: "10,50" → 10, the customer is charged 10.
2. **Should fix** — …
3. **Nit** — …

## Checked and fine
- Error handling of the network call; the migration's rollback.
```

## Do not

- Do not comment on style when the project has a formatter or a stated
  convention.
- Do not ask for tests you would not know how to write for this code.
- Do not soften a blocker to be polite, and do not inflate a nit to look thorough.
