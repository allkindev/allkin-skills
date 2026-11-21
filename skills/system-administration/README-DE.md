# Systemadministration

Die Methode und die Befehle, um eine Maschine zu verwalten, welches System sie auch hat: alle
Linux-Distributionen (Debian, Ubuntu, Fedora, RHEL, Arch, openSUSE, Alpine, Void, Gentoo, Solus)
und alle Init-Systeme (systemd, OpenRC, runit, s6), Container und WSL — sowie macOS, FreeBSD und
Windows für Maschinen, die über SSH oder Allkin Client erreicht werden.

Damit:

- **erkennt der Agent zuerst das System** und nutzt dessen eigenen Paketmanager, sein Init und
  seine Firewall;
- **installiert, aktualisiert und entfernt er Software** aus vertrauenswürdigen Quellen, sagt,
  woher sie kommt und ob ein Neustart nötig ist;
- **verwaltet er Dienste, Benutzer, Festplatten, das Netzwerk, die Firewall und SSH**, sichert,
  was er ändert, und bereitet den Rückweg vor allem vor, was den Zugang abschneiden könnte;
- **schreibt er vertrauenswürdige Automatisierungsskripte**: ohne Schaden wiederholbar, mit
  Probelauf, Protokoll und Benachrichtigung bei einem Fehler — von Ihnen als Verknüpfung oder
  von einer Allkin-Aktion gestartet, nie über eine versteckte Planung.

Er schaltet nie eine Maschine aus, schwächt nie die Sicherheit, ohne es zu sagen, lädt nie ein
Skript herunter und führt es in einem Zug aus. Sie erweitert kein Recht: Jeder Befehl wird Ihnen
weiterhin auf seiner Karte gezeigt.
