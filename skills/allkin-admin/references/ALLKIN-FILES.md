# Allkin on disk: installation, service, files, logs

Read this when you need to find, read or diagnose something of Allkin on the machine. What it
says is true of an installation made by the official install script; a development machine may
differ — check with `systemctl cat allkin` and `command -v allkin` before assuming a path.

## The installation

| What | Where |
|---|---|
| The user Allkin runs as | `allkin` (home `/home/allkin`), in the group `sudo` (or `wheel`), sudo without a password through `/etc/sudoers.d/allkin` |
| The code | `/home/allkin/allkin` (a `.git` folder there means a development install that follows a branch; without it, a release) |
| The previous version | `/home/allkin/allkin.previous`, kept after an update until the next one: the way back is to swap the two folders and restart |
| The `allkin` command | `/home/allkin/.npm-global/bin/allkin` (in the PATH of the `allkin` user's shells) |
| Node.js | at least 22; from nodejs.org in `/usr/local/lib/nodejs` (links in `/usr/local/bin`) on Debian and Ubuntu, the distribution's package elsewhere |
| The service | the systemd unit `/etc/systemd/system/allkin.service`, `User=allkin`, `Restart=on-failure` |
| The port | 9191 (the web interface and its API) |
| The configuration and the data | `~/.allkin` of the `allkin` user, i.e. `/home/allkin/.allkin` |
| The user's private folder | `~/private` — never reached by any agent |
| Local settings of the code | `allkin.config.local.json` in the code folder (kept across updates) |

You run as the `allkin` user. `sudo -n <command>` runs a command as root, without a password;
`sudo -n -u <user>` as another user. Allkin is supported on **Linux only** (x86_64 and arm64,
glibc ≥ 2.28 or musl), any distribution with a known package manager; without systemd (a
container, WSL without systemd, OpenRC, runit) the service is not installed and Allkin is
started by hand or by the init system the user chose.

## The service

```sh
systemctl status allkin --no-pager        # state, uptime, the last lines
journalctl -u allkin --no-pager -n 200    # the logs (add --since "1 hour ago")
systemctl cat allkin                      # the unit as systemd reads it
sudo -n systemctl restart allkin          # restarts — ends every conversation in progress
```

Without systemd: `pgrep -af "allkin serve"`, and the logs where the user's supervisor writes
them. Allkin exits with code 1 on purpose after an update so that `Restart=on-failure` brings it
back on the new version: an exit with code 1 just after an update is not a crash.

## The `allkin` command

| Command | What it does |
|---|---|
| `allkin update --check` | Says whether a newer version exists (reads the network) |
| `allkin update` | Installs it and restarts the service — prefer Settings › System, which shows the changes and reloads the page |
| `allkin notify "<title>" ["<text>"]` | A notification in the interface, from a script |
| `allkin run <agent-id> "<instruction>"` | Runs an instruction by an agent with nobody there (that agent's rights, unattended) |
| `allkin service call <id> <METHOD> </path>` | Calls a connected service, its key placed by Allkin — the script never sees it |
| `allkin agent list` | The agents |
| `allkin --help` | Everything else |

Never run `allkin reinit` (it resets `~/.allkin`, the user's whole installation) nor
`allkin serve --set-password`: both are the user's alone.

## `~/.allkin`, file by file

Read only, always — the server owns these files. Never print one that holds a secret.

| Path | What it holds | Secret? |
|---|---|---|
| `config.json` | The server's settings: language, provider, firewall choice, network | **Yes** (keys, hashes): read one key with `jq`, never the file |
| `agents/<id>/agent.json` | An agent: its identity, rights, competences, services | May hold a token: read with `jq` on the key you need |
| `agents/<id>/CLAUDE.md` | Its role | No |
| `agents/<id>/data/` | Its folder of files (yours is where your commands start) | No |
| `agents/<id>/memory.json` | Its memory | No |
| `share/` | The shared folder, common to every agent and integration | No |
| `journal/<YYYY-MM-DD>.jsonl` | The event log, one JSON line per event, chained | No (secrets are masked at writing) |
| `event-triggers.json` | The actions that wait for an event | No |
| `shortcuts.json`, `shortcut-runs.json` | The Shortcuts and the runs of their scripts | No |
| `missions/` | Missions not yet sent, and their history | No |
| `plugins/<id>/` | The installed integrations | Their own settings may |
| `skills/skills/<id>/` | The installed competences | No |
| `system-history.json` | A week of the machine's processor and memory curves | No |
| `notifications.json` | The bell's notifications | No |
| `Trash/` | The bin of the machine's explorer | — |
| `firewall-trial.json` | A firewall change waiting for its confirmation | No |

The user's actions on a schedule live in the `allkin` user's crontab (`crontab -l`), written by
Allkin: read it, never edit it.

Useful readings of the event log:

```sh
J=~/.allkin/journal/$(date +%F).jsonl
tail -n 50 "$J" | jq -c '{at, level, type, actor: .actor.kind, target, data}'
jq -c 'select(.level != "info")' "$J" | tail -n 30      # warnings and errors of today
jq -r '.type' "$J" | sort | uniq -c | sort -rn | head    # what happened most today
```

## Updating Allkin

- **The way**: Settings › System › Update (the version, its source, what is new, Install).
  `allkin update` does the same from a command, without the page.
- **A development install** (a `.git` folder) refuses to update over local changes: say so,
  never `git stash` or `git reset` the user's code.
- **It failed**: the running version is untouched before the switch; after it,
  `allkin.previous` is the way back (swap the folders, restart). Read the update's log in the
  page or in `journalctl -u allkin`.
- **Node.js** for Allkin: keep a 22.x or newer. On Debian and Ubuntu it comes from nodejs.org,
  not from apt — running the install script again brings it to the latest 22.x; never replace
  it with the distribution's older package.

## Backups

- **The user's backup** is the Backup window (System window › Backup): a ZIP of `~/.allkin`,
  secrets left out by default; restoring is there too. An automatic backup can be set there.
- **What it does not hold**: the code (reinstalled by the script), the system's own files,
  `~/private`, and what Allkin installed on the machine (packages, units). Your own sheet of the
  machine (below) is what tells how to rebuild those.
- Before a risky change of the system, copy the files you will change (`cp -a file
  file.bak-$(date +%F-%H%M)`) — that is your backup, not the user's ZIP.

## The machine, as Allkin sees it

- **The firewall of Allkin**: one nftables table, `inet allkin`, that only ever closes; its file
  `/etc/allkin/firewall.nft`, loaded before the network by `allkin-firewall.service`. ufw,
  firewalld and Docker keep their own rules: a packet must pass every table. Restarting
  nftables, ufw or firewalld **flushes every table, Allkin's too**: after it, check
  `sudo -n nft list table inet allkin`, and if it is gone, ask the user to load it again
  (Settings › Network and SSH › Firewall › On the machine) or restart Allkin, which reloads it.
- **SSH**: Allkin writes only `/etc/ssh/sshd_config.d/00-allkin.conf` (read before the main
  file; for sshd the first value read wins). A change of yours goes in another file of
  `sshd_config.d` or in the main file, is checked with `sudo -n sshd -t` before any reload, and
  never removes the last way into the `allkin` account.
- **Tailscale**: the Network window shows it; while Allkin's firewall closes the Internet it is
  the way in — never take it down.
