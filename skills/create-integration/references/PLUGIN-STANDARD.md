# Allkin plugin standard

The rules every Allkin plugin follows. "Must" is checked by Allkin or by the
workshop's check (an **error**); "should" is asked by the standard (a
**warning**). A plugin with no error installs; a plugin with no error and no
warning is conformant.

## 1. What a plugin is

A plugin is one folder. Its name is the plugin's **identifier**: lowercase
letters, digits and hyphens, 64 characters at most, never renamed.

```
plugins/<id>/
├── plugin.json        must   the manifest
├── README.md          must   documentation, in English
├── README-FR.md       should documentation, in French
├── README-ES.md       should documentation, in Spanish
├── README-DE.md       should documentation, in German
├── validation.json    should { "status": "pending" }
├── icon.svg           should its object icon, see "Icons" (icon.png / icon.webp / icon.jpg accepted)
└── …                  the plugin's own files
```

Bounds: 500 files, 20 MB per file, 100 MB in all. File and folder names use
only `A-Z a-z 0-9 . _ -` and never start with a dot or a hyphen. `node_modules`
and `.git` are never part of a plugin.

A plugin is made of **parts**, each optional, freely combined:

| Part | Manifest field | What it is |
|------|----------------|------------|
| Service | `service` | a program Allkin keeps running |
| Web page | `web` (needs `service`) | a page served by the service, shown in an Allkin tab |
| Interface | `ui` | pieces of Allkin's own page: tabs, apps, menus |
| Agent | `agent` | a dedicated agent the plugin hands tasks to |

Installing starts nothing: a plugin arrives with no right granted. The user
grants each right on the plugin's page; the service, the interface and the
agent only exist once **every** declared right is granted.

## 2. The manifest: `plugin.json`

```jsonc
{
  "name": "Mon plugin",                // must — shown everywhere, in French
  "version": "1.0.0",                  // must — see §3
  "description": "Une phrase.",        // must — one or two sentences, in French
  "author": "Moi",                     // should
  "homepage": "https://…",             // optional
  "requires": ["markdown-editor"],     // optional — see below
  "permissions": [ … ],                // §4
  "settings": [ … ],                   // §5
  "service": { … },                    // §6
  "web": { … },                        // §7
  "ui": { … },                         // §8
  "agent": { … },                      // §9
  "locales": { "en": {…}, "es": {…}, "de": {…} }   // should — §10
}
```

Unknown fields are ignored. A field of the wrong type refuses the manifest.

**`requires`** lists the identifiers of the plugins this one cannot work without. Allkin installs
those missing at the same time, after telling the user which ones; a required plugin that no
repository offers refuses the installation. Installing is all Allkin does: the required plugin
gets its rights on its own page, like any other. So still resolve its capability when using it
(§8), and when it is absent say so in the view, with a way to the plugin's page
(`Allkin.core.openPluginPage(id)`). Require a plugin rather than copying what it does; never
require one for a convenience the plugin works without.

## 3. Version: `1.0.N`, nothing else

- The version always has the form `1.0.N`: `1` and `0` fixed, `N` an integer
  without leading zero. A new plugin starts at `1.0.0`.
- **Every change** to any file of the plugin raises `N` by exactly 1, in the
  same change. One bump per batch of changes, never zero, never two.
- Forbidden: `1.1.0`, `2.0.0`, `1.0.08`, `1.0008`, going backwards, skipping.

Allkin compares versions number by number and offers an update only when the
number grows: files changed under the same number are never delivered.

## 4. Rights: `permissions`

```json
"permissions": [{ "id": "network", "reason": "Écoute sur un port local pour servir sa page." }]
```

Declare exactly what the plugin uses, each with a `reason` — the sentence the
user reads before granting it. Say what the plugin does with the right, not
what the right is.

| id | Grants | Needed for |
|----|--------|-----------|
| `network` | network access | a service that listens or calls out; an agent that reads the web |
| `filesystem` | files outside the plugin's own data | a service that reads or writes elsewhere |
| `exec` | running other programs | a service that spawns commands |
| `root` | administrator privileges | almost never — say why at length |
| `agents` | talking to the user's agents | a service using `ALLKIN_SOCKET` |
| `interface` | adding to Allkin's page | **any** `ui` section |
| `agent` | a dedicated agent | **any** `agent` section |
| `repository` | its agent's folder as a source of plugins and services | `repository: true` |

