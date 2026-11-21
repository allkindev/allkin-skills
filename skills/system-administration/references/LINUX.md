# Linux, by family

Find the family with `/etc/os-release` (`ID`, then `ID_LIKE`) and the init with `ps -p 1 -o comm=`.
Every command below is non-interactive; prefix with `sudo -n` when you are not root.

## Packages

| Family (`ID` / `ID_LIKE`) | Refresh | Search / info | Install | Remove (keep config) | Purge | Upgrade all | Security only / what changes |
|---|---|---|---|---|---|---|---|
| Debian, Ubuntu, Mint, Raspberry Pi OS (`debian`, `ubuntu`) | `apt-get update` | `apt-cache search X`, `apt-cache policy X` | `DEBIAN_FRONTEND=noninteractive apt-get install -y X` | `apt-get remove -y X` | `apt-get purge -y X && apt-get autoremove -y` | `apt-get -y upgrade` (then `full-upgrade` if held back, said first) | `apt list --upgradable`; `unattended-upgrade --dry-run -d` |
| Fedora, RHEL 8+, Rocky, Alma, CentOS Stream (`fedora`, `rhel`) | `dnf makecache` | `dnf search X`, `dnf info X` | `dnf install -y X` | `dnf remove -y X` | same | `dnf upgrade -y` | `dnf updateinfo list --security`; `dnf upgrade --security -y` |
| RHEL 7, CentOS 7 | `yum makecache` | `yum info X` | `yum install -y X` | `yum remove -y X` | same | `yum update -y` | `yum updateinfo list security` |
| Arch, Manjaro, EndeavourOS (`arch`) | `pacman -Sy` only with `-u` | `pacman -Ss X`, `pacman -Si X` | `pacman -S --noconfirm --needed X` | `pacman -R --noconfirm X` | `pacman -Rns --noconfirm X` | `pacman -Syu --noconfirm` (never `-Sy X` alone: partial upgrades break Arch) | `checkupdates` (pacman-contrib) |
| openSUSE, SLES (`suse`, `opensuse`) | `zypper --non-interactive refresh` | `zypper search X`, `zypper info X` | `zypper --non-interactive install X` | `zypper --non-interactive remove X` | same | `zypper --non-interactive update` (Leap); `zypper --non-interactive dup` (Tumbleweed) | `zypper list-patches --category security` |
| Alpine (`alpine`) | `apk update` | `apk search X`, `apk info X` | `apk add --no-cache X` | `apk del X` | same | `apk upgrade` | `apk version -l '<'` |
| Void (`void`) | `xbps-install -S` | `xbps-query -Rs X` | `xbps-install -y X` | `xbps-remove -y X` | `xbps-remove -Ry X` | `xbps-install -Syu` | `xbps-install -Sun` |
| Gentoo (`gentoo`) | `emaint sync -a` | `emerge -s X` | `emerge --ask=n X` | `emerge --deselect X && emerge --depclean --ask=n` | same | `emerge -uDN --ask=n @world` (long: run in the background, say so) | `glsa-check -l affected` |
| Solus (`solus`) | `eopkg ur` | `eopkg info X` | `eopkg it -y X` | `eopkg rm -y X` | same | `eopkg up -y` | — |

Which package holds a file: `dpkg -S`, `rpm -qf`, `pacman -Qo`, `apk info --who-owns`,
`xbps-query -o`. A package's installed version: `dpkg -l X`, `rpm -q X`, `pacman -Q X`,
`apk info -v X`.

**Other sources**, in this order of preference: Flatpak (`flatpak install -y --noninteractive`)
and Snap (`snap install`) for desktop apps; the vendor's official repository with its signing
key in `/etc/apt/keyrings/` (Debian: `signed-by=` in the `.sources`/`.list`), `/etc/yum.repos.d/`
with `gpgcheck=1`; a release binary checked by `sha256sum -c` into `/usr/local/bin`; never
`curl | sh`.

**A reboot required?** Debian/Ubuntu: `/var/run/reboot-required` (and `.pkgs`). Fedora/RHEL:
`dnf needs-restarting -r` (exit 1 = yes). Arch: the running kernel (`uname -r`) differs from
the installed one (`pacman -Q linux`). openSUSE: `zypper needs-rebooting`. Services to restart
without a reboot: `needrestart -b` (Debian) or `dnf needs-restarting -s`.

