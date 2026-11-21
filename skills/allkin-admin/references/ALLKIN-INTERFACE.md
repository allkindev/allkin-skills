# Allkin's interface: where everything is

Read this to send the user to the exact place. Names are given in English; say them in the
user's language as the interface does (French examples in brackets). When a group's name is
uncertain, the Settings have a search at their top: give the word to type.

The interface never says "plugin" nor "skill": an integration (fr « intégration ») and a
competence (fr « compétence »). An action is fr « action ». Use those words with the user.

## How the screen is made

- **The logo**, top left, opens the **System window**: the pages of Allkin and of the
  integrations. Its foot carries the user, light / dark, and the emergency stop.
- **The rail**, under it: **Home**, **Agents**, **Workspace**, and the **emergency stop** (stops
  every agent at once).
- **The tab bar**: every page opens in a tab. At its right, the tools: search, **Missions**,
  **Folders** (shared, private, configuration, the agents'), **split screen**, **Network**, the
  **bell** (notifications).
- An agent's row in the Agents panel: a click opens its conversation; the chevron unfolds its
  sessions and, at their head, New session, Files, History, Settings (its **Agent page**).

## The pages of the System window

| Page | What it is for |
|---|---|
| **Settings** (fr « Paramètres ») | Seven pages, below |
| **System** (fr « Système ») | The machine's timeline (processor, memory), what waits for the user, the agents at work, and the **event log** day by day — search, categories, levels, export, integrity. The **Machine** button of its bar: Restart Allkin, Restart the machine…, Restart the network…, Restart Tailscale, Sign in to Tailscale again… (no shutdown, by design). Processes and System information too. |
| **Actions** | Every action: at a time (cron), on an event of the event log, or by a webhook. **New action** opens the page of an action: one sentence with holes — « When ⟦…⟧, ⟦wake⟧ ⟦an agent⟧ and tell it: … ». Only here can the user make an action that **runs a command** on a schedule, set an action on a webhook, or turn on an action's **automatic approval**. |
| **Shortcuts** (fr « Raccourcis ») | Links, Allkin elements and **scripts** of an agent's `data/` or of the shared folder, run by the server with their output live. A script is added from the file explorer's menu (Add to shortcuts) or « New shortcut ». |
| **Backup** (fr « Sauvegarde ») | Save `~/.allkin` as a ZIP (secrets out by default), Restore, Automatic backup. |
| **Integrations** (fr « Intégrations ») | What is installed, as tiles; **Add** (the page's foot) browses what the repositories offer, Install / Update. |
| **Services** | The connections the agents use (APIs, SSH machines, Home Assistant, mail…): create one, its key, its test, its approval rules, its switch "Act without approval". |
| **Competences** (fr « Compétences ») | Everything the repositories offer, by category; a competence is given to an agent on the agent's page. |
| **Help** (fr « Aide ») | The help. |

## Settings: seven pages

| Page | Groups worth knowing |
|---|---|
| **Account and security** | Identity (name, login, picture), the Allkin account, this session, **password of the interface**, unlock code, remembered devices. |
| **This device** | What the browser keeps for itself: appearance, tools of the tab bar, conversation window, alerts on this device, installing as an app. |
| **Notifications** | What makes a notification. |
| **Agents** | AI provider (the AI accounts), agents running, memory of the user, agent categories, **rights of a new agent**, **forbidden commands** (refused to every agent, before any approval), **rules imposed on agents**. |
| **Browser and computers** | The agents' browsers (open ones, settings, **forbidden sites**), the user's computers (Allkin Client). |
| **Network and SSH** | The web interface's network, **Tailscale**, the **Firewall** (Rules: No rules / Close Allkin to the Internet / Close the machine to the Internet; leave the local network open; On the machine: load again), the **SSH server** (state, connect, port, sign in with a password, sign in as root, the keys of the `allkin` account, make a pair of keys). |
| **System** | Language, date and time (time zone), retention of the event log, **Repositories** (Allkin's four, locked, and the user's own; "Create a repository"), **About** and **Update** (version, source, what is new, Install). |

A group is opened directly by the search of the Settings; tell the user the word to type when
the path is long ("pare-feu", "dépôts", "commandes interdites").

## The Agent page (an agent's Settings)

Reached from the agent's row (chevron › Settings), its profile, or its picture in the
conversation's band. Sections:

- **Identity**: picture, name, category, description; engine (AI provider, model).
- **Role**: its `CLAUDE.md`, with **Save** (Ctrl+S). A role change restarts its session.
- **Rights**: **System access** (None / Read only / System administrator); **Command approval**
  and **Commands approved automatically** (patterns); can talk to other agents, and **Agents it
  can call on**; can create, re-prompt and delete other agents; web; **Can schedule actions**;
  sub-tasks; memory; computers; browser; capabilities.
- **External services enabled**, **Competences** (giving one downloads it), **Upload webhook**.
- **Identity card**, **Export this agent**, **Danger zone** (delete).

Every one of these is the user's to change. You may say which to tick and why; you never write
it yourself.

## Approval cards

Each of your commands shows a card: **Approve**, **Approve for this session** (every command of
this conversation, never written on the agent), **Always allow…** (a pattern added to your
page, editable before it is saved) and **Refuse**. For a long piece of work, tell the user once
that "Approve for this session" exists; never ask for a pattern wider than the job (`sudo *` is
never a pattern to propose).

## Where to look when the user says…

| "…" | Where |
|---|---|
| "I can't sign in" | Account and security › Password (from another signed-in device); else `allkin serve --set-password` on the machine, which is the user's to type |
| "Allkin is reachable from the Internet" | Network and SSH › Firewall, or Tailscale |
| "An agent can't do X" | Its Agent page › Rights, Competences, External services |
| "Every agent must never run Y" | Agents › Forbidden commands |
| "Run this every night" | Actions › New action (a command on a schedule is the user's) |
| "Something happened, what?" | System, its event log; the line opens with its details |
| "Install an integration" | Integrations › Add |
| "A new version?" | Settings › System › Update |
| "Save everything" | Backup |
| "Restart" | System › Machine |