Any other id is accepted and shown as high risk. A right added in a later
version is never granted automatically.

## 5. Settings: `settings`

Each entry becomes a field of the plugin's Configuration page.

```json
{ "key": "port", "label": "Port local", "type": "number", "default": 9301, "required": true, "help": "…" }
```

- `key`: letters, digits and underscores; unique. `label`: must. `help` and
  `placeholder`: optional.
- `type`: `text`, `textarea`, `number`, `boolean`, `secret`, `select` (with
  `options: [{ "value", "label" }]`), `service` (with `capability`: one of the
  user's connected services able to do that — the plugin receives its
  identifier, never its key).
- A `secret` is never sent back to the browser.
- A `required` setting left empty keeps the service stopped.

## 6. Service: `service`

```json
"service": { "command": "node", "args": ["server.js"], "env": {} }
```

- Started **without a shell**, in the plugin's folder. `node` is Allkin's own
  Node; a command starting with `./` is a file of the plugin (executable bit
  set). Arguments are passed as they are.
- A `.js` file using `import` needs a `package.json` holding
  `{ "type": "module", "private": true }` (or use the `.mjs` extension).
- Environment received:

  | Variable | Content |
  |----------|---------|
  | `ALLKIN_PLUGIN_ID` | the identifier |
  | `ALLKIN_PLUGIN_DIR` | the plugin's folder — read-only by convention |
  | `ALLKIN_PLUGIN_DATA` | the plugin's private folder; survives updates |
  | `ALLKIN_SHARE` | the folder shared by every agent and plugin (`~/.allkin/share`) |
  | `ALLKIN_PLUGIN_SHARE` | the plugin's own folder in it, `share/<id>` — not created in advance |
  | `ALLKIN_PLUGIN_SETTINGS` | every setting, as JSON |
  | `PLUGIN_<KEY>` | each setting, upper-cased key |
  | `PORT`, `ALLKIN_PLUGIN_BASE_PATH` | when the plugin has a `web` part |
  | `ALLKIN_SOCKET`, `ALLKIN_DIR` | with the `agents` right |

- **Write only in `ALLKIN_PLUGIN_DATA` and `ALLKIN_SHARE`**: the plugin's
  folder is replaced on every update.
- The shared folder is common ground: every agent and every plugin reads,
  writes and deletes there. A plugin that wants a folder of its own in it uses
  `ALLKIN_PLUGIN_SHARE` — `share/<its id>`, never another name — and creates it
  if it is missing. Agents may edit what is in it: read it as input that can
  change, never as the plugin's private state (that is `ALLKIN_PLUGIN_DATA`).
  `share/Trash/` is the bin of the shared folder.
  An interface reaches the same folder with `Allkin.core.share` (same rules,
  paths relative to the shared folder).
- Allkin copies files, it never runs `npm install`: a plugin with npm
  dependencies installs them itself at first start, into `ALLKIN_PLUGIN_DATA`.
  Prefer no dependency at all.
- Stop cleanly on `SIGTERM` (then `SIGKILL` after 5 s). A crash is restarted
  with a growing delay; five quick failures stop the retries.
- Changing a setting restarts the service: settings arrive by the environment.
- What the service prints is its log, shown on the plugin's page. Log what
  helps to diagnose, never a secret.

## 7. Web page: `web`

```json
"web": { "portSetting": "port", "path": "/" }
```

- Needs a `service`. The port is `port` (fixed) or `portSetting` (the key of a
  `number` setting) — prefer the setting: two plugins must not fight for a port.
- Listen on `127.0.0.1` only. Allkin relays the page (HTTP and WebSocket) under
  `/plugins/<id>/web/`; only a signed-in user reaches it, so the plugin writes
  no authentication.
- **Relative links only** (`api/status`, never `/api/status`): an absolute
  link leaves the prefix. An application that handles a base path itself sets
  `"keepPrefix": true` and reads `ALLKIN_PLUGIN_BASE_PATH`.
- Support light and dark (`prefers-color-scheme`).

## 8. Interface: `ui`

```json
"ui": {
  "apiVersion": 1,
  "provides": ["my-capability"],
  "html": ["view.html"],
  "styles": ["my.css"],
  "scripts": ["locales.js", "app.js"]
}
```

