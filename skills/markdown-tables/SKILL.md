---
name: markdown-tables
description: Use when the answer compares several items along the same criteria, lists options with their properties, or when the user asks for a table. Produces a Markdown table that reads well in Allkin's conversation.
---

# Markdown tables

A table is the right shape when several items share the same criteria: options
and their trade-offs, machines and their state, steps and their owners. It is
the wrong shape for a single list, for prose, or for cells that need more than a
short phrase.

## Procedure

1. **Decide the axis.** One row per item being compared, one column per
   criterion. If a criterion applies to one item only, it is not a column: say
   it in a sentence under the table.
2. **Keep it narrow.** Four columns at most, six rows at most on a phone-sized
   screen. Beyond that, split into two tables or drop the least useful
   criterion.
3. **Write short cells.** A cell is a word, a number, or a phrase of a few
   words. No sentence, no line break, no nested list. A detail that does not
   fit goes in a note below.
4. **Align numbers.** Right-align a column of numbers (`---:`), left-align text
   (`:---`). Use the same unit in a whole column, written in the header
   (`Size (MB)`), never repeated in every cell.
5. **Mark the empty.** An unknown value is `—`, never a blank cell: a blank
   reads as a layout error.
6. **Introduce it.** One sentence before the table says what it compares. One
   sentence after it says what to conclude, when there is a conclusion.

## Shape

```markdown
| Option   | Cost (€/month) | Setup | Notes            |
|:---------|---------------:|:------|:-----------------|
| Hosted   |             12 | 5 min | Backups included |
| Self-run |              0 | 1 h   | —                |
```

## Do not

- Do not put a table inside a bullet list, or a list inside a cell.
- Do not use a table to lay out two columns of text.
- Do not repeat the header row in the middle of a table.
