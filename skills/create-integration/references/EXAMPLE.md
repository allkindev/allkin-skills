# A small integration, file by file

"Quick memo" (`quick-memo`): one tab holding a memo, saved as a file of the shared folder so the
agents read and write it too. It has an interface and nothing else — no service, no setting, no
agent. It shows the shape of every file of an integration with a page; the rules are in
`PLUGIN-STANDARD.md`.

```
workshop/plugins/quick-memo/
├── plugin.json
├── validation.json
├── icon.svg
├── view.html
├── memo.css
├── locales.js
├── memo.js
├── README.md          English
├── README-FR.md
├── README-ES.md
└── README-DE.md
```

## `plugin.json`

Written in French; the three other languages in `locales`. The `interface` right is needed by
any `ui` section, with the reason the user reads before granting it.

```json
{
  "name": "Mémo rapide",
  "version": "1.0.0",
  "description": "Un mémo dans un onglet d'Allkin, enregistré dans le dossier partagé : vos agents le lisent et l'écrivent aussi.",
  "author": "Votre nom",
  "permissions": [
    { "id": "interface", "reason": "Ajoute le mémo à la page d'Allkin : son onglet et son entrée dans le menu." }
  ],
  "ui": {
    "apiVersion": 1,
    "html": ["view.html"],
    "styles": ["memo.css"],
    "scripts": ["locales.js", "memo.js"]
  },
  "locales": {
    "en": {
      "name": "Quick memo",
      "description": "A memo in a tab of Allkin, saved in the shared folder: your agents read and write it too.",
      "permissions": { "interface": "Adds the memo to the Allkin page: its tab and its entry in the menu." }
    },
    "es": {
      "name": "Nota rápida",
      "description": "Una nota en una pestaña de Allkin, guardada en la carpeta compartida: sus agentes también la leen y la escriben.",
      "permissions": { "interface": "Añade la nota a la página de Allkin: su pestaña y su entrada en el menú." }
    },
    "de": {
      "name": "Schnellnotiz",
      "description": "Eine Notiz in einem Tab von Allkin, im gemeinsamen Ordner gespeichert: Ihre Agenten lesen und schreiben sie ebenfalls.",
      "permissions": { "interface": "Fügt der Allkin-Seite die Notiz hinzu: ihren Tab und ihren Eintrag im Menü." }
    }
  }
}
```

## `validation.json`

```json
{ "status": "pending" }
```

## `view.html`

One fragment for the slot `views`. The view starts hidden and starts with the page bar; the memo
is a large edit field, from edge to edge. No text in the markup: `data-i18n` attributes.

```html
<template data-slot="views">
  <div class="qm-view hidden" id="qm-view">
    <div class="page-bar qm-bar">
      <span class="page-bar-icon" data-page-icon="quick-memo" aria-hidden="true"></span>
      <span class="page-bar-meta" id="qm-state" role="status"></span>
      <div class="page-bar-actions">
        <button type="button" class="page-bar-primary" id="qm-save">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><g transform="scale(0.09375)" fill="currentColor" stroke="none"><path d="M228.24,76.24l-128,128a6,6,0,0,1-8.48,0l-56-56a6,6,0,0,1,8.48-8.48L96,191.51,219.76,67.76a6,6,0,0,1,8.48,8.48Z"/></g></svg>
          <span data-i18n="plugin.quick-memo.save"></span>
        </button>
      </div>
    </div>
    <textarea class="qm-text" id="qm-text" data-i18n-placeholder="plugin.quick-memo.placeholder" data-i18n-aria-label="plugin.quick-memo.placeholder"></textarea>
  </div>
</template>
```

## `memo.css`

Every class carries the integration's prefix; sizes and colours are Allkin's tokens. The view has
no side padding, so it gives the bar its own.