- Needs the `interface` right. `apiVersion` is `1`.
- **HTML** fragments hold `<template data-slot="…">` elements, placed in the
  slot named: `views` (the main panel), `chat-menu` (the ⋮ menu), `body`
  (dialogs, templates). A view starts hidden: `<div class="xx-view hidden" id="xx-view">`.
- **Scripts** run in order, after the HTML and the styles. Each is wrapped in
  `(() => { … })();`: all scripts of the page share one global scope.
- Use **only `window.Allkin`** and the global libraries Allkin documents. Never
  call a function of Allkin's own code by its name: it will break.

  | Call | Use |
  |------|-----|
  | `Allkin.registerTabKind(kind, def)` | a kind of tab: `panels`, `icon`, `label(tab)`, `tooltip(tab)`, `activate(tab)`, `leave(tab)`, `beforeClose(tab)`, `byPath`, `scroller()`, `preview(tab)` (optional: a Node for the tab's card in the tabs of a phone, from what the view holds, never a request) |
  | `Allkin.registerApp({ key, name, meta, icon, open })` | an entry in the Plugins list of the Allkin menu |
  | `Allkin.registerWidget({ key, name, description, icon, size, minSize, multiple, render(container, ctx) })` | optional: a widget the user can add to the home page; `ctx` = `{ id, options, setOptions(patch), editing, narrow }`, `render` may return `{ update(ctx), destroy() }` |
  | `Allkin.provide(name, impl)` / `Allkin.capability(name)` | offer / use a capability (`text-editor`, `markdown-editor`, `file-explorer`…) |
  | `Allkin.t(key, vars)` / `Allkin.tn(key, count)` / `Allkin.i18n` | translation (§10) |
  | `Allkin.core.api(path, options)` | Allkin's HTTP API, with the user's session |
  | `Allkin.core.openTab(agentId, kind, { path, name })` | open a tab |
  | `Allkin.core.toast(message, "ok" \| "ko")` | the result of an action — always through this |
  | `Allkin.core.confirm(options)` / `Allkin.core.prompt(options)` | the application's own dialogs, never the browser's |
  | `Allkin.core.runPluginAgent(id, prompt)` | hand a task to the plugin's agent (§9) |
  | `Allkin.core.sendToAgent(agentId, text)` / `Allkin.core.openSplit(agentId, "chat")` | direct an agent's conversation / show it on the right |
  | `Allkin.core.borrowChat(host, owner)` / `returnChat(owner)` / `loadChat(agentId, sessionId)` / `chatSessionShown()` | show a conversation inside your own view: the thread and the composer exist once and are lent to `host`; give them back before emptying your view; declare `holdsChat: true` on the tab kind |
  | `Allkin.core.composer()` / `resizeComposer()` | the composer's textarea, and its height fitted to its text |
  | `Allkin.core.menu(anchor, items, options)` / `emptyState({ icon, title, text, action })` | a floating menu under an anchor (`{ choice: true }` for a choice among values) / the empty state of a list |
  | `Allkin.core.setFieldError(input, message)` | a message under a field (`""` clears it) |
  | `Allkin.core.modalCloseButton()` / `onModalDismiss(root, handler)` | the cross of the one window, and what dismisses it |
  | `Allkin.core.installPlugin(entry, { repo })` / `isInterfacePluginLoaded(id)` | the installation window of the Integrations page, from a repository |
  | `Allkin.core.onActivity(listener)` | hear every message of the activity socket (`agent_tool`…); returns the function that stops listening |
  | `Allkin.core.trackPageLoad(promise)` / `renderAgentAvatar(container, agentId)` / `shownSplitKind()` / `closeSplit()` / `openSkillsView()` | a page's loading told to the tab bar; an agent's picture; the split screen; the Competences page |
  | `Allkin.core.ansiConsole(pre)` / `renderAnsi(pre, text)` / `stripAnsi(text)` | what a process wrote, drawn as a terminal draws it (colours, weights, a line of progress redrawn): `ansiConsole` gives `{ write(text, className), clear() }` for an output that comes piece by piece — never `textContent` on a raw output; test `core.ansiConsole` first |
  | `Allkin.core.share` | the shared folder (`~/.allkin/share`): `list(path)`, `read(path)`, `write(path, text)`, `mkdir`, `remove`, `move`, `copy`, `url(path, download)` — paths relative to it, the plugin's own folder being `<id>/` |
  | `Allkin.core.state`, `el`, `escapeHtml`, `copyToClipboard`, `formatSize`, `formatDateTime`… | the rest of the core |

- A view **starts with Allkin's page bar**, the one header every page has. No title: the tab
  carries it. The icon of the page first, then what the page has to say, its tools, and its
  actions pushed to the right:

  ```html
  <div class="page-bar">
    <span class="page-bar-icon" data-page-icon="my-kind" aria-hidden="true"></span>
    <span class="page-bar-text">…</span>          <!-- optional: what is shown -->
    <span class="page-bar-meta">…</span>          <!-- optional: a detail, dim -->
    <div class="page-bar-actions">
      <button type="button"><svg …/><span>Label</span></button>
      <button type="button" class="page-bar-primary"><svg …/><span>Create</span></button>
    </div>
  </div>
  ```

  `data-page-icon` takes the kind of the tab: Allkin puts its icon there. The bar sizes its own
  buttons — 28px on a desktop, 44px on a phone, where a button with an icon loses its label —
  so give every button an icon, at most one `page-bar-primary`, and no size of your own.
- **Icons are Phosphor glyphs, light weight** (phosphoricons.com, MIT), like the rest of Allkin —
  never a hand-drawn path, never another set. Inline, in a 24-unit wrapper:
  `<svg viewBox="0 0 24 24"><g transform="scale(0.09375)" fill="currentColor" stroke="none"><path d="…"/></g></svg>`
  with the `d` of `@phosphor-icons/core/assets/light/<name>-light.svg`.
- **`icon.svg` is an object icon** in Allkin's style « Aplats superposés », like the icons of
  its pages (not a Phosphor glyph): the object drawn as flat layers on a 64 grid, each piece in a
  hue of **one family** — the back (body) in a gradient mid → deep, what stands before it (front)
  in a gradient light → mid, small parts in the deep hue, what is cut into it in the light hue
  mixed with white —, no stroke, no rim, no contour, no white, no black, the drawing at 90 % of
  the box:
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="nav-ico-<id>-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="<mid>"/><stop offset="1" stop-color="<deep>"/></linearGradient><linearGradient id="nav-ico-<id>-f" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="<light>"/><stop offset="1" stop-color="<mid>"/></linearGradient></defs><g transform="translate(32 32) scale(.9) translate(-32 -32)">…the layers…</g></svg>`
  The drawings of Allkin (`web/object-icons.js`, `OBJECT_ICON_DRAWINGS`) are the examples to
  follow, and `objectIconInner(drawing, [light, mid, deep], "nav-ico-<id>")` writes one out.
  Allkin shows it as a picture, in its colours, with the shadow of its object icons; pick a
  family that says what the integration is (a yellow notebook, a red microphone, a sky folder).
- **The things a view lists wear object icons too** — a folder, a file, a note, a kind of
  project: `Allkin.core.objectIcon(drawing, family)` returns fresh `<svg>` markup, `drawing` a
  name of `OBJECT_ICON_DRAWINGS` (`folder`, `page`, `code`, `image`, `film`, `music`, `sheet`,
  `archive`, `bin`…), `family` a name of `OBJECT_FAMILIES` (`sky`, `amber`, `pink`…). Test
  `core.objectIcon` first and keep a light glyph as the fallback. An action (a button, a command
  of a menu) stays a light Phosphor glyph.
- **A large edit field runs from edge to edge** of the view, at every screen size: no margin around
  it, no rounded corner, no side border — give the view no side padding around it. To keep one
  framed on purpose, put `data-edit-zone="reduced"` on it and write the framed rule under
  `[data-edit-zone="reduced"]`.
- **A table runs from edge to edge** of the view too — a list of rows, with or without columns:
  no side margin, no rounded corner, no side border; its first and last cells keep the view's side
  padding inside them, so their text stays aligned with the rest of the page. `data-edit-zone="reduced"`
  keeps one framed. A panel among others on a dashboard is not a table.
- **Sizes come from Allkin's tokens**, not from numbers: `--ctl-h` (buttons, fields), `--ctl-radius`,
  `--row-h`, `--nav-h`, `--card-radius`. A button or a field you do not size already follows them.
- Resolve a capability **when using it** (in the click handler), not at load:
  load order is not guaranteed. Its absence is a missing function, not an error.
- **CSS**: prefix every class with the plugin's own short prefix (`.xx-…`);
  never restyle a class of the core. Use Allkin's variables (`--bg`,
  `--bg-raised`, `--border`, `--text`, `--text-dim`, `--accent`, `--sp-1…4`)
  so the plugin follows the theme. A field with the focus takes `--focus-border`
  (border) and `--focus-ring` (halo), never `--accent` straight. Font sizes come from the scale
  (`--text-2xs` … `--text-3xl`), weights are 400, 500, 600 or 700.
