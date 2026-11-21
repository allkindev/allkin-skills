# Firewall rules, without locking anyone out

## First: what is in force, and how the user gets in

```sh
sudo -n nft list ruleset 2>/dev/null | head -n 200      # every table, Allkin's included
sudo -n ufw status verbose 2>/dev/null
sudo -n firewall-cmd --state 2>/dev/null && sudo -n firewall-cmd --list-all
sudo -n iptables -S 2>/dev/null | head -n 50
ss -ltnup                                               # what listens, on which address
who; echo "$SSH_CONNECTION"                             # who is connected, from where
```

Several firewalls can be in force at once: a packet must pass **every** nftables table. Know
which one the machine uses (`ufw` on Ubuntu, `firewalld` on Fedora/RHEL/openSUSE, raw nftables
elsewhere) and change rules **in that one**. Never install a second firewall manager over the
first, never `ufw enable` on a firewalld machine.

Before closing anything, write down how the user reaches the machine: the SSH port, Tailscale
(`tailscale status`), the port of Allkin (9191, or the proxy in front of it), the local network.
These stay open in the same change.

## Allkin's own table: leave it alone

Allkin keeps one table, `inet allkin`, that only ever closes (Allkin's port, or the whole
machine from the Internet), with its file `/etc/allkin/firewall.nft` and the unit
`allkin-firewall.service`. It is changed **from the interface only** (Settings › Network and
SSH › Firewall), which tries a change and takes it back by itself if the page is cut. Your
rules go in the machine's own firewall; Allkin's opens nothing they close, theirs opens nothing
it closes.

**Never** `nft flush ruleset`, never `nft delete table inet allkin`. Restarting or reloading
nftables, ufw or firewalld flushes every table at start, Allkin's with it: after any of those,
check `sudo -n nft list table inet allkin`; if Allkin had rules (`jq '.firewall'
~/.allkin/config.json` says the mode) and they are gone, ask the user to press "On the
machine › Load again" in that group, or restart Allkin.

## A change that undoes itself

For any change that could cut the way in, arm the way back **before** applying it, and cancel
it once the user confirms they still get in (a new SSH session, the page reloaded):

```sh
# 1. save the whole ruleset in force — Allkin's table included, so the rollback restores it too
F="$HOME/fw-before-$(date +%F-%H%M).nft"; sudo -n nft list ruleset > "$F"
# 2. arm a rollback in 5 minutes (a transient unit, visible in systemctl list-timers)
sudo -n systemd-run --unit=fw-rollback --on-active=5min /bin/sh -c "nft flush ruleset && nft -f $F"
# 3. apply the change, 4. ask the user to check, 5. then cancel:
sudo -n systemctl stop fw-rollback.timer
```

Without systemd: `sudo -n nohup sh -c "sleep 300 && nft flush ruleset && nft -f $F" >/dev/null
2>&1 & echo $!`, and `sudo -n kill <pid>` to cancel. The flush here is the one exception to
"never flush": it puts back, within the same command, the whole ruleset you saved.

This one-shot safety net is not a schedule: it lives a few minutes and is cancelled in the same
conversation. Say it in the card. With ufw, the same with `ufw --force disable` as the
rollback; with firewalld, prefer runtime rules with `--timeout=300` and `--permanent` only once
confirmed; on Ubuntu's network, `netplan try`.

## The usual operations

| Goal | ufw | firewalld | nftables (a table of your own, `inet admin`) |
|---|---|---|---|
| State | `ufw status numbered` | `firewall-cmd --list-all` | `nft list table inet admin` |
| Allow a port | `ufw allow 443/tcp` | `firewall-cmd --permanent --add-port=443/tcp && firewall-cmd --reload` | `nft add rule inet admin input tcp dport 443 accept` |
| Allow from a source only | `ufw allow from 192.168.1.0/24 to any port 22 proto tcp` | `firewall-cmd --permanent --add-rich-rule='rule family=ipv4 source address=192.168.1.0/24 port port=22 protocol=tcp accept'` | `nft add rule inet admin input ip saddr 192.168.1.0/24 tcp dport 22 accept` |
| Refuse an address | `ufw insert 1 deny from 203.0.113.7` | `firewall-cmd --permanent --add-rich-rule='rule family=ipv4 source address=203.0.113.7 drop'` | `nft insert rule inet admin input ip saddr 203.0.113.7 drop` |
| Remove a rule | `ufw delete <n>` | the same command with `--remove-…` | `nft -a list chain inet admin input`, then `nft delete rule inet admin input handle <h>` |
| Enable | `ufw allow OpenSSH` **first**, then `ufw --force enable` | `systemctl enable --now firewalld` (SSH is in the default zone; check) | `nft -f` your file; persist it in `/etc/nftables.conf` (Debian) or `/etc/sysconfig/nftables.conf` (RHEL) |

A table of your own in nftables: `table inet admin { chain input { type filter hook input
priority 0; policy accept; … } }` — keep `policy accept` and add explicit `drop` rules, unless the
user wants a closed policy, in which case the first rules accept `lo`, established/related,
ICMP/ICMPv6, the SSH port and Tailscale (`iifname "tailscale*"`).

IPv6 counts: a rule written for `ip` only leaves IPv6 open. ufw covers both when `IPV6=yes`
(`/etc/default/ufw`); in nftables, `inet` tables cover both.

## Brute force and exposure

- **fail2ban** (`apt-get install fail2ban`, a `jail.local` with `[sshd] enabled = true`), or
  **CrowdSec**: they ban addresses that fail too often. Check they do not ban the user's own
  network (`ignoreip`).
- An exposed service is better behind Tailscale or a reverse proxy than open to the world; say
  so when the user asks to open a port.
- Docker's published ports go round ufw: filter them in the `DOCKER-USER` chain, or publish on
  `127.0.0.1:port` only.