**Automatic security updates**: Debian/Ubuntu `unattended-upgrades` (`dpkg-reconfigure -f
noninteractive unattended-upgrades`, its log in `/var/log/unattended-upgrades/`); Fedora/RHEL
`dnf-automatic` (`apply_updates = yes`, `upgrade_type = security`, then
`systemctl enable --now dnf-automatic.timer`); openSUSE `yast2-online-update-configuration` or
`os-update`. These are the system's own timers: installing them is fine, and better than a
schedule of yours.

## Services, by init

| Init (PID 1) | State | Start / stop / restart | Enable at boot | Logs |
|---|---|---|---|---|
| systemd | `systemctl status X --no-pager` | `systemctl start X`, `stop`, `restart` (`reload` when it can) | `systemctl enable --now X` / `disable --now` | `journalctl -u X --no-pager -n 100 --since "1 hour ago"` |
| OpenRC (Alpine, Gentoo) | `rc-service X status` | `rc-service X start`, `stop`, `restart` | `rc-update add X default` / `rc-update del X` | `/var/log/messages`, the service's own |
| runit (Void) | `sv status X` | `sv up X`, `down`, `restart` | `ln -s /etc/sv/X /var/service/` / remove the link | `/var/log/socklog/`, `svlogtail` |
| s6 | `s6-svstat /run/service/X` | `s6-svc -u`, `-d`, `-r` | the distribution's way (s6-rc) | the service's log dir |
| SysV (old) | `service X status` | `service X start`, `stop`, `restart` | `update-rc.d X defaults` / `chkconfig X on` | `/var/log/` |

Failed units: `systemctl --failed --no-pager`. Listening ports and their program:
`ss -ltnup`. A unit of your own goes in `/etc/systemd/system/X.service`, then
`systemctl daemon-reload`; an override in `systemctl edit X` is written as
`/etc/systemd/system/X.service.d/override.conf` with `mkdir -p` + a file (no editor opens here).

## Containers, WSL, virtual machines

- **A container** (`systemd-detect-virt -c` says `docker`, `lxc`, `podman`…): no kernel of its
  own, often no init; firewall and some sysctl are the host's. Say so rather than fight it.
- **WSL** (`/proc/version` mentions Microsoft): systemd only when `/etc/wsl.conf` has
  `[boot] systemd=true` (then `wsl --shutdown` from Windows, the user's); the network and
  firewall are Windows' — `netsh` / Defender on the Windows side, not here.
- **Docker on the machine**: its published ports go round ufw (Docker writes its own chains);
  `DOCKER-USER` is where a filter of yours goes. Never `docker system prune -a --volumes`
  without listing what goes.

## Users and groups

`useradd -m -s /bin/bash X` (Alpine: `adduser -D X`), `passwd -l X` to lock, `usermod -aG G X`,
`userdel -r X` only when asked (it deletes the home). Sudo: a file `/etc/sudoers.d/X` (`0440`),
checked with `visudo -c -f` before it counts. The admin group: `sudo` (Debian family) or
`wheel` (the rest).

## Logs and disk

`journalctl -p warning -b --no-pager | tail -n 100`, `journalctl --disk-usage`,
`journalctl --vacuum-time=14d`. `/var/log/` for the rest (`auth.log` / `secure`, `syslog` /
`messages`). Disk: `df -hT`, `df -i` (inodes), `du -xh --max-depth=1 / 2>/dev/null | sort -h |
tail`, `lsblk -f`. Package caches: `apt-get clean`, `dnf clean all`, `paccache -rk2`,
`apk cache clean`.

## Time, names, network

`timedatectl` (systemd) or `date` + `/etc/localtime`; NTP: `timedatectl set-ntp true`,
`chronyc tracking`. Host name: `hostnamectl set-hostname X` (and `/etc/hosts`). Network:
`ip -br a`, `ip r`, `resolvectl status` or `/etc/resolv.conf`; NetworkManager `nmcli`,
netplan (`netplan try` — it rolls back by itself after 120 s without confirmation: the safe way
on Ubuntu), ifupdown `/etc/network/interfaces`. A network change is high risk: the way back
armed first.
