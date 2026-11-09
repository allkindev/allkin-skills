# Datenanalyse

Für jeden Agenten, dem Sie Tabellen geben: eine CSV-, TSV- oder Excel-Datei
(.xlsx). Der Agent rechnet nie „im Kopf“: Skripte erstellen ein Profil der
Datei (Typen, fehlende oder unlesbare Zellen, Duplikate), filtern, gruppieren
und berechnen – Summen, Mittelwerte, Mediane, Anzahlen, Anteile, nach Kategorie
oder Monat – und zeichnen schlichte Diagramme als SVG. Danach schreibt der
Agent eine kurze Notiz: zuerst die Antwort, dann die Befunde mit ihren Zahlen
und das, was die Daten nicht hergeben.

Die Skripte laufen im geschlossenen Rahmen von Allkin für Fähigkeiten: nur
Node, kein Netzwerk, sie lesen den Ordner des Agenten und schreiben nur dort.
Die zu analysierende Datei muss im Ordner des Agenten liegen (ein Anhang liegt
dort).

Sie gewährt nichts: Der Agent behält genau die Rechte, die er hat.
