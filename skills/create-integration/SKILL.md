---
name: create-integration
description: Use when the user asks you to create, change, fix or debug an integration for Allkin — "make me an integration that…", "add a page to Allkin for…", "integrate this software", "my integration shows an error", "add a setting to the integration you made". Writes the project in your workshop (manifest, page, scripts, translations, documentation, icon), checks it against Allkin's standard, and tells the user how to install or update it.
---

# Creating an Allkin integration

An **integration** adds something to Allkin: a page in a tab, a program Allkin keeps running, a
page served by that program, a dedicated agent — each part optional, freely combined. It is one
folder, `plugins/<id>/`, described by its manifest `plugin.json`. You write that folder in your
**workshop**; Allkin shows it to the user, and **the user installs it**. You never install, start
or update anything yourself.

This competence is what gives you the workshop and its three tools. It widens none of your
rights: no command, no network, no installation comes with it. If you have other rights, they are
those of your page — never use them to install, copy or start an integration in the user's place.

Read `references/PLUGIN-STANDARD.md` **before writing a project, once per conversation**: it is
the rule for everything a project holds, and the check applies it. `references/EXAMPLE.md` is a
small complete integration with a page, file by file, and the paths of the usual icons: read it
before your first interface.

## Words

To the user, in their language, a plugin is an **integration** (fr *intégration*, es
*integración*, de *Integration*) and a skill is a **competence** (fr *compétence*, es
*competencia*, de *Fähigkeit*). Never say "plugin", "skill" or "tool" for them in a sentence, nor
in a text the integration shows. Technical names keep their spelling: `plugin.json`,
`plugins/<id>/`, the keys `plugin.<id>.…`.

## Your workshop

The folder `workshop/` of your own folder — the root of your file tools:

```
workshop/plugins/<id>/     one folder per integration
workshop/services/<id>/    one folder per service
workshop/skills/<id>/      one folder per competence
```

- You write there with your ordinary file tools (`Read`, `Write`, `Edit`, `Glob`, `Grep`). **A
  project is never written anywhere else**: not in the shared folder, not in a work folder, not
  beside `workshop/`.
- Allkin reads that folder as a repository of the user's own. An integration you write there
  appears in the **Integrations page, "Add" window**, where the user installs it or updates it.
- This competence covers `workshop/plugins/`. Leave the other two folders to the competence that
  covers them.
- You change only what **you** made: a project of your workshop. An integration that came from
  elsewhere is not yours — you do not rewrite it, nor copy it under another name.

## Tools

- `list_projects` — the projects of your workshop: kind, id, name, version, the version installed
  in this Allkin (`installed: no` when it is not), the count of errors and warnings. No argument.
- `check_project` — the issues of one project against the standard. Arguments: `kind` (`plugin`
  for an integration; `service` and `skill` exist too) and `id` (the folder name). Each line
  gives the level, the file, a code and what is wrong. An **error** is what Allkin refuses or what
  breaks in use; a **warning** is what the standard asks for.
- `read_tool_log` — the end (16,000 bytes at most) of the service log of one of **your**
  integrations installed in this Allkin: what its program printed, errors included. Argument:
  `id`. It answers that the integration is not installed, or that the log is empty (no service,
  or not started yet), when that is the case.
- `ask_form` — a form in the conversation. When several precise answers are missing, put them in
  **one form** and wait for it; never one question after another in prose.

The three workshop tools (server `allkin-workshop`) only read, and only your workshop. Nothing is
installed, started or changed through them.

## Procedure — always in this order

1. **Rephrase.** In a few lines: what the integration does, for whom, and what it must not do.
   If something is missing — the purpose, what the page shows, the settings, an API and how it
   authenticates, where the data lives — ask for it with one form.
2. **Look at what exists.** `list_projects`. A request about an integration you already made is
   a modification of that project (see below), never a second project beside it.
3. **Plan, and wait for the user's agreement.** The id (lowercase letters, digits, hyphens; never
   renamed afterwards) and the name; the parts (`service`, `web`, `ui`, `agent`, `settings`); the
   rights it needs, each with why — and none it does not use; the files you will write; where it
   keeps its data.
4. **Build**, in `workshop/plugins/<id>/`:
   - Read before changing: never rewrite a file you have not read in this conversation.
   - Write complete files — no placeholder, no "TODO", no elided part. Prepare the whole content,
     then write the file once.
   - Keep it small: a service in plain Node with no dependency, an interface in plain JavaScript
     using only `window.Allkin`; an integration does one thing.
   - A new project starts at `"version": "1.0.0"`.
5. **Check, then fix.** `check_project` with `kind: "plugin"` after each batch of changes. Fix
   every error, then every warning, and check again until it reports no issue. Never hand over a
   project with an error.
6. **Bump the version.** Every batch of changes to any file of the integration — code, CSS,
   manifest, README, icon — raises `N` in `1.0.N` by exactly 1, once, in the same batch. Never
   touch the `1.0`, never skip, never go back. Without the bump the user's "Update" delivers
   nothing: Allkin offers an update only when the number grew.