```css
.qm-view { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
.qm-view.hidden { display: none; }
.qm-bar.page-bar { margin: 0; padding: 0 var(--sp-4); }
.qm-text { flex: 1 1 auto; min-height: 0; width: 100%; margin: 0; padding: var(--sp-4); border: 0; border-radius: 0; box-shadow: none; outline: none; resize: none; background: var(--bg); color: var(--text); font: inherit; font-size: var(--text-md); }
```

## `locales.js`

First in `scripts`. The four dictionaries, every key under `plugin.<id>.`; French says « vous ».

```js
"use strict";
(() => {
window.Allkin.i18n.register("en", {
  "plugin.quick-memo.name": "Quick memo",
  "plugin.quick-memo.meta": "A memo your agents read too",
  "plugin.quick-memo.save": "Save",
  "plugin.quick-memo.saved": "Memo saved.",
  "plugin.quick-memo.failed": "The memo could not be saved: {message}",
  "plugin.quick-memo.placeholder": "Write your memo here…",
});
window.Allkin.i18n.register("fr", {
  "plugin.quick-memo.name": "Mémo rapide",
  "plugin.quick-memo.meta": "Un mémo que vos agents lisent aussi",
  "plugin.quick-memo.save": "Enregistrer",
  "plugin.quick-memo.saved": "Mémo enregistré.",
  "plugin.quick-memo.failed": "Le mémo n'a pas pu être enregistré : {message}",
  "plugin.quick-memo.placeholder": "Écrivez votre mémo ici…",
});
window.Allkin.i18n.register("es", {
  "plugin.quick-memo.name": "Nota rápida",
  "plugin.quick-memo.meta": "Una nota que sus agentes también leen",
  "plugin.quick-memo.save": "Guardar",
  "plugin.quick-memo.saved": "Nota guardada.",
  "plugin.quick-memo.failed": "No se pudo guardar la nota: {message}",
  "plugin.quick-memo.placeholder": "Escriba su nota aquí…",
});
window.Allkin.i18n.register("de", {
  "plugin.quick-memo.name": "Schnellnotiz",
  "plugin.quick-memo.meta": "Eine Notiz, die auch Ihre Agenten lesen",
  "plugin.quick-memo.save": "Speichern",
  "plugin.quick-memo.saved": "Notiz gespeichert.",
  "plugin.quick-memo.failed": "Die Notiz konnte nicht gespeichert werden: {message}",
  "plugin.quick-memo.placeholder": "Schreiben Sie Ihre Notiz hier…",
});
})();
```

## `memo.js`

Wrapped, and nothing of Allkin but `window.Allkin`. It registers the kind of tab (which panel to
show, its icon, its name), the entry that opens it, then wires the view. The memo lives in the
integration's own folder of the shared folder, `quick-memo/`.

