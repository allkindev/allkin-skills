# Automation scripts that can be trusted

A script you write will run when nobody watches, maybe months from now, maybe by someone else.
Write it so that reading it is enough to know what it does, running it twice does no harm, and
a failure says so.

## Where it lives, how it runs

- **Where**: `data/scripts/<name>.sh` in your own folder, or the shared folder's `scripts/` when
  other agents or the user should find it. A copy in `/usr/local/sbin/` only when a system
  service must call it, and then the user knows.
- **How it is started** — never by a crontab line or a timer of yours:
  - by the user, as a **Shortcut** (the file explorer's menu › Add to shortcuts): one click, its
    output live, its last runs kept;
  - by an **action** the user creates on the Actions page with this command, on a schedule;
  - by an action that wakes you, when the user turned that action's automatic approval on and
    your page approves the command.
  Give the user these steps, with the exact command line to paste.
- **Rights**: it runs as `allkin`; what needs root says `sudo -n` on that line only.

## The skeleton (POSIX sh: Alpine and busybox have no bash)

```sh
#!/bin/sh
# <name> — <one sentence: what it does and why>.
# Usage: <name>.sh [--dry-run]
# Written by the Administrator agent on <date>. Changes: <the files/services it touches>.
# Way back: <how to undo>.
set -eu

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1
HERE=$(cd "$(dirname "$0")" && pwd)
LOG="$HERE/../logs/<name>.log"                   # data/logs/ beside data/scripts/
LOCK="/tmp/<name>.lock"
mkdir -p "$(dirname "$LOG")"

log() { printf '%s %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }
run() { if [ "$DRY_RUN" = 1 ]; then log "would run: $*"; else log "run: $*"; "$@"; fi; }

# Any failure (set -e included) is logged and reaches the user's bell.
trap 'rc=$?; if [ "$rc" -ne 0 ]; then log "FAILED (exit $rc)"; command -v allkin >/dev/null 2>&1 && allkin notify "<name> failed" "exit $rc, see $LOG" || true; fi' EXIT

# One run at a time.
exec 9>"$LOCK"
if command -v flock >/dev/null 2>&1; then flock -n 9 || { log "already running"; exit 0; }; fi

# --- the work: check first, act only when needed (idempotent) ---
# example: free space before a cleanup
# used=$(df -P /var | awk 'NR==2 {print $5}' | tr -d %)
# [ "$used" -lt 85 ] && { log "nothing to do (${used}%)"; exit 0; }
# run sudo -n journalctl --vacuum-time=14d

log "done"
```

## The rules

- **Idempotent**: check the state, act only when it differs (`grep -q` before appending a line,
  `id X` before `useradd`, `command -v` before installing).
- **`set -eu`**, quoted variables, never `rm -rf "$VAR/"` without `: "${VAR:?}"` first.
- **A `--dry-run`** that says everything it would do, for the user to try first.
- **Bounded**: `timeout` on network calls (`curl -fsS --max-time 30`), no endless loop, a lock.
- **Logs**: what it did, with dates, in a file it rotates or truncates; the failure loud
  (`allkin notify`) and its exit code non-zero.
- **No secret inside**: a key for a service goes through `allkin service call <id> …`, which
  places it; a password the user must give lives in a `0600` file they write, read by the script,
  never printed.
- **Portable** when the user has several machines: detect the package manager and the init as
  the competence's step 1 does, rather than assuming Debian.
- **Read it again before handing it over**, run it with `--dry-run`, then once for real with the
  user, and only then propose to automate it.