- Never build HTML from data with string concatenation: `textContent`, or
  `Allkin.core.escapeHtml`.
- Activating or removing an interface plugin needs a reload of the page.

## 9. Agent: `agent`

```json
"agent": { "name": "Promptr", "description": "…", "prompt": "agent.md" }
```

- Needs the `agent` right. The agent's id is `plugin-<id>`; it is created when
  every right is granted, and removed with the plugin.
- `prompt` is one Markdown file, or a list of them joined in order. It is the
  agent's whole role, restored on every update: nobody edits it from Allkin.
- The agent has **no right** on the machine: no command, no file outside its
  own folder, no other agent. Two options widen it, each visible to the user:
  `"web": true` (reads the web; needs `network`) and `"workspace": true` (its
  folder is `plugin-data/<id>/workspace`, kept when the plugin is removed).
- `model`, `effort`, `thinking` are optional starting values.
- Write the role **for a program**: the agent receives tasks from the plugin's
  interface. Say, task by task, what to return and between which tags
  (`<result>…</result>`). The interface treats an answer without the expected
  tag as an error to show.
- A task takes seconds to minutes (5 at most): the interface shows it is
  working and blocks nothing else.

## 10. Languages

No text shown to the user is hard-coded in one language. Four languages:
French, English, Spanish, German.