```js
"use strict";
/* Quick memo: one tab (kind "quick-memo") holding a memo, a text file of the
   integration's folder in the shared folder. */
(() => {
const Allkin = window.Allkin;
const core = Allkin.core;
const t = Allkin.t;

const KIND = "quick-memo";
/** Relative to the shared folder: the integration's own folder is "<id>/". */
const FILE = "quick-memo/memo.md";
// Phosphor "note", light.
const ICON =
  '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" aria-hidden="true"><g transform="scale(0.09375)" fill="currentColor" stroke="none"><path d="M90,96a6,6,0,0,1,6-6h64a6,6,0,0,1,0,12H96A6,6,0,0,1,90,96Zm6,38h64a6,6,0,0,0,0-12H96a6,6,0,0,0,0,12Zm32,20H96a6,6,0,0,0,0,12h32a6,6,0,0,0,0-12ZM222,48V156.69a13.94,13.94,0,0,1-4.1,9.9L166.59,217.9a13.94,13.94,0,0,1-9.9,4.1H48a14,14,0,0,1-14-14V48A14,14,0,0,1,48,34H208A14,14,0,0,1,222,48ZM48,210H154V160a6,6,0,0,1,6-6h50V48a2,2,0,0,0-2-2H48a2,2,0,0,0-2,2V208A2,2,0,0,0,48,210Zm153.52-44H166v35.52Z"/></g></svg>';

const field = () => document.getElementById("qm-text");
const state = () => document.getElementById("qm-state");
let loaded = false;

async function load() {
  try {
    field().value = await core.share.read(FILE);
  } catch {
    // No memo yet: the file is created at the first save.
    field().value = "";
  }
  loaded = true;
}

async function save() {
  try {
    await core.share.write(FILE, field().value);
    state().textContent = t("plugin.quick-memo.saved");
    core.toast(t("plugin.quick-memo.saved"), "ok");
  } catch (error) {
    core.toast(t("plugin.quick-memo.failed", { message: error.message }), "ko");
  }
}

function open() {
  core.openTab(null, KIND);
}

Allkin.registerTabKind(KIND, {
  panels: ["qm-view"],
  icon: ICON,
  label: () => t("plugin.quick-memo.name"),
  tooltip: () => t("plugin.quick-memo.meta"),
  activate: () => {
    if (!loaded) void load();
  },
});

Allkin.registerApp({
  key: KIND,
  get name() {
    return t("plugin.quick-memo.name");
  },
  get meta() {
    return t("plugin.quick-memo.meta");
  },
  icon: ICON,
  open,
});

document.getElementById("qm-save").addEventListener("click", () => void save());
field().addEventListener("input", () => {
  state().textContent = "";
});
})();
```

Translated texts are read when they are shown (`label: () => t(…)`, `get name()`), never kept in
a constant: the language can change.

## `icon.svg`

An object icon: flat layers on a 64 grid, in one colour family given as light, mid and deep
(here amber: `#fde68a`, `#f59e0b`, `#b45309`). The back of the object takes the gradient
mid → deep (`-b`), what stands before it the gradient light → mid (`-f`), small parts the deep
hue, what is cut into it the light hue mixed with white. No stroke, no white, no black; the
gradient ids carry the integration's id.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="nav-ico-quick-memo-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#b45309"/></linearGradient><linearGradient id="nav-ico-quick-memo-f" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs><g transform="translate(32 32) scale(.9) translate(-32 -32)"><rect x="14" y="6" width="40" height="52" rx="6" fill="url(#nav-ico-quick-memo-b)"/><rect x="20" y="6" width="34" height="52" rx="6" fill="url(#nav-ico-quick-memo-f)"/><rect x="27" y="18" width="20" height="3.5" rx="1.75" fill="#fef3c5"/><rect x="27" y="27" width="20" height="3.5" rx="1.75" fill="#fef3c5"/><rect x="27" y="36" width="13" height="3.5" rx="1.75" fill="#fef3c5"/><circle cx="14" cy="16" r="3.5" fill="#b45309"/><circle cx="14" cy="32" r="3.5" fill="#b45309"/><circle cx="14" cy="48" r="3.5" fill="#b45309"/></g></svg>
```

Colour families of Allkin, each as light, mid, deep — pick the one that says what the integration
is: slate `#cbd5e1` `#64748b` `#334155`; purple `#d8b4fe` `#9333ea` `#581c87`; green `#86efac`
`#16a34a` `#166534`; teal `#5eead4` `#0d9488` `#115e59`; amber `#fde68a` `#f59e0b` `#b45309`;
violet `#c4b5fd` `#7c3aed` `#4c1d95`; blue `#93c5fd` `#2563eb` `#1e3a8a`; orange `#fdba74`
`#ea580c` `#9a3412`; pink `#f9a8d4` `#db2777` `#9d174d`; cyan `#67e8f9` `#0891b2` `#155e75`;
indigo `#a5b4fc` `#4f46e5` `#312e81`; sky `#7dd3fc` `#0284c7` `#075985`.

## The READMEs

`README.md` in English, then the three translations, each a real documentation in this order:
what the integration is for; how to start using it (install, grant the right, reload the page,
where to open it); what each setting does; why each right is asked; what to do when it does not
work.

## A service, in short

