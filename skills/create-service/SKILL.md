---
name: create-service
description: Use when the user asks you to connect Allkin to an external API — "add a service for…", "let my agents use the API of…", "create a connector to…", "the service you made fails its test", "add a safeguard to that service". Writes the service's definition in your workshop (where the API is, how the secret travels, the test, the guide for the agents, the help), checks it against Allkin's standard, and tells the user where to connect it.
---

# Creating an Allkin service

A **service** teaches Allkin how to reach one external API: where it is, how the secret travels,
how to prove the connection works, and what an agent needs to know to call it. It is **data,
never code**: one folder, `services/<id>/`, holding `service.json` and its help. Allkin performs
every call; the definition only declares. You write that folder in your **workshop**; Allkin
shows the service to the user, who **connects it** — their key stays in Allkin — and grants it to
agents, which then call the API through `call_external_service` without ever seeing the secret.

This competence is what gives you the workshop and its three tools. It widens none of your
rights: no command, no network, no access to any service comes with it — not even to the one you
write. If you have other rights, they are those of your page.

Read `references/SERVICE-STANDARD.md` **before writing a definition, once per conversation**: it
lists every field, the kinds of authentication, a complete example and the checklist. The check
applies it.

## Words

To the user, in their language: a **service** (fr *service*, es *servicio*, de *Dienst*). A
plugin is an **integration** and a skill a **competence** — never "plugin" or "skill" in a
sentence. Technical names keep their spelling: `service.json`, `services/<id>/`.

## Your workshop

The folder `workshop/` of your own folder — the root of your file tools:

```
workshop/plugins/<id>/     one folder per integration
workshop/services/<id>/    one folder per service
workshop/skills/<id>/      one folder per competence
```

- You write there with your ordinary file tools (`Read`, `Write`, `Edit`, `Glob`, `Grep`). **A
  project is never written anywhere else.**
- Allkin reads that folder as a repository of the user's own. A service you write there appears
  on the **Services page**, where the user connects it.
- This competence covers `workshop/services/`. Leave the other two folders to the competence that
  covers them.
- You change only what **you** made: a project of your workshop.

## Tools

- `list_projects` — the projects of your workshop: kind, id, name, the count of errors and
  warnings. No argument.
- `check_project` — the issues of one project against the standard. Arguments: `kind`
  (`service` here; `plugin` and `skill` exist too) and `id` (the folder name). Each line gives the
  level, the file, a code and what is wrong. An **error** is what Allkin refuses or what breaks in
  use; a **warning** is what the standard asks for.
- `read_tool_log` — the service log of an integration of your workshop installed in this Allkin.
  It reads nothing about a service definition: it only helps when the API you describe is served
  by an integration you made.
- `ask_form` — a form in the conversation. When several precise answers are missing, put them in
  **one form** and wait for it; never one question after another in prose.

The three workshop tools (server `allkin-workshop`) only read, and only your workshop. Nothing is
connected, tested or changed through them.

## Procedure — always in this order

1. **Rephrase.** In a few lines: which API, what the agents will do with it, and what they must
   not do alone.
2. **Gather the facts.** A definition is made of exact facts about the API, never of guesses:
   - its address: hosted (one root for everyone), self-hosted (the user gives the address), or an
     address that varies by one identifier (an account, a region);
   - how it authenticates: a key (in which header, with which prefix; or in the query; or in the
     path), a login and a password (Basic, or exchanged for a session), OAuth 2 (on behalf of a
     person, or as an application), or nothing;
   - a harmless request that proves **the key** works, not only that the host answers;
   - the five to ten calls that cover real use, with the shape of their bodies;
   - what costs money, deletes for good, or speaks in the user's name.
   If you can read the web, read the API's reference; otherwise ask the user for these facts in
   one form, or for the pages of the documentation. What you do not know, you ask — an endpoint
   invented from memory fails at the user's first test. **Never ask for the key itself.**
3. **Look at what exists.** `list_projects`. A request about a service you already made is a
   modification of that project, never a second one beside it.
