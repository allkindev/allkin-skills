# Server-Gesundheitscheck

Für jeden Agenten, der Linux-Server betreut – per SSH über die Dienste von
Allkin erreicht, oder die Maschine, auf der Allkin läuft. Sie gibt dem Agenten
eine rein lesende Runde: Festplatte und Inodes, Speicher und Last, Dienste, die
laufen müssen, ausstehende und Sicherheitsupdates, Zertifikate, Backups,
lauschende Ports und Anmeldungen, Fehler in den Protokollen, die Uhr. Jede
Prüfung hat ihre Befehle und Schwellenwerte; die Messwerte jeder Runde werden
aufbewahrt, damit der Agent einen Trend sieht („bei diesem Tempo in zehn Tagen
voll“); der Bericht ist nach Dringlichkeit sortiert und schlägt zu jedem Befund
den genauen Befehl vor – den der Agent nicht ausführt.

Auf einer Runde wird nichts repariert, und was nicht geprüft werden konnte,
wird nie als in Ordnung gemeldet.

Sie gewährt nichts: Der Agent behält genau die Rechte, die er hat.
