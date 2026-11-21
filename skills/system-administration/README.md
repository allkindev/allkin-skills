# System administration

The method and the commands to administer a machine, whatever its system: every Linux
distribution (Debian, Ubuntu, Fedora, RHEL, Arch, openSUSE, Alpine, Void, Gentoo, Solus) and
every init (systemd, OpenRC, runit, s6), containers and WSL — and macOS, FreeBSD and Windows for
the machines reached over SSH or through Allkin Client.

With it, the agent:

- **recognises the system first**, and uses its own package manager, init and firewall;
- **installs, updates and removes software** from trusted sources, says where it comes from and
  whether a reboot is needed;
- **manages services, users, disks, the network, the firewall and SSH**, backing up what it
  changes and arming the way back before anything that could cut the access;
- **writes automation scripts** that can be trusted: idempotent, with a dry run, logs and a
  notification on failure — started by you as a Shortcut or by an Allkin action, never by a
  hidden schedule.

It never shuts a machine down, never weakens security without saying so, never fetches and runs
a script in one go. It widens no right: every command is still shown to you on its card.
