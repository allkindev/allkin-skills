# Dienste erstellen

Für jeden Agenten, den du Dienste für Allkin bauen lassen willst. Ein Dienst ist das, was Allkin
mit einer externen API verbindet: eine Definition – Daten, nie Code –, die sagt, wo die API liegt,
wie der Schlüssel übertragen wird, wie die Verbindung getestet wird, welche Aufrufe auf deine
Freigabe warten und was ein Agent wissen muss, um sie zu nutzen. Mit dieser Fähigkeit trägt der
Agent diese Angaben mit dir zusammen, schreibt die Definition und ihre Hilfe in den vier Sprachen
in seine **Werkstatt** (den Ordner `workshop/` in seinem eigenen Ordner), prüft sie nach dem
Standard von Allkin und korrigiert sie, bis nichts mehr zu beheben ist.

Sie ist der Schlüssel der Werkstatt-Werkzeuge: Ein Agent mit ihr erhält sie – die Liste seiner
Projekte und ihre Prüfung –, ein Agent ohne sie hat keines davon. Was der Agent schreibt,
erscheint auf der Seite **Dienste**.

Sie erweitert kein Recht: Weder Befehle noch Netzwerk noch Zugriff auf irgendeinen Dienst kommen
mit ihr – nicht einmal auf den, den er schreibt. **Nur du verbindest** einen Dienst, auf dieser
Seite, mit einem Schlüssel, den der Agent nie sieht und den du ihm nie geben darfst, und nur du
gewährst ihn den Agenten. Signierte Anfragen und E-Mail-Transport liegen außerhalb der Reichweite
einer solchen Definition. Nur du gibst diese Fähigkeit einem Agenten.
