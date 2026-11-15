---
name: office-documents
description: Use when the user hands over, names or asks for a Word or Excel document (.docx, .xlsx) — read a contract, fill in a form, correct a letter, update a table, add rows to a workbook, restyle a report, "make me a Word document", "put this in Excel". Reads the document as numbered blocks or cells, changes it in place without damaging what it does not touch, and creates new ones.
---

# Word and Excel documents

A `.docx` or a `.xlsx` is an archive of XML parts, not a text. Rewritten whole — by `Write`, by a
script, by a library that loads it and saves it again — it loses what the writer did not
understand: styles, pictures, headers, comments, charts, pivot tables. The tools of this competence
change **only the parts an operation touches** and leave the rest byte for byte. So the first rule:
**a Word or Excel document goes through these tools, and through nothing else.**

This competence is what gives you the tools. It widens none of your rights: they reach the files
your file tools already reach — your folder, the shared folder, the work folder of the
conversation — and nothing more.

## Tools

- `office_read` — a Word document as numbered blocks (`b1`, `b2`… a paragraph with its style, a
  table with its cells `b7.r2.c3`), a workbook as its sheets, then the cells of one sheet (value,
  `=formula`, `{number format}`). `details: true` adds the formatting.
- `office_edit_doc` — a `.docx` changed in place: text, paragraphs, table rows, then the look
  (text, paragraphs, styles, page, lists, tables).
- `office_edit_sheet` — a `.xlsx` changed in place: cells, rows at the end, sheets, then the look
  (cells, widths, heights, merges, frozen panes).
- `office_create` — a new `.docx` or `.xlsx`, never over a file that exists.

Never `Read`, `Write` or `Edit` on these files; never `python-docx`, `openpyxl`, LibreOffice or an
unzip in a command, even when you may run commands.

## Procedure

1. **Find the document.** An attachment is in `Upload/` of your folder; the user may also name a
   file of the shared folder or of the work folder. Use its path as it is: you change **that**
   file, in place — never a copy under another name, unless the user asks for one.
2. **Read before anything.** `office_read`, without `details` first: the structure is what you
   need to target a change. A long Word document comes 400 blocks at a time (`from`); a large
   sheet is read by `range`. Ask for `details` only when the request is about the look.
3. **Decide the whole change, then send it once.** One call takes up to 200 operations, applied
   in order: correcting ten paragraphs is one call, not ten.
4. **Mind the numbers in Word.** An insertion or a deletion moves every block after it. In one
   call, work **from the end of the document to its start**; between two calls, read again
   before you reuse an id.
5. **Read back** what you changed (`office_read` on the blocks or the range) before you say it is
   done.
6. **Report** in a sentence or two: what changed and where, and what could not be done.

## Word

- A small correction is `replace` (find → replace), not a paragraph rewritten: it keeps the runs'
  formatting. `set_text` rewrites a paragraph or a cell and keeps its look, but drops a link it
  held.
- A new paragraph looks like its neighbour, like the block you name (`like`), or takes a `style`
  id **the document has** — the ids `office_read` shows, not a name you guess.
- To change how every heading or every body paragraph looks, change the style (`edit_style`),
  not the paragraphs one by one. Direct formatting (`format_text`, `format_paragraph`) is for the
  exception.
- A form is filled in where its blanks are: the paragraph or the cell that holds the blank, never
  a new block beside it.

## Excel

- A string that starts with `=` is a formula, written in English with commas
  (`=SUM(B2:B14)`), whatever the user's language. A text that starts with `=` is
  `{"text": "…"}`; a date is `{"date": "2026-10-30"}`; `null` empties a cell.
- Where the workbook computes, **write a formula, not its result**: a total typed as a number
  goes stale at the next change.
- **Formulas are not computed here.** The results the file keeps are those of its last opening in
  a spreadsheet; after a change, every formula is computed again when the user opens it. Never
  read a stale result back as the new figure — and say so when the user waits for a number.
- Rows are added **after the last one used** (`append_rows`). Inserting or deleting rows, columns
  or sheets is not possible: it would break the references of formulas and charts. Say so, and
  offer what is possible — rows at the end, a new sheet, cells emptied.
- A cell keeps its style when its value changes; `format` changes the look of a range and leaves
  what you do not name.

## A new document

`office_create`, then the same tools for the rest. Word: blocks with the styles the tool lists
(a title, headings, body, lists) and tables — give it headings rather than bold lines, so the
user's table of contents and styles work. Excel: one sheet per table, a header row, the figures
as numbers and the totals as formulas. Save it in your folder, or where the user asked, and name
the place.

## What these tools do not do

- `.pptx`, `.doc`, `.xls` and OpenDocument files are not changed. Allkin shows the user a
  `.pptx`, but you cannot read or change one: say it plainly, and ask for a `.docx` or a `.xlsx`
  when that fits.
- No picture, chart, comment, header or footer is added or edited; those a document already has
  are kept.
- When a request cannot be done without damaging the file, refuse that part and say why — never
  approximate it by rebuilding the document.
