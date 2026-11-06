# Agenten migrieren

Holen Sie die Agenten, die Sie auf **OpenClaw** (früher Clawdbot, Moltbot) oder **NanoClaw**
gebaut haben, in Allkin. Der Agent mit dieser Fähigkeit — das Modell **Migrator** ist dafür
gemacht — liest ein Archiv Ihrer alten Installation, lässt ihre Geheimnisse zurück und gibt Ihnen
ein Archiv pro Agent zum Importieren, mit einer kurzen Liste dessen, was noch zu tun ist.

Ziel ist eine gute Migration, keine perfekte Kopie: Was einfach in Allkin passt, wird übernommen,
der Rest wird für Sie aufgelistet.

## Was übernommen wird

| Aus | In Allkin |
|---|---|
| Identität, Seele, Arbeitsregeln (`IDENTITY.md`, `SOUL.md`, `AGENTS.md`) — die `CLAUDE.md` einer Gruppe bei NanoClaw | die **Rolle** des Agenten, als ein Text neu geschrieben |
| Langzeitgedächtnis (`MEMORY.md`, `CLAUDE.local.md`) | das **Gedächtnis** des Agenten (seine dauerhaften Fakten) |
| Tagesnotizen, Dateien einer Gruppe | **Dateien** des Agenten |
| Fähigkeiten (Skills) | **Fähigkeiten**, in einem Repository, das Sie in den Einstellungen hinzufügen |

## Was für Sie aufgelistet wird

- **Geplante Aufgaben und Heartbeat** → die anzulegenden **Aktionen** (Agent, Zeit, Nachricht).
- **Kanäle** (Telegram, Discord…) → die zu verbindende Integration oder der Service. WhatsApp,
  Signal und iMessage haben noch keine Entsprechung.
- **Geheimnisse**, die Sie erneut eingeben müssen, mit Namen — nie ihr Wert.
- **Skripte**, die so nicht laufen können (Python, Shell, Netzwerkaufrufe): beiseitegelegt, mit
  Begründung.
- Was Sie über sich gesagt hatten (`USER.md`), um es bei Bedarf Ihrem Profil hinzuzufügen.

Unterhaltungen werden nicht migriert.

## So verwenden Sie sie

1. Erstellen Sie auf ihrem Rechner ein Zip Ihrer alten Installation:
   - OpenClaw: `cd ~ && zip -r openclaw.zip .openclaw -x '.openclaw/agents/*/sessions/*' '*/node_modules/*'`
   - NanoClaw: `zip -r nanoclaw.zip nanoclaw -x '*/node_modules/*' 'nanoclaw/data/sessions/*'`
2. Hängen Sie das Zip in einer Unterhaltung mit dem Agenten an und bitten Sie ihn um die Migration.
3. Beantworten Sie sein Formular: welche Agenten, welche Fähigkeiten, welche Dateien.
4. Folgen Sie seiner Liste: Importieren Sie jedes Archiv (das „+" der Agentenliste › Agent
   importieren), fügen Sie das Repository der Fähigkeiten hinzu, erteilen Sie die gewünschten
   Rechte, verbinden Sie die Services, legen Sie die Aktionen an.

## Sicherheit

Das Zip enthält Ihre Geheimnisse: Die Skripte der Fähigkeit entpacken nie Zugangsdaten,
Transkripte oder die Werte der `.env` und ersetzen jedes Token und jeden Schlüssel der
Konfiguration; ein Archiv wird abgelehnt, solange etwas übrig bleibt, das wie ein Geheimnis
aussieht. Der Code der alten Plattform wird gelesen, nie ausgeführt. Ein importierter Agent kommt
ohne jedes Recht an, wie jeder Import, und die umgewandelten Fähigkeiten warten auf Ihre
Freigabe wie alles aus Ihren eigenen Repositories. Löschen Sie das Zip aus dem Ordner `Upload/`
des Agenten, wenn Sie fertig sind.

Was der Agent braucht: nichts außer dieser Fähigkeit. Die Skripte laufen im geschlossenen Rahmen
von Allkin (nur Node, kein Netzwerk, nur im Ordner Ihres Agenten).
