# macOS, FreeBSD, Windows

Allkin itself runs on Linux. You meet these systems on a machine reached over SSH (a service
"Machine over SSH"), or on a user's computer through Allkin Client. The method of the
competence holds unchanged — detect, back up, change little, verify, keep the way back; only
the commands change.

Detect: `uname -s` says `Darwin` (macOS) or `FreeBSD`; on Windows, `ver` (cmd) or
`$PSVersionTable` / `[System.Environment]::OSVersion` (PowerShell).

## macOS

| Need | Command |
|---|---|
| Version | `sw_vers` |
| Packages (Homebrew, as the user, never with sudo) | `brew update`, `brew install X`, `brew uninstall X`, `brew upgrade`, `brew outdated`; apps: `brew install --cask X` |
| System updates | `softwareupdate -l`, `sudo softwareupdate -i -a` (`-R` restarts: only on the user's word) |
| Services | `launchctl list`, `sudo launchctl bootstrap system /Library/LaunchDaemons/X.plist`, `bootout`; `brew services list`, `brew services start X`, `stop X` |
| Logs | `log show --last 1h --predicate 'process == "X"'`, `log stream` (bounded) |
| Firewall | application firewall: `sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate`, `--setglobalstate on`, `--add <app>`; packet filter: `pf` (`/etc/pf.conf`, an anchor of your own, `sudo pfctl -nf` to check, `-f` to load) |
| Users | `dscl . -list /Users`, `sysadminctl -addUser X` |
| Disk | `df -h`, `diskutil list`, `tmutil listbackups` |

Protected parts (SIP) cannot be changed; do not try to disable SIP.

## FreeBSD

| Need | Command |
|---|---|
| Version | `freebsd-version -ku` |
| Packages | `pkg update`, `pkg install -y X`, `pkg delete -y X`, `pkg upgrade -y`, `pkg audit -F` (vulnerabilities) |
| System updates | `freebsd-update fetch install` (a new release: `freebsd-update upgrade -r X` only on the user's choice) |
| Services | `service X status`, `start`, `stop`, `restart`, at boot `sysrc X_enable=YES` |
| Logs | `/var/log/messages`, `/var/log/auth.log` |
| Firewall | `pf` (`/etc/pf.conf`, `pfctl -nf` to check, `pfctl -f` to load, `sysrc pf_enable=YES`) or `ipfw`; same rule of the way back armed first |
| Users | `pw useradd X -m`, `pw groupmod wheel -m X` |
| Disk / ZFS | `df -h`, `zpool status`, `zfs list`, a snapshot before a risky change: `zfs snapshot pool/fs@before-<date>` |

## Windows (PowerShell, as administrator)

| Need | Command |
|---|---|
| Version | `Get-ComputerInfo -Property OsName,OsVersion,OsBuildNumber` |
| Packages | `winget search X`, `winget install --id X -e --silent --accept-package-agreements --accept-source-agreements`, `winget upgrade --all --silent`, `winget uninstall --id X`; Chocolatey if already there: `choco install -y X` |
| Windows Update | `Get-WindowsUpdate` / `Install-WindowsUpdate -AcceptAll -IgnoreReboot` (module PSWindowsUpdate, installed with the user's agreement); without it, `UsoClient StartScan` then the Settings app |
| Services | `Get-Service X`, `Start-Service`, `Stop-Service`, `Restart-Service`, `Set-Service X -StartupType Automatic` |
| Logs | `Get-WinEvent -LogName System -MaxEvents 50`, `Get-WinEvent -FilterHashtable @{LogName='Application'; Level=2} -MaxEvents 50` |
| Firewall | `Get-NetFirewallProfile`, `New-NetFirewallRule -DisplayName "X" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow -RemoteAddress LocalSubnet`, `Remove-NetFirewallRule -DisplayName "X"`; export first: `netsh advfirewall export C:\fw-before.wfw` |
| Users | `Get-LocalUser`, `New-LocalUser`, `Add-LocalGroupMember -Group Administrators -Member X` |
| Disk | `Get-Volume`, `Get-PSDrive`, a restore point before a risky change: `Checkpoint-Computer -Description "before X"` |

Never turn off Defender, the firewall profile or UAC; never `Set-ExecutionPolicy Unrestricted`
machine-wide (`-Scope Process` for one run is enough). Scheduled jobs on Windows are the user's
own: yours go through Allkin's actions.