- **Manifest**: written in French; `locales.en`, `locales.es`, `locales.de`
  carry `name`, `description`, `permissions: { "<id>": "reason" }` and
  `settings: { "<key>": { "label", "help", "placeholder", "options" } }`.
- **Documentation**: `README.md` in English — always the default —, plus
  `README-FR.md`, `README-ES.md`, `README-DE.md`.
- **Interface**: a script named `locales.js`, first in `scripts`, registers the
  four dictionaries; every key starts with `plugin.<id>.`:

  ```js
  (() => {
    Allkin.i18n.register("en", { "plugin.notes.title": "Notes" });
    Allkin.i18n.register("fr", { "plugin.notes.title": "Notes" });
    Allkin.i18n.register("es", { "plugin.notes.title": "Notas" });
    Allkin.i18n.register("de", { "plugin.notes.title": "Notizen" });
  })();
  ```

  Markup carries `data-i18n="plugin.notes.title"` (also `data-i18n-title`,
  `-placeholder`, `-aria-label`); scripts call `Allkin.t()` / `Allkin.tn()`.
  English is the fallback.
- **A service or a web page** picks its language from a setting of its own.
- **Wording**: in every text the user reads, a plugin is called an **integration** —
  *intégration* in French, *integración* in Spanish, *Integration* in German.
  "Plugin" stays the technical name: `plugin.json`, `plugins/<id>/`, keys, code.
- Code, comments and log lines are in English. Code never tests the wording of
  a message — a status, a code or an error class.

## 11. Documentation: the README

The README is the plugin's Documentation page, readable before installing. It
says, in this order: what the plugin is for; how to start using it; what each
setting does; why each right is asked; what to do when it does not work.

## 12. Validation: `validation.json`

`{ "status": "pending" }` — always, for a new plugin. Only the owner of Allkin
turns it into `{ "status": "validated", "date": "…", "by": "…" }` after checking
it. An author never writes `validated`.

## 13. Conformance checklist

1. The folder name is a valid identifier.
2. `plugin.json` parses, with `name`, `version` (`1.0.N`) and `description`.
3. Every right used is declared with a `reason`; `ui` → `interface`,
   `agent` → `agent`.
4. Every file named in the manifest exists.
5. `README.md` and its three translations exist and are real documentation.
6. `validation.json` says `pending`; an icon is present.
7. `locales` holds `en`, `es`, `de`; an interface has `locales.js` with keys
   under `plugin.<id>.`.
8. Interface scripts are wrapped and use only `window.Allkin`.
9. The service writes only in `ALLKIN_PLUGIN_DATA` and the shared folder (its
   own folder there being `share/<id>`), listens on `127.0.0.1`,
   stops on `SIGTERM`.
10. The version was raised by 1 for this batch of changes.
