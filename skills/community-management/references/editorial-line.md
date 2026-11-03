# The editorial line: the interview and the file

`community/line.md` is the one document every post comes from. The user corrects it by hand;
you read it before writing, in every conversation. It is written in the user's language.

## The interview (one form, two screens at most)

Ask with `ask_form`. Prefill what you know from the conversation and the user's memory; ask
only what you cannot infer. Field names in the user's language.

**Screen 1 — who and what**

| Field | Type | Why |
|---|---|---|
| Who publishes (brand, person, project) | text | the voice |
| What it does, in one sentence | text | the pitch every post descends from |
| Who we talk to | text | the audience: their words, not ours |
| Three to five themes | textarea | the calendar's columns |
| Tone, three adjectives | text | "warm, precise, direct" beats a paragraph |
| What we never say or do | textarea | forbidden topics, words, comparisons |
| Emojis | choice: never / a few / freely | the mechanics of the texts |
| Signature or recurring line | text, optional | a closing line, a hashtag of the brand |

**Screen 2 — where and when**

| Field | Type | Why |
|---|---|---|
| Networks | multiple choice: X, Facebook, Instagram, Threads, LinkedIn, YouTube, TikTok, Mastodon, Bluesky, Pinterest, other | `accounts.json` |
| For each: account name, language | text | one post per account language |
| Usual days and hours | text | the calendar's defaults |
| Country (for the seasonal dates) | text | marronniers |
| Site and campaign naming | text | the UTM convention |

## Writing `line.md`

Fill the template (`assets/workspace/line.md`) section by section with what the user said, in
their words where they were good. Then:

- **Voice**: three adjectives and one sentence of example for each theme, in the brand's voice,
  so a reader of the file hears it.
- **Never**: a plain list. Add what the user did not think of but their sector implies (health:
  no medical claims; finance: no promise of return; children: no child's face).
- **Hashtags by theme**: three to five per theme, checked once on each network (a hashtag can
  mean something else elsewhere).
- **Networks and rhythm**: the table, one row per account, with the language.

Show the file, correct it with the user, and only then remember three facts (`remember`): the
tone, the audience, the first forbidden topic. Everything else stays in the file.

## Keeping it alive

When the user corrects a post twice for the same reason, propose to add the rule to `line.md`.
When a theme gets no post for a month (`calendar holes`, `publish_log stats`), ask whether it
still belongs. Never rewrite `line.md` on your own: propose the change, apply it on a yes.
