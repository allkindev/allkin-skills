# Allkin Skills

The **competences** of [Allkin](https://github.com/allkindev/allkin) — what the code calls skills: a
know-how an agent loads on demand, in the open "Agent Skills" format. Allkin lists them on its
Competences page and in the list an agent is given competences from; **a competence is downloaded
only when an agent is given it** (2026-11-03), and a refresh of the repositories updates the ones
already there. A competence never widens a right: `allowed-tools` is ignored, the agent keeps
exactly the rights of its page.

```
skills/<id>/
├── SKILL.md            the standard file: a header with `name` (the folder name) and `description`
│                       on one line each, then the procedure, written for the model, in English
├── skill.json          what Allkin adds: version (1.0.N), author, homepage, icon, category, locales
├── README.md           for the user, with README-FR.md, README-ES.md, README-DE.md
├── icon.svg            optional
├── scripts/            optional: Node 22 scripts, no dependency, run in a closed frame
├── references/         optional: documents the procedure points to
└── assets/             optional: templates and examples
```

`category` is one of `writing`, `code`, `analysis`, `communication`, `organisation`, `operations`,
`other`. Allkin's standard for the Coder agent is `prompts/standards/SKILL-STANDARD.md` in the
Allkin repository.

## Layout

Every repository for Allkin has the same layout, whatever it holds — one of these folders, or several:

```
catalogue.json          written by scripts/catalogue.mjs, never by hand (signed: catalogue.json.sig)
scripts/catalogue.mjs   checks every entry and writes the catalogue
agents/<id>/            a model of agent: agent.json, CLAUDE.md, README.md…
plugins/<id>/           an integration: plugin.json, its code, README.md…
skills/<id>/            a competence: SKILL.md, skill.json, README.md…
services/<id>/          a declarative service: service.json, README.md…
```

The code keeps the folder names of before (`plugins/`, `skills/`); the user reads integrations and
competences. An `id` is the folder name: lowercase letters, digits and dashes.

## Versions: `1.0.N`

Every entry carries a version of the form `1.0.N`: three numbers, the first two fixed, `N` an
integer without a leading zero. **Every change** to an entry (code, manifest, README, picture) raises
`N` by one, in the same change — Allkin offers an update only when the catalogue is ahead of the
installed version, and compares number by number (`1.0008` would read as `1.8`).

## The catalogue

```
node scripts/catalogue.mjs            # checks every entry, writes catalogue.json and signs it
node scripts/catalogue.mjs --check    # checks without writing (exit 1 on a difference)
node scripts/catalogue.mjs --unsigned # writes without signing: for a repository that is not Allkin's
```

The catalogue lists every file of every entry with its size and SHA-256 digest: an Allkin refuses
to install an entry whose files do not match. The catalogues of Allkin's four repositories are
signed with the owner's Ed25519 key (`~/.allkin-signing/catalogue.key`, never in a repository);
Allkin carries the public half and reads nothing from one of its repositories whose signature is
missing or wrong. `catalogue.json` and `catalogue.json.sig` are always committed together. The
owner publishes with `~/allkin-scripts/git_commit_tools.sh`, which raises the versions, regenerates
and signs the catalogue, commits and pushes.

## Your own repository

Anyone can make a repository Allkin reads: the same layout, this very `scripts/catalogue.mjs` run
with `--unsigned`, and the page of the repository pasted in Allkin under **Settings › General ›
Repositories**. What comes from it is shown as "not checked by Allkin". Allkin's own sheet
"Create a repository for Allkin" (the button of that section) says it all, step by step.

Every text shown to the user exists in the four languages of Allkin (en, fr, es, de).
