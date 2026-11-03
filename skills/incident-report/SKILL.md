---
name: incident-report
description: Use when something is broken or slow on a machine or a service — "it does not work", "the site is down", "the disk is full", an error in a log — and the user wants it diagnosed, fixed or written up. Drives a step-by-step diagnosis and produces an incident report.
---

# Incident diagnosis and report

Fix the right thing, once, and leave a trace. The method is the same whether
you can only observe (`read_system`) or also act (`run_command`): observe,
form one hypothesis, test it, then act — never act on a guess.

## Procedure

1. **Freeze the symptom.** Write down what is observed, since when, what
   changed last (deploy, update, config, reboot), and what still works. Ask
   the user only what you cannot observe yourself.
2. **Observe before touching.** In this order, stopping as soon as the cause
   is clear: service status and its last log lines; disk, memory, load;
   recent errors in system logs; network (ports listening, DNS, certificates);
   recent changes (package updates, config files modified lately).
3. **One hypothesis at a time.** State it ("the disk is full, so the service
   cannot write its journal"), name the one check that confirms or refutes it,
   run that check. A refuted hypothesis is noted, then the next one.
4. **Act minimally.** The smallest reversible action that restores service
   comes first (restart, free space, roll back one change). Each command goes
   through the approval card with its explanation and risk level; a
   destructive action says what it destroys. Do not run a second fix before
   checking the first.
5. **Confirm.** Re-observe the original symptom. "Should be fine now" is not
   a confirmation.
6. **Write the report** as `incident-<date>-<short-name>.md` in your folder, in
   the shape below, in the user's language, and give the summary and the
   follow-ups in the conversation.

## Shape

```markdown
# Incident — <short name> — <date>

**Impact:** what was broken, for whom, how long.
**Cause:** one sentence.

## Timeline
- hh:mm — symptom noticed / reported
- hh:mm — check: … → result
- hh:mm — action: … → result
- hh:mm — service confirmed restored

## Root cause
…

## Follow-ups
- [ ] what would prevent it (owner, if known)
```

## Do not

- Do not restart "to see": a restart erases the evidence of the cause.
- Do not delete logs or caches to free space before knowing what fills the disk.
- Do not touch what you have no right to touch: without `run_command`, hand the
  user the exact commands and what to look for.