7. **Hand over.** Tell the user plainly what to do now (see "What the user does").
8. **Debug with facts.** When the user says something fails: `read_tool_log` for an integration
   with a service, and ask what the page shows — the exact message, what they clicked. Find the
   cause, fix it, check, bump, hand over again. Do not change what works, and do not guess when
   the log can tell.
9. **Close the loop.** End every turn with: what you did, the new version, the verdict of the
   check, and the one thing the user should do next.

There is no preview: the user sees a page only once the integration is installed. For an
integration with a page, deliver a first working version early so they can install it and react,
rather than finishing everything unseen.

## What the user does

You cannot install, start or test an integration: say precisely which gesture comes next.

- **Install**: Integrations page → **Add** → the integration, listed among what the repositories
  offer → **Install**. Installing starts nothing.
- **Grant its rights**: on the integration's page. Its service, its interface and its agent exist
  only once every declared right is granted.
- **Reload the page**: an integration that adds to the interface (`ui`) loads at the next reload
  of Allkin's page.
- **Update**: after a change and its bump, Integrations page → **Add** → the integration →
  **Update**. If the new version does not show, the button at the top right of that window reads
  the repositories again. A right added by the new version is granted by the user after the
  update: say so.
- A page served by the integration's own service (`web`) shows once the service is started.

## What a project holds

Aim for no error and no warning. The standard says it all; what is most often missed:

- `plugin.json` is written **in French** (`name`, `description`, the `reason` of each right, the
  labels of the settings), with `locales.en`, `locales.es`, `locales.de` for the same texts.
- `README.md` in English, `README-FR.md`, `README-ES.md`, `README-DE.md`: real documentation, in
  the order the standard gives — what it is for, how to start, each setting, why each right, what
  to do when it does not work. Not a title and a sentence.
- **No text shown to the user is hard-coded.** An interface has `locales.js`, first in `scripts`,
  registering the four dictionaries (en, fr, es, de), every key under `plugin.<id>.`; markup uses
  `data-i18n`, scripts `Allkin.t()` / `Allkin.tn()`. French addresses the reader as « vous »
  (« Créez », « Choisissez », « votre ») — never « tu »; labels stay infinitives (« Ajouter »).
- `validation.json` is `{ "status": "pending" }`. You never write `validated`, and never tell the
  user to.
- `icon.svg` is an object icon as the standard describes: flat layers on a 64 grid, one colour
  family, the gradient ids `nav-ico-<id>-b` and `nav-ico-<id>-f`. You cannot read Allkin's own
  drawings from here: draw the object yourself in that recipe, from simple shapes
  (`references/EXAMPLE.md` shows one).
- Icons inside a view are Phosphor glyphs, light weight, with their exact path. Use the paths of
  `references/EXAMPLE.md`; for another glyph, take its path from the Phosphor set if you can
  reach it, or ask the user for it. **Never invent a path** and never draw a glyph by hand.
- The view follows Allkin's interface: it starts with the page bar, sizes and colours come from
  Allkin's tokens, a form is made of rows, a large edit field and a table run from edge to edge,
  the result of an action is `Allkin.core.toast`, a message about a field goes under that field
  (`Allkin.core.setFieldError`), dialogs are `Allkin.core.confirm` / `prompt`.
- Every interface script is wrapped in `(() => { … })();` and calls nothing of Allkin but
  `window.Allkin`.
- A service writes only in `ALLKIN_PLUGIN_DATA` and the shared folder, listens on `127.0.0.1`,
  stops on `SIGTERM`, and logs what helps to diagnose — never a secret. Code, comments and log
  lines are in English; code never tests the wording of a message.

## Modifying an integration you made

The installed version keeps running while you work. Keep its id, the keys of its settings and
the shape of its data; if data must change shape, say the migration in your plan before writing.
The plan says what changes — files, rights, settings — and what stays. Then build, check, bump,
hand over as above.

## An integration for a third-party software

A request may start from a software (a reverse proxy, a media server…). First find out whether it
is already on the machine: ask the user for its address and version. If it is not, its
installation is a part of your plan — the method, the port, the data folder — **done by the user,
or by an agent that has the admin right, command by command; never by the integration itself**,
and never redone at each version. The integration then brings what fits: a page (the software's
interface in a tab when it allows a frame, otherwise a page made from its API), and its API
reached through a **service**. Credentials live in that service — the user types them on the
Services page —, never in a file of the project, never in the conversation: if the user pastes a
key, do not write it anywhere and tell them where it goes. Removing the integration never removes
the software.

## What you refuse

- Installing, starting or updating an integration yourself, by any means.
- Writing a project outside `workshop/`, or touching an integration you did not make.
- An integration whose purpose is to hide what it does from the user, to collect their secrets,
  or to act on the machine beyond the rights it declares.
- Asking for a right the integration does not use.
- Writing `validated` anywhere.
- Handing over a project the check still finds an error in.
