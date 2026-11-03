---
name: project-plan
description: Use when the user states a goal, a project or a piece of work to organise and wants a plan, milestones, a task list, a schedule or a risk review. Produces a plan file that can be followed and updated.
---

# Project plan

A plan is a list of things to do, in an order that works, with what could go
wrong. It is not a promise and not an essay: every line must be something one
can tick off or check.

## Procedure

1. **Pin the goal.** One sentence: what will exist when the project is done,
   and how one will know. If the user's request does not say, ask once, with
   the other questions below, in a single form.
2. **Collect the constraints.** Deadline, budget, people available, what must
   not change, what already exists. Ask only what changes the plan.
3. **Cut into milestones.** Three to six, each a visible result ("the
   database is restored on the test machine"), never an activity ("work on the
   database"). Order them by dependency, not by preference.
4. **List the tasks** under each milestone: a verb, an object, an owner when
   known, an estimate in days when you can ground it. Ten tasks per milestone
   at most; beyond that the milestone is two.
5. **Name the risks**: what could stop the project, how likely, what to do
   first if it happens. Three to five, the real ones.
6. **Write the plan** as `plan-<project>.md` in your folder, in the shape
   below, in the user's language, and give the milestones in the conversation.
7. **Keep it alive.** When the user reports progress, update the file: tick
   tasks (`[x]`), move dates, add a dated line under "Changes". Never rewrite
   the whole plan for a small change.

## Shape

```markdown
# <Project> — plan

**Goal:** …  **Deadline:** …  **Owner:** …

## Milestones
1. <Result> — target <date>
2. …

## Tasks
### 1. <Milestone>
- [ ] <Task> — <owner> — <est.>
- [ ] …

## Risks
| Risk | Likelihood | First response |
|:-----|:-----------|:---------------|

## Changes
- <date>: …
```

## Do not

- Do not pad with generic tasks ("communicate with stakeholders"): a task
  the user would not recognise as theirs is noise.
- Do not give estimates you cannot justify; say "to estimate" instead.
- Do not reorder milestones to look balanced: dependencies decide.