4. **Choose the id** — lowercase letters, digits, hyphens; never renamed afterwards; **not the id
   of a service Allkin already ships** (the check refuses it: pick another, such as
   `<product>-<what it covers>`).
5. **Write** `workshop/services/<id>/`, complete files, each written once:
   - `service.json` — in English: identity, address, authentication, presentation, the check,
     the safeguards, `agentGuide`, `docUrl`, and `locales` with the description in fr, es, de;
   - `README.md` in English, then `README-FR.md`, `README-ES.md`, `README-DE.md`: where to create
     the key or the application on the service's side, with the exact names of its screens; which
     permissions or scopes to tick; what to paste where in Allkin; what a failed test usually
     means. French addresses the reader as « vous »;
   - `validation.json` — `{ "status": "pending" }`. You never write `validated`.
6. **Check, then fix.** `check_project` with `kind: "service"` after each batch of changes. Fix
   every error, then every warning, and check again until it reports no issue. Never hand over a
   service with an error.
7. **Hand over.** A service carries no version: there is nothing to bump. Tell the user plainly:
   the service is on the **Services page**; they connect it there — the address if it is
   self-hosted, their key or credentials, then the test —, then give it to the agents that need
   it, on each agent's page. Say what the README tells them to prepare on the service's side.
8. **Debug with facts.** When the test or a call fails, ask what the page or the agent got: the
   status, the message. A 401 or 403 is the secret or its placement; a 404 the address or the
   test path; a 200 on a wrong address is a web page — give `testExpect` a fragment of the real
   answer. Fix the definition, check again, and ask the user to test again. You cannot test it
   yourself.
9. **Close the loop.** End every turn with: what you wrote or changed, the verdict of the check,
   and the one thing the user should do next.

## What a good definition holds

- **A test that proves something**: `testPath` on a request only a valid key answers (`/me`,
  `/user`), `testExpect` when a 200 alone proves nothing.
- **Safeguards**: every call that costs, deletes or speaks for the user is in `sensitivePaths`
  as `confirm` — or `deny` when no agent should ever make it —, its `label` written for someone
  who does not know the API. An exception (`allow`) comes **before** the wider rule it opens.
  `pinnedParam` when the key must only ever reach one destination (one channel, one chat).
- **An `agentGuide` a model can act on**: a condensed note in English — the calls that cover real
  use, the shape of a body, pagination, the trap to avoid —, not the documentation. `docUrl`
  gives the rest to agents that read the web.
- **A description in four languages** (`description` in English, `locales.fr`, `.es`, `.de`).
- **A mark**: `logo` only with the brand's exact path (the `d` of its filled path on a 24×24
  grid, Simple Icons format) — never drawn from memory: without it, a simple stroked `glyph`, and
  `color` in the brand's colour.
- **No secret anywhere**: not in `service.json`, not in a README, not in the conversation. The
  user types the key in Allkin's form, where it stays encrypted. If they paste one to you, do not
  write it in any file and tell them where it goes.

## Modifying a service you made

Keep its id: the user's connection and the agents that were granted the service hang on it. Say
what changes — the address, the authentication, the safeguards, the guide — before writing, then
write, check and hand over as above. A change of authentication means the user connects it again.

## A self-hosted software

When the API belongs to a software the user runs themselves, the definition asks for its address
(`needsBaseUrl`). The software is installed by the user, or by an agent that has the admin right,
command by command — never by you through this competence, and never by a definition, which is
only data.

## What a service cannot be

Request signing and mail transport (IMAP, SMTP) are not available to a declarative service. An
API that needs code — a protocol of its own, a call built from another's answer in a way no field
declares — is not a service: say so plainly rather than approximating it.

## What you refuse

- Connecting, testing or granting a service yourself, by any means.
- Writing a project outside `workshop/`, or touching a service you did not make.
- A definition that leaves a destructive or paying call without a safeguard, or whose purpose is
  to send the user's data somewhere they were not told about.
- Holding or writing a secret.
- Writing `validated` anywhere.
- Handing over a definition the check still finds an error in.
