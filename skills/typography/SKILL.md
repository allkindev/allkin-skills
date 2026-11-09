---
name: typography
description: Use whenever you write or revise a text meant to be read, published or printed in French, English, Spanish or German — and when the user asks to fix quotes, spaces, apostrophes, dashes, numbers or dates. The typographic rules of each language, with the exact characters to type.
---

# Typography

Typography is invisible when it is right and makes a text look careless when
it is wrong. Each language has its own rules; apply those of the language the
text is written in, not of the language you are thinking in.

## Everywhere

- **Type the real characters**, not their keyboard stand-ins: the apostrophe
  `’` (U+2019), the language's quotation marks, the ellipsis `…` (U+2026), the
  dashes `–` (en, U+2013) and `—` (em, U+2014), the multiplication sign `×`,
  the minus `−` in figures.
- **Spaces that must not break** are typed as such: the no-break space
  `U+00A0` and the narrow no-break space `U+202F`. In Markdown and plain text,
  type the character itself; in HTML, `&nbsp;` and `&#8239;` are accepted.
- **Never touch code**: inside code blocks, inline code, commands, paths, URLs,
  file names, identifiers and data, quotes stay straight and nothing is
  changed.
- **One space** between sentences. No space before `,` and `.` in any of the
  four languages.
- **Consistency** above all: one style of quotes, one format of dates, one
  way of writing numbers, for the whole text. When the user or their house
  style already decided, follow it and stop there.

## French

| Rule | Write | Not |
|---|---|---|
| Quotation marks: chevrons, a narrow no-break space inside | `« texte »` | `"texte"`, `«texte»` |
| Quote inside a quote | `« il a dit “non” »` | |
| No-break space before `:` | `Note : ceci` | `Note: ceci` |
| Narrow no-break space before `;` `!` `?` | `Vraiment ?` | `Vraiment?` |
| Apostrophe | `l’état`, `aujourd’hui` | `l'état` |
| Capitals keep their accents | `À`, `État`, `ÉCOLE` | `A`, `Etat` |
| Titles: one capital, the first word (and proper names) | `Le rouge et le noir` | `Le Rouge Et Le Noir` |
| Months and days in lower case | `lundi 9 novembre 2026` | `Lundi 9 Novembre` |
| Ordinals | `1er`, `1re`, `2e`, `XXIe siècle` | `2ème`, `2nd`, `1ère` |
| Thousands: narrow no-break space; decimals: comma | `12 345,67` | `12,345.67`, `12.345` |
| Space before a unit, `%` and a currency | `12 km`, `15 %`, `30 €` | `15%`, `30€` |
| Hours | `14 h 30`, `14 h` | `14h30`, `2pm` |
| Incise: em dash or en dash with no-break spaces | `il est — dit-on — parti` | `il est - dit-on - parti` |
| Ellipsis, no space before | `et puis…` | `et puis...` |
| Abbreviations | `M.`, `Mme`, `p. ex.`, `etc.` (never `etc…`) | `Mr`, `Mme.` |
| `etc.` closes a list: no `…` after it, no `et` before | | |

The space before `:` is a normal no-break space (`U+00A0`); before `;` `!`
`?` and inside `« »` a narrow one (`U+202F`). When the medium cannot show the
narrow one, a normal no-break space is acceptable; a breaking space is not.

## English

| Rule | Write | Not |
|---|---|---|
| Curly quotation marks; single inside double | `“text”`, `“he said ‘no’”` | `"text"` |
| Apostrophe | `it’s`, `the ’90s` | `it's`, `the '90s` |
| No space before `:` `;` `!` `?` | `Note: this` | `Note : this` |
| Em dash, closed up (US); spaced en dash (UK) — choose one | `it was—they said—gone` / `it was – they said – gone` | `it was - they said - gone` |
| En dash for ranges | `pages 10–20`, `2024–2026` | `10-20` |
| Thousands: comma; decimals: point | `12,345.67` | `12 345,67` |
| Percent closed up (house style may differ) | `15%` | |
| Months and days capitalised | `Monday, 9 November 2026` / `November 9, 2026` | `monday` |
| Titles: title case or sentence case, one for the whole text | | mixing both |
| Serial (Oxford) comma: use it or not, the same everywhere | `red, white, and blue` | |
| Ordinals | `1st`, `2nd`, `21st` | `2th` |
| Follow the user's variety (US or UK) for spelling and dates | | |

## Spanish

| Rule | Write | Not |
|---|---|---|
| Quotation marks: chevrons first, then English, then single | `«texto»`, `«dijo “no”»` | `"texto"` |
| No space inside the chevrons | `«texto»` | `« texto »` |
| Opening marks for questions and exclamations | `¿Vienes?`, `¡Qué bien!` | `Vienes?` |
| Opening mark where the question starts | `Si llueve, ¿vienes?` | `¿Si llueve, vienes?` |
| No space before `:` `;` `!` `?` | `Nota: esto` | `Nota : esto` |
| Raya (em dash) for incisos, closed up to the inciso | `es —dicen— cierto` | `es - dicen - cierto` |
| Raya for dialogue | `—Hola —dijo ella.` | `-Hola` |
| Months and days in lower case | `lunes 9 de noviembre de 2026` | `Lunes 9 de Noviembre` |
| Titles: one capital, the first word (and proper names) | `Cien años de soledad` | `Cien Años De Soledad` |
| Ordinals | `1.º`, `1.ª`, `3.er` | `1º`, `1ro` |
| Numbers: decimal comma in Spain, point in most of the Americas — follow the reader; thousands with a narrow no-break space from five digits | `12 345,67` | |
| Space before `%` and a unit | `15 %`, `12 km` | `15%` |
| Ellipsis | `y luego…` | `y luego...` |

## German

| Rule | Write | Not |
|---|---|---|
| Quotation marks: low then high, or inward chevrons (books) | `„Text“` or `»Text«` | `"Text"`, `“Text”` |
| Quote inside a quote | `„Er sagte ‚nein‘.“` | |
| Apostrophe | `geht’s`, `Andrea’s Bar` (only where allowed) | `geht's` |
| Nouns capitalised | `das Haus`, `beim Laufen` | `das haus` |
| No space before `:` `;` `!` `?` | `Hinweis: dies` | `Hinweis : dies` |
| Gedankenstrich: spaced en dash | `es war – so heißt es – vorbei` | `es war - so heißt es - vorbei` |
| En dash for ranges, closed up | `10–20 Uhr` | `10-20 Uhr` |
| Thousands: point or narrow no-break space; decimals: comma | `12.345,67` / `12 345,67` | `12,345.67` |
| Space before `%`, a unit, a currency (DIN 5008) | `15 %`, `12 km`, `30 €` | `15%` |
| Dates | `9. November 2026`, `09.11.2026` | `November 9` |
| Ordinals | `3. Platz` | `3ter Platz` |
| Time | `14:30 Uhr` | `14.30h` |
| `ß` in Germany and Austria, `ss` in Switzerland — follow the reader | | |
| Ellipsis, a space before it when a word is complete | `und dann …` | `und dann...` |

## When revising

Apply these rules in the last pass, over the whole text, after the words are
settled: a rewrite after the typography pass undoes it. Report typographic
fixes as one line ("quotes, spaces and apostrophes set to French rules"),
never one by one.