An integration with a program adds `"service": { "command": "node", "args": ["server.mjs"] }`,
the rights it uses (`network` to listen or to call out) and, for a page of its own,
`"web": { "portSetting": "port", "path": "/" }` with a `number` setting `port`. The program:

```js
import { createServer } from "node:http";

const port = Number(process.env.PORT);
const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("OK");
});
server.on("error", (error) => {
  console.error(`cannot listen on 127.0.0.1:${port}: ${error.message}`);
  process.exit(1);
});
server.listen(port, "127.0.0.1", () => console.log(`listening on 127.0.0.1:${port}`));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close(() => process.exit(0)));
```

Settings arrive in `ALLKIN_PLUGIN_SETTINGS` (JSON); what it keeps goes in `ALLKIN_PLUGIN_DATA`.
What it prints is its log — what `read_tool_log` returns.

## Phosphor glyphs, light weight

The exact `d` of the glyphs most used, to put in the wrapper
`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><g transform="scale(0.09375)" fill="currentColor" stroke="none"><path d="…"/></g></svg>`.

- `plus`: `M222,128a6,6,0,0,1-6,6H134v82a6,6,0,0,1-12,0V134H40a6,6,0,0,1,0-12h82V40a6,6,0,0,1,12,0v82h82A6,6,0,0,1,222,128Z`
- `x`: `M204.24,195.76a6,6,0,1,1-8.48,8.48L128,136.49,60.24,204.24a6,6,0,0,1-8.48-8.48L119.51,128,51.76,60.24a6,6,0,0,1,8.48-8.48L128,119.51l67.76-67.75a6,6,0,0,1,8.48,8.48L136.49,128Z`
- `check`: `M228.24,76.24l-128,128a6,6,0,0,1-8.48,0l-56-56a6,6,0,0,1,8.48-8.48L96,191.51,219.76,67.76a6,6,0,0,1,8.48,8.48Z`
- `trash`: `M216,50H174V40a22,22,0,0,0-22-22H104A22,22,0,0,0,82,40V50H40a6,6,0,0,0,0,12H50V208a14,14,0,0,0,14,14H192a14,14,0,0,0,14-14V62h10a6,6,0,0,0,0-12ZM94,40a10,10,0,0,1,10-10h48a10,10,0,0,1,10,10V50H94ZM194,208a2,2,0,0,1-2,2H64a2,2,0,0,1-2-2V62H194ZM110,104v64a6,6,0,0,1-12,0V104a6,6,0,0,1,12,0Zm48,0v64a6,6,0,0,1-12,0V104a6,6,0,0,1,12,0Z`
- `pencil-simple`: `M225.9,74.78,181.21,30.09a14,14,0,0,0-19.8,0L38.1,153.41a13.94,13.94,0,0,0-4.1,9.9V208a14,14,0,0,0,14,14H92.69a13.94,13.94,0,0,0,9.9-4.1L225.9,94.58a14,14,0,0,0,0-19.8ZM94.1,209.41a2,2,0,0,1-1.41.59H48a2,2,0,0,1-2-2V163.31a2,2,0,0,1,.59-1.41L136,72.48,183.51,120ZM217.41,86.1,192,111.51,144.49,64,169.9,38.58a2,2,0,0,1,2.83,0l44.68,44.69a2,2,0,0,1,0,2.83Z`
- `magnifying-glass`: `M228.24,219.76l-51.38-51.38a86.15,86.15,0,1,0-8.48,8.48l51.38,51.38a6,6,0,0,0,8.48-8.48ZM38,112a74,74,0,1,1,74,74A74.09,74.09,0,0,1,38,112Z`
- `arrow-clockwise`: `M238,56v48a6,6,0,0,1-6,6H184a6,6,0,0,1,0-12h32.55l-30.38-27.8c-.06-.06-.12-.13-.19-.19a82,82,0,1,0-1.7,117.65,6,6,0,0,1,8.24,8.73A93.46,93.46,0,0,1,128,222h-1.28A94,94,0,1,1,194.37,61.4L226,90.35V56a6,6,0,1,1,12,0Z`
- `arrow-left`: `M222,128a6,6,0,0,1-6,6H54.49l61.75,61.76a6,6,0,1,1-8.48,8.48l-72-72a6,6,0,0,1,0-8.48l72-72a6,6,0,0,1,8.48,8.48L54.49,122H216A6,6,0,0,1,222,128Z`
- `arrow-square-out`: `M222,104a6,6,0,0,1-12,0V54.49l-69.75,69.75a6,6,0,0,1-8.48-8.48L201.51,46H152a6,6,0,0,1,0-12h64a6,6,0,0,1,6,6Zm-38,26a6,6,0,0,0-6,6v72a2,2,0,0,1-2,2H48a2,2,0,0,1-2-2V80a2,2,0,0,1,2-2h72a6,6,0,0,0,0-12H48A14,14,0,0,0,34,80V208a14,14,0,0,0,14,14H176a14,14,0,0,0,14-14V136A6,6,0,0,0,184,130Z`
- `caret-down`: `M212.24,100.24l-80,80a6,6,0,0,1-8.48,0l-80-80a6,6,0,0,1,8.48-8.48L128,167.51l75.76-75.75a6,6,0,0,1,8.48,8.48Z`
- `caret-right`: `M180.24,132.24l-80,80a6,6,0,0,1-8.48-8.48L167.51,128,91.76,52.24a6,6,0,0,1,8.48-8.48l80,80A6,6,0,0,1,180.24,132.24Z`
- `caret-left`: `M164.24,203.76a6,6,0,1,1-8.48,8.48l-80-80a6,6,0,0,1,0-8.48l80-80a6,6,0,0,1,8.48,8.48L88.49,128Z`
- `dots-three`: `M138,128a10,10,0,1,1-10-10A10,10,0,0,1,138,128ZM60,118a10,10,0,1,0,10,10A10,10,0,0,0,60,118Zm136,0a10,10,0,1,0,10,10A10,10,0,0,0,196,118Z`
- `copy`: `M216,34H88a6,6,0,0,0-6,6V82H40a6,6,0,0,0-6,6V216a6,6,0,0,0,6,6H168a6,6,0,0,0,6-6V174h42a6,6,0,0,0,6-6V40A6,6,0,0,0,216,34ZM162,210H46V94H162Zm48-48H174V88a6,6,0,0,0-6-6H94V46H210Z`
- `download-simple`: `M222,144v64a6,6,0,0,1-6,6H40a6,6,0,0,1-6-6V144a6,6,0,0,1,12,0v58H210V144a6,6,0,0,1,12,0Zm-98.24,4.24a6,6,0,0,0,8.48,0l40-40a6,6,0,0,0-8.48-8.48L134,129.51V32a6,6,0,0,0-12,0v97.51L92.24,99.76a6,6,0,0,0-8.48,8.48Z`
- `warning`: `M235.07,189.09,147.61,37.22h0a22.75,22.75,0,0,0-39.22,0L20.93,189.09a21.53,21.53,0,0,0,0,21.72A22.35,22.35,0,0,0,40.55,222h174.9a22.35,22.35,0,0,0,19.6-11.19A21.53,21.53,0,0,0,235.07,189.09ZM224.66,204.8a10.46,10.46,0,0,1-9.21,5.2H40.55a10.46,10.46,0,0,1-9.21-5.2,9.51,9.51,0,0,1,0-9.72L118.79,43.21a10.75,10.75,0,0,1,18.42,0l87.46,151.87A9.51,9.51,0,0,1,224.66,204.8ZM122,144V104a6,6,0,0,1,12,0v40a6,6,0,0,1-12,0Zm16,36a10,10,0,1,1-10-10A10,10,0,0,1,138,180Z`
- `info`: `M142,176a6,6,0,0,1-6,6,14,14,0,0,1-14-14V128a2,2,0,0,0-2-2,6,6,0,0,1,0-12,14,14,0,0,1,14,14v40a2,2,0,0,0,2,2A6,6,0,0,1,142,176ZM124,94a10,10,0,1,0-10-10A10,10,0,0,0,124,94Zm106,34A102,102,0,1,1,128,26,102.12,102.12,0,0,1,230,128Zm-12,0a90,90,0,1,0-90,90A90.1,90.1,0,0,0,218,128Z`
- `play`: `M231.36,116.19,87.28,28.06a14,14,0,0,0-14.18-.27A13.69,13.69,0,0,0,66,39.87V216.13a13.69,13.69,0,0,0,7.1,12.08,14,14,0,0,0,14.18-.27l144.08-88.13a13.82,13.82,0,0,0,0-23.62Zm-6.26,13.38L81,217.7a2,2,0,0,1-2.06,0,1.78,1.78,0,0,1-1-1.61V39.87a1.78,1.78,0,0,1,1-1.61A2.06,2.06,0,0,1,80,38a2,2,0,0,1,1,.31L225.1,126.43a1.82,1.82,0,0,1,0,3.14Z`
- `pause`: `M200,34H160a14,14,0,0,0-14,14V208a14,14,0,0,0,14,14h40a14,14,0,0,0,14-14V48A14,14,0,0,0,200,34Zm2,174a2,2,0,0,1-2,2H160a2,2,0,0,1-2-2V48a2,2,0,0,1,2-2h40a2,2,0,0,1,2,2ZM96,34H56A14,14,0,0,0,42,48V208a14,14,0,0,0,14,14H96a14,14,0,0,0,14-14V48A14,14,0,0,0,96,34Zm2,174a2,2,0,0,1-2,2H56a2,2,0,0,1-2-2V48a2,2,0,0,1,2-2H96a2,2,0,0,1,2,2Z`
- `clock`: `M128,26A102,102,0,1,0,230,128,102.12,102.12,0,0,0,128,26Zm0,192a90,90,0,1,1,90-90A90.1,90.1,0,0,1,128,218Zm62-90a6,6,0,0,1-6,6H128a6,6,0,0,1-6-6V72a6,6,0,0,1,12,0v50h50A6,6,0,0,1,190,128Z`
- `note`: `M90,96a6,6,0,0,1,6-6h64a6,6,0,0,1,0,12H96A6,6,0,0,1,90,96Zm6,38h64a6,6,0,0,0,0-12H96a6,6,0,0,0,0,12Zm32,20H96a6,6,0,0,0,0,12h32a6,6,0,0,0,0-12ZM222,48V156.69a13.94,13.94,0,0,1-4.1,9.9L166.59,217.9a13.94,13.94,0,0,1-9.9,4.1H48a14,14,0,0,1-14-14V48A14,14,0,0,1,48,34H208A14,14,0,0,1,222,48ZM48,210H154V160a6,6,0,0,1,6-6h50V48a2,2,0,0,0-2-2H48a2,2,0,0,0-2,2V208A2,2,0,0,0,48,210Zm153.52-44H166v35.52Z`
- `folder`: `M216,74H130.49l-27.9-27.9a13.94,13.94,0,0,0-9.9-4.1H40A14,14,0,0,0,26,56V200.62A13.39,13.39,0,0,0,39.38,214H216.89A13.12,13.12,0,0,0,230,200.89V88A14,14,0,0,0,216,74ZM40,54H92.69a2,2,0,0,1,1.41.59L113.51,74H38V56A2,2,0,0,1,40,54ZM218,200.89a1.11,1.11,0,0,1-1.11,1.11H39.38A1.4,1.4,0,0,1,38,200.62V86H216a2,2,0,0,1,2,2Z`

A glyph that is not here: take its path from the Phosphor set, light weight
(`@phosphor-icons/core/assets/light/<name>-light.svg`), or ask the user for it. Never invent one.
