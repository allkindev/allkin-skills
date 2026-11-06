---
name: migrate-agents
description: Use when the user wants to bring agents from another agent platform into Allkin — OpenClaw (ex Clawdbot, Moltbot), NanoClaw — or uploads an archive of such an install. Reads the archive without its secrets, inventories agents, roles, memories, competences, scheduled tasks and channels, rewrites each agent for Allkin and hands back .allkin archives to import plus a to-do list.
---

# Migrate agents to Allkin

You move the user's agents from another platform into Allkin. The goal is a **good-enough**
migration, not a perfect one: what maps simply is carried over, everything else goes on a short
to-do list the user can act on. Never invent a mechanism to imitate the old platform.

Read `references/mapping.md` once before the first migration: it says what each file and setting
becomes in Allkin.

## What you never do

- **Copy a secret.** Tokens, keys, passwords stay behind. The scripts remove them; if you see one
  anyway, do not repeat it, do not write it anywhere, and say a secret was left out. Channels and
  services are reconnected by the user, in Allkin's forms.
- **Grant a right or create an agent.** You produce archives; the user imports them through
  Allkin's identity card, which grants nothing. You may *ask* for rights in `agent.json`; the card
  shows them, the user decides.
- **Run the old platform's code.** Its scripts are read and sorted, never executed.
- **Look for another way** when a script or a right is missing: say what is missing and go on.

## The scripts

In `scripts/` of this competence, run with `run_skill_script` (the folder you work in is your
own; every path below is relative to it). Each prints a short JSON; exit 1 = problems listed;
`--help` gives the usage.

| Script | What it does |
|---|---|
| `unpack.mjs Upload/<file>.zip [--name x]` | extracts the upload into `migration/source/<x>/`, without credentials, transcripts, `.env` values or dependencies; configuration files come back with every secret replaced |
| `inventory.mjs --source migration/source/<x>` | recognises OpenClaw or NanoClaw (v1 / v2) and writes `migration/inventory.json`: agents with their role, user, memory and journal files, competences, heartbeat, scheduled tasks, channels, model |
| `convert_skill.mjs <skill folder> [--id id] [--locales file.json]` | turns one competence into an Allkin competence in `migration/repo/skills/<id>/`; Node scripts that only work on files are kept, the rest goes to `migration/todo/skills/<id>/` with why |
| `pack.mjs migration/agents/<id>` | builds `migration/out/allkin-agent-<name>.allkin` from the prepared folder; enforces the memory limits; refuses while a secret remains |

## Procedure

### 1. Get the archive

If nothing was uploaded, tell the user how to make it, then wait:

- **OpenClaw**: stop the gateway, then zip `~/.openclaw` — for example
  `cd ~ && zip -r openclaw.zip .openclaw -x '.openclaw/agents/*/sessions/*' '*/node_modules/*'` —
  and attach the zip to the conversation.
- **NanoClaw**: zip the folder of the clone without its dependencies —
  `zip -r nanoclaw.zip nanoclaw -x '*/node_modules/*' 'nanoclaw/data/sessions/*'`.

Say plainly that the zip holds their secrets on their machine, that you will leave them out, and
that they may delete the upload afterwards.

### 2. Unpack and inventory

Run `unpack`, then `inventory`. Read `migration/inventory.json`. If the platform is not
recognised, show what was found at the top of the archive and ask what it is; stop there.

### 3. Agree on the plan — one form

Summarise in a few lines what you found (agents, competences, tasks, channels), then ask with
**one form** (`ask_form`):

- which agents to migrate (all by default), and for each its name in Allkin;
- for NanoClaw, whether the shared instructions go into every role (default yes);
- whether to carry the daily notes / other files as files of the agent (default yes);
- which competences to convert (default: all but NanoClaw's `.claude/skills`, which change
  NanoClaw itself and are never converted).

### 4. Convert the competences

For each competence kept: `convert_skill <path>` (paths from the inventory, under
`migration/source/<x>/`). Write the fr / es / de name and description in a small JSON and pass it
with `--locales` (or run once, then again with `--force --locales`). Read each converted
`SKILL.md`: fix a `{baseDir}` or a step that no longer holds (a `curl` call → "use the service X
if the agent has it"), keeping the procedure's intent. Two competences with the same id: give the
second another `--id`.

### 5. Prepare each agent

In `migration/agents/<id>/`:

- **`agent.json`**: `name`, `description` (one sentence, the user's language), `model` (see the
  mapping), `skillIds` (the converted competences it used), `services` (providers it will need,
  e.g. `["openweather"]`), and the rights to ask for (`canBrowseWeb`, `canAdminSystem`,
  `canReadSystem`, `canSchedule`, `canUseSubagents`) — only those its old setup clearly used.
- **`CLAUDE.md`** — the role, written for the model, in English (see below).
- **`memory.md`** — the durable facts, one per line, short (300 characters at most, 4,000 in all):
  what the agent knew about its job and its world. Not the user's private details from `USER.md`:
  those are proposed to the user in the report.
- **Files to carry** — the daily notes and the other files the user chose to keep: list them in
  `agent.json` as `carry` (paths under `migration/source/`, a folder or a file each, landing in
  the agent's `data/` under their own name, or `{ "from": "…", "to": "notes" }`), and a picture
  of the agent, if the old install had one, as `avatar`. `pack` takes them from the extract: no
  copy by hand. Files you write yourself go in `migration/agents/<id>/data/`.

Then `pack migration/agents/<id>`. Exit 1: fix what it lists (a secret, an empty role, data too
large) and run it again. Facts left out of the memory: move them to `data/notes/` or drop them.

### Writing the role

One coherent `CLAUDE.md`, not a concatenation:

1. `# <Name>` and one paragraph: who the agent is, for whom, in what tone (from IDENTITY, SOUL).
2. **How it works**: the rules of AGENTS.md that still make sense — what to do, what never to do,
   when to ask. Drop the platform's mechanics: boot sequences, "read MEMORY.md first", heartbeat
   protocols, `HEARTBEAT_OK`, session keys, channel syntax, NanoClaw's IPC or container paths.
3. **Its files**: if notes were carried, one line saying where (e.g. "Your earlier notes are in
   `memory/` of your folder").
4. **Its tools**: only what Allkin gives it, in general terms (its competences by name, "the web
   when you have the right"); never a tool of the old platform.

Keep it short — a page, rarely two. Keep the user's own wording where it carries the
personality.

### 6. Hand over

Write `migration/TODO.md` and show it in the conversation, in the user's language:

1. **Import**: each archive in `migration/out/` — download it from your files, then "Import an
   agent" (the "+" of the agents list). Verify, then Import.
2. **Competences**: add the folder `migration/repo` of your folder as a repository in Settings ›
   General › Repositories (give its absolute path), then give each agent its competences on its
   page. Converted competences are pending, as everything from a user's own repository.
3. **Rights** each agent asked for, to grant on its page.
4. **Services and channels** to connect, with the secrets the user will have to enter again (by
   name, from `.env` or the configuration — never a value).
5. **Actions** to create: agent, schedule, message — or the ones you created (see the mapping).
6. **Not carried over**: scripts set aside (`migration/todo/`) and why, channels without an
   equivalent, NanoClaw's install competences, facts about the user from `USER.md` to add to
   their profile if they wish, transcripts.
7. A reminder that the uploaded zip still holds their secrets.

Then stop. Remember one fact if useful ("migrated N agents from OpenClaw on <date>").
