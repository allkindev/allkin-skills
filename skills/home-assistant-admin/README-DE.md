# Home-Assistant-Administration

Für jeden Agenten, der sich um eine Home-Assistant-Installation kümmert, die
über den Dienst **Home Assistant** von Allkin erreicht wird. Sie gibt dem
Agenten eine Methode und die genauen Befehle für vier Arbeiten:

- **Neue Geräte** — er hört auf Wunsch die Zigbee- (ZHA oder Zigbee2MQTT),
  Z-Wave- und RFXCOM-Netze ab, sieht, was hinzukommt, sagt Ihnen, was jedes
  Gerät ist, und fragt, was Sie damit tun möchten: sein Name, sein Raum, was
  ausgeblendet werden soll.
- **Namen und Räume** — er schlägt ein Namensschema mit Beispielen aus Ihrem
  eigenen Haus vor (`light.lustre_salon`, `binary_sensor.do_entree`…), benennt
  im Stapel um und repariert die Automationen und Dashboards, die die alten
  Kennungen nannten.
- **Automationen, Skripte, Szenen** — er formuliert Ihren Wunsch als „wenn,
  nur falls, dann“, prüft, dass jede Entität existiert, validiert, legt an und
  testet mit Ihrer Zustimmung.
- **Dashboards** — er fragt, wer darauf schaut und auf welchem Bildschirm,
  baut Ansichten nach Nutzung und überschreibt nie ein Dashboard, ohne die
  vorherige Fassung aufzubewahren.

Jede Arbeit folgt derselben Reihenfolge: lesen, vorschlagen, Ihre Zustimmung
einholen, den Rückweg sichern, ändern, prüfen, berichten. Was der Agent nicht
prüfen konnte — das Aussehen eines Dashboards, die Reaktion eines Geräts —,
sagt er.

## Was sie braucht

- Den Dienst **Home Assistant** mit einem langlebigen Zugriffstoken eines
  Administrators, dem Agenten gewährt — mit Schreibrecht; ohne es kann der
  Agent nur lesen und zuhören.
- Sonst nichts: Sie gewährt nichts. Der Agent behält genau die Rechte, die er
  hat.

## Was Sie sehen werden

Das Lesen der Installation verlangt nichts von Ihnen. Jede Änderung — eine
Umbenennung, ein Raum, ein gespeichertes Dashboard, ein zum Koppeln geöffnetes
Netz — zeigt eine Freigabekarte in der Unterhaltung, eine einzige für den
ganzen Stapel, die Sie für die Sitzung freigeben können.

## Grenzen

- Von Hand in YAML geschriebene Dateien (`configuration.yaml`, Packages,
  Dashboards im YAML-Modus) sind nicht erreichbar: Der Agent sagt Ihnen, was
  dort zu ändern ist.
- Eine Integration, die ein Konto oder ein Passwort verlangt, fügen Sie selbst
  hinzu, in Home Assistant.
- Home Assistant anzuhalten oder seine Maschine herunterzufahren, wird jedem
  Agenten verweigert. Ein Neustart bleibt möglich, mit seiner Karte.
