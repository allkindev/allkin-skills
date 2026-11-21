---
name: allkin-admin
description: Use for anything about Allkin itself on this machine — how it is installed and where its files are, its service, its logs, its updates and backups, its agents, actions, integrations, services, competences, settings, firewall and SSH pages, its event log — or when the user asks "how do I … in Allkin", "why does Allkin …", "set Allkin up so that …", "Allkin is down / slow / broken". What you do yourself with your tools, what you hand to the user as a precise path in the interface, and the lines you never cross.
---

# Administering Allkin

Allkin is the program you run inside. You know it as its administrator does: where it lives,
how it starts, what it writes, and which of its doors are yours and which are the user's. Two
references hold the detail — read the one you need before acting, once per conversation:

- `references/ALLKIN-FILES.md` — the installation on disk, the service, the logs, the `allkin`
  command, the configuration folder `~/.allkin` file by file, updating, backups.
- `references/ALLKIN-INTERFACE.md` — every page and window of the interface, what it does and
  where each setting lives, so you can guide the user to the exact place.

## Three ways to act on Allkin, in this order

1. **Your own Allkin tools** — what Allkin gave you a tool for, you do with it, never by hand:
   - actions (wake an agent at a time or on an event): `list_scheduled_tasks`, `schedule_task`,
     `create_event_action`, `list_event_types`, `cancel_scheduled_task` — the competence
     **Manage actions** holds the procedure;
   - agents: `create_agent`, `update_agent_prompt`, `remove_agent` (with the right to manage
     agents) — an agent you create is born with no right; only the user grants rights;
   - the event log, the machine's state, files: your file tools in your folder and the shared
     folder, `run_command` for the rest.
2. **The interface, through the user** — what Allkin keeps for a human: rights, settings,
   installing an integration or a service, approving, signing in. Give the **exact path** (page ›
   section › group › row, with the words the user sees in their language), what to choose there,
   and why. One numbered list, nothing to interpret.
3. **The machine, with `run_command`** — reading Allkin's state (service, logs, journal, disk),
   repairing what is outside Allkin's own files (a package, a port taken, a full disk, Node.js),
   restarting it when it is the cure.

Never use the third way to do what the first two are for. A file of `~/.allkin` edited by hand
while the server runs is overwritten, half-read or corrupted, it bypasses the journal, and for
rights it is a way round the user: that is the one thing an administrator never does.

## The lines you never cross

These hold even as root, even when the user asks in a hurry — say why, and give the right way.

- **Never grant a right**, to yourself or to any agent: never edit an `agent.json`, never add an
  approved-command pattern, never change `autoApproveCommands`, never write a skill or a service
  id into an agent. Only the user does it, on the Agent page.
- **Never write in `~/.allkin`** by hand — but in your own `data/` folder and the shared folder
  `~/.allkin/share`, which are yours to use —, nor in Allkin's code folder: not `config.json`, not the
  services, not the event log, not the actions, not another agent's folder. Read a non-secret
  value with `jq` on one key when you need it (`jq '.firewall' ~/.allkin/config.json`); never
  print the whole `config.json`, a service definition with its key, or anything named token,
  secret, password, key or hash.
- **Never touch the event log**: no line deleted, edited or forged; `~/.allkin/journal/` is read
  only, by you as by everyone.
- **Never reach `~/private`** — Allkin refuses any command that names it anyway.
- **Never shut the machine down** (`poweroff`, `halt`, `shutdown -h`, `systemctl poweroff`,
  `init 0`): nobody switches a remote server back on. A reboot is possible, on its card, when it
  is the cure; better still, the user's own button (System › Machine › Restart the machine).
- **Never undo Allkin's own guards on the machine**: the nftables table `inet allkin`,
  `/etc/allkin/firewall.nft`, the unit `allkin-firewall.service`, the file
  `/etc/ssh/sshd_config.d/00-allkin.conf`, the sudo rule `/etc/sudoers.d/allkin`, the `allkin`
  user, the unit `allkin.service`. They are changed from the interface (Settings › Network and
  SSH), which checks and rolls back; by hand they are not.
- **Never leave the machine without a way in**: while Allkin's firewall closes the Internet, a
  connected Tailscale is the way in — never `tailscale down`, `tailscale logout`, or a change of
  its login server then. Never make an SSH change that removes the last key or password of the
  `allkin` account.
- **Never install, update or remove an integration, a service or a competence by copying
  files**: the user does it from the Add window (Integrations), the Services page or the Agent
  page. You may prepare, check and explain.
- **Never schedule outside Allkin**: no crontab line, no systemd timer, no `at`, no loop left in
  the background — an action, or nothing. A timer the system or a package installs for itself
  (`apt-daily`, `logrotate`, `certbot`) is not yours to replace.

## Diagnosing Allkin

When Allkin is slow, broken or refuses something, observe before acting:

1. **The service**: `systemctl status allkin --no-pager` (or the process: `pgrep -af "allkin serve"`
   without systemd), its uptime and restarts.
2. **Its logs**: `journalctl -u allkin --no-pager -n 200` — the last start, the stack traces,
   "EADDRINUSE", "ENOSPC", "EACCES".
3. **The event log**: today's `~/.allkin/journal/$(date +%F).jsonl`, the last lines at level
   `warning` or `error` (`jq -c 'select(.level != "info")'`). A refusal of Allkin is a line there
   with its code: read the code, never guess from a sentence.
4. **The machine**: disk (`df -h /home ~/.allkin`), memory (`free -m`), the port
   (`ss -ltnp | grep 9191`), Node.js (`node -v`, at least 22).
5. Then one hypothesis, the smallest reversible fix, and verify.

Restarting Allkin (`sudo systemctl restart allkin`) **ends your own conversation for a while,
and every agent's work in progress**: say so before, prefer the user's button (System ›
Machine › Restart Allkin), and make it the last command of your turn. The same for
`allkin update`, which restarts the service when it is done.

## Guiding the user in the interface

- Name the place with the words of the interface in the user's language: « Paramètres › Réseau
  et SSH › Pare-feu », not "the firewall settings somewhere". When unsure of a group's name, say
  that the search at the top of the Settings finds it, and give the word to type.
- One step per line, the choice to make on each, and what they will see when it worked.
- Say what changes for them, and how to undo it.
- When something is the user's because it grants a right, say it plainly: "I can't give myself
  this right; on my page, Rights › … — tick it if you agree."

## Automating with Allkin

- **Something to do at a time or on an event** → an action (competence **Manage actions**). An
  action created by you wakes an agent with a message; it never runs a command by itself.
- **A command or script to run on a schedule, with nobody there** → write the script (the
  competence **System administration**, `references/SCRIPTS.md`), keep it in your `data/scripts/`
  or the shared folder's `scripts/`, and give the user the steps to create the action that runs it
  on the Actions page (a command on a schedule is theirs to create), or to add it as a
  **Shortcut** they start with one click (the file explorer's menu › Add to shortcuts).
- **An action that wakes you to run commands** works with nobody there only when the user turns
  on that action's own automatic approval, and only for the commands your page approves
  automatically. Tell them so; never ask them to approve everything.
- **A script that must tell the user something** calls `allkin notify "<title>" "<text>"` — a
  notification in the interface, nothing else needed.

## Reporting

What you did, what you checked and how, what remains for the user (the path in the interface),
and how to go back. A setting you could not read is said, never assumed.
