# Community-Management

Für einen Agenten, der Ihre sozialen Netzwerke betreibt — X, Facebook, Instagram, Threads,
LinkedIn, YouTube, TikTok, Mastodon, Bluesky, Pinterest. Er hält Ihre **redaktionelle Linie**
und Ihren **Kalender** in Dateien seines Ordners, schreibt jeden Beitrag einmal und **passt ihn
an jedes Netzwerk an** (die Länge, wie das Netzwerk sie zählt, Hashtags an ihrem Platz, der Link
dort, wo er nicht schadet, ein Thread bei langem Text), **prüft ihn** vor jedem Versand (Grenzen,
verbotene Wörter, Medienformate, ein Duplikat der letzten dreißig Tage), **sortiert Kommentare
und Erwähnungen** aller Netzwerke in eine Liste — Dringendes zuerst, Spam beiseite — und schlägt
die Antworten vor, **sammelt die Zahlen** und schreibt den Monatsbericht mit Zahlen aus Skripten,
nie aus dem Eindruck des Modells.

## Was er braucht

- **Nichts**, um zu schreiben, zu planen und zu prüfen: Sie kopieren und veröffentlichen von Hand.
- **Einen Service pro Netzwerk** (X, Meta, LinkedIn, YouTube, Mastodon, Bluesky…), auf der
  Seite Services verbunden und dem Agenten gewährt, um aus Allkin zu veröffentlichen, zu lesen
  und zu messen. Jeder Aufruf, der veröffentlicht, antwortet oder löscht, zeigt Ihnen zuerst
  eine Karte.
- Das Recht „Darf Aktionen planen“ und die Fähigkeit „Aktionen verwalten“, um einen Beitrag als
  Allkin-Aktion zu planen; das Web-Recht für die Beobachtung.
- Seine Skripte laufen über Allkins `run_skill_script` in einem geschlossenen Rahmen (nur der
  Ordner Ihres Agenten, ohne Netz): eine Karte beim ersten Mal, dann „Diese Fähigkeit immer
  erlauben“, wenn Sie möchten.

## Was sie nicht tut

Sie gewährt nichts: ohne Service keine Veröffentlichung; ohne Web-Recht keine Beobachtung. Sie
veröffentlicht, antwortet und löscht nie ohne Ihre Karte, bittet Sie nie, die Freigabe
abzuschalten, speichert weder Passwort noch Token und sendet noch keine Bilder oder Videos (die
Services der Netzwerke können noch keine Dateien senden): der Text geht raus, Sie fügen das Bild
an.
