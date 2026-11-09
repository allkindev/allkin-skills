---
name: data-analysis
description: Use when the user hands over a table — a CSV, a TSV or an Excel file (.xlsx) — or asks for figures from one: totals, averages, a breakdown by category or by month, a ranking, a comparison, a trend, a chart, "what do these numbers say". Profiles the file, computes every figure with scripts (never by reading the rows), draws plain charts as SVG, and writes a short note of what the numbers show.
---

# Data analysis

A model reading a table "sees" numbers and is wrong about their sum. So the
rule of this competence is simple: **you never compute a figure yourself —
not a total, not an average, not a percentage, not a count.** Every number
you write comes out of a script below, or is copied from the file. Your work
is to ask the right questions of the data, to check that the answers make
sense, and to say what they mean.

## The scripts

All in `scripts/` of this competence, run with `run_skill_script` (competence
`data-analysis`), from your folder: the file to analyse must be **in your own
folder** (an attachment lands in `Upload/`); paths are relative to it. They
read `.csv`, `.tsv`, `.txt` and `.xlsx` (one sheet at a time; a formula gives
the result the file kept at its last save), write only where `--out` says,
print a short JSON, and exit 0, 1 (the file or a column could not be read —
the JSON says why) or 2 (bad invocation; `--help` gives the usage).

| Script | What it does |
|---|---|
| `profile.mjs <file>` | the table before anything else: rows, and per column its type, filled / missing / unreadable cells, distinct values, and its figures (sum, mean, median, min, max, quartiles; first and last date; most frequent values); duplicated rows; the sheets of a workbook; **warnings** |
| `aggregate.mjs <file> --agg …` | filter (`--where`), group (`--group`), compute (`--agg`), with each group's share of the total (`--share`), sorted (`--sort`); `--out file.csv` writes the full result |
| `calc.mjs "<expr>" ["name=<expr>" …]` | the arithmetic between figures the other scripts gave — a difference, a growth rate, a ratio: numbers, `+ - * /` and brackets, e.g. `"growth=(2150-1550.5)/1550.5*100"`; `--decimals <n>` |
| `chart.mjs <file> --x … --y … --out file.svg` | one chart from a small table (usually an `--out` of aggregate): `--type bar` (comparison), `hbar` (ranking, long names), `line` (evolution) |

Options shared by the three that read a file: `--sheet <name or number>` for a workbook,
`--delimiter "," | ";" | tab`, `--decimal "," | "."`, `--dates dmy | mdy`,
`--header-row <n>` when the headers are not on the first row, `--no-header`.
They are detected; pass them only when the profile shows the detection wrong.

### aggregate, in detail

```
--where "<column><op><value>"   = != > >= < <= ~(contains); repeat for several; all must hold
                                "Country=France"  "Amount>=100"  "Date<2026-03-01"  "City="  (empty)
--group <col>[,<col>]           a column, or year:<date col>  quarter:  month:  week:  day:
--agg <fn>[:<col>][,…]          count | count:<col> | distinct:<col> | sum: | mean: | median: | min: | max:
--share                         adds share_… (0 to 1) beside every sum and count
--sort [-]<result column>       e.g. -sum_Amount ; result columns are named sum_<col>, mean_<col>, count…
--limit <n>                     groups printed (default 50) ; --out always gets them all
```

Values of `--where` are written with a dot for decimals and dates as
`YYYY-MM-DD`, whatever the file uses. A column is named exactly as the
profile shows it, or by position: `#3`. The answer holds `total` (the same
computations over all the matched rows) and `ignored` (cells of a number
column that were not numbers, left out).

## Procedure

1. **Profile first, always.** Run `profile.mjs` and read it whole before any
   question: the size, the types, and above all the `warnings`. For a
   workbook, look at `source.sheets` and profile the sheet that holds the
   data.
2. **Settle what is doubtful before computing.** Tell the user, in a few
   lines, what the file is and what is wrong with it; ask only what changes
   the figures:
   - *unreadable cells* in a number column ("n/a", "—", text): they are left
     out — say how many;
   - *ambiguous dates* (no day above 12): ask day/month or month/day, then
     pass `--dates`;
   - *duplicated rows*: real repeats or an export error?
   - *the same value written several ways* ("Lyon", "lyon "): they are
     different groups until the file is cleaned — say so, or filter with `~`;
   - *a total row* at the foot of the sheet, *several tables* in one sheet,
     *headers on row 3*: use `--header-row`, filter the total row out with
     `--where`, or ask the user for a clean export;
   - *what a column means* when its name does not say (net or gross? which
     currency? which unit?).
3. **Turn the request into questions the data can answer.** "How are sales
   going?" becomes: the total; the evolution by month; the breakdown by
   product; the top customers and their share. One `aggregate` per question.
4. **Compute.** Run the aggregations. Check each answer before using it:
   `matched` is the number of rows you expected; the `total` agrees with the
   profile's sum; `ignored` is empty or explained; no group is an empty
   name you did not expect.
5. **Compare with something.** A figure alone says nothing: against the
   previous period, the average, the target the user gave, the other groups.
   Growth rates, differences and ratios are **also** computed by a script:
   `calc.mjs`, with the figures the aggregations returned. Never do the
   subtraction or the percentage in your head.
6. **Draw only what helps.** One chart per message, from a result of at most
   a few dozen points: bars to compare, a line for time, horizontal bars for
   a ranking. Give it a title that states the finding ("Sales doubled between
   January and May"), not the axes.
7. **Write the note** (below), then stop.

## The note

```markdown
# <What was asked> — <file>, <period covered>

**In short:** the answer in two or three sentences, with its key figures.

## Findings
1. **<A statement>** — <the figures that support it, with units and period>.
2. …

## Figures
| … | … |   (the table behind the findings, from the scripts' output)

![<title>](<chart>.svg)

## About the data
- <rows analysed, period, what was left out and why (n cells unreadable, duplicates kept or not)>
- <what the data cannot tell>
```

- Lead with the answer; three to five findings, each a sentence one could
  repeat in a meeting.
- **Every figure carries its unit, its period and its perimeter**; round for
  reading (1.2 M€, 34 %) in the prose, keep exact figures in the table.
- Say what a figure does **not** show: a correlation is not a cause, three
  points are not a trend, a small group's average means little.
- Save the note as `analysis-<subject>-<date>.md` in your folder, next to the
  CSV results and the charts it uses; give the paths.

## Do not

- Do not add, subtract, average, count or compute a percentage yourself, even
  "just to check" — run `aggregate.mjs` or `calc.mjs`.
- Do not read the rows of a large file to "get a feel": the profile is the
  feel. Reading a few rows to understand the columns is fine.
- Do not silently drop, fix or fill a value; say what was left out.
- Do not present a guess about why a number moved as a fact: say "possible
  explanation" and what would confirm it.
- Do not change the user's file. Results go to new files.
- Do not draw a chart the note does not need, a pie with more than a few
  slices, or two measures of different units on one axis.
