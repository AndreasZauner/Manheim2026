# Lehrgrabung Kerpen-Manheim 2026 – Online-Planer

Web-App für Aufgaben, Teilnehmende, Ideen, Rollenverwaltung und Kartenorganisation der Lehrgrabung Kerpen-Manheim 2026.

## Grundsetup

1. Projekt bei GitHub anlegen bzw. aktualisieren.
2. Supabase-Projekt verbinden.
3. `supabase/schema.sql` ausführen.
4. Optional `supabase/seed.sql` ausführen.
5. `config.js` mit Supabase URL und Anon Key bereitstellen.
6. Über Cloudflare Pages veröffentlichen.

## Kartenmodul

Das Kartenmodul wird über `map-module.js` und `map-module.css` geladen. Es ergänzt die Seitenleiste um den Menüpunkt `Karte` und nutzt MapLibre GL JS als Kartenbibliothek.

### SQL

Für die Kartenfunktionen zusätzlich ausführen:

1. `supabase/map_module.sql`
2. optional `supabase/map_seed.sql`

Die Live-Datenbank dieses Projekts wurde bereits erweitert.

### Datenmodell

- `map_layers`: thematische Layer, z. B. Organisation, Sicherheit, Infrastruktur, Grabungsflächen, Treffpunkte, Dokumentation und Logistik.
- `map_features`: GeoJSON-Geometrien mit Titel, Beschreibung, Status, Priorität, Rolle, Label und optionaler Verknüpfung zu Aufgaben oder Teilnehmenden.
- `map_feature_layers`: vorbereitet für zusätzliche Layer-Zuordnungen.

Geometrien werden als GeoJSON-kompatibles `jsonb` gespeichert.

### Rollenrechte

- `admin`: Layer anlegen, Objekte bearbeiten/löschen, Import und Export.
- `technical_lead`: Objekte bearbeiten/löschen, GeoJSON/Shape importieren, Export.
- `assistant`: Objekte und Doku-Hinweise bearbeiten, Export.
- `professor`, `trench_lead`, `participant`, `viewer`: lesender Zugriff.

Die Rechte werden durch Supabase RLS abgesichert.

### Bedienung

1. Menüpunkt `Karte` öffnen.
2. Basiskarte wählen: Standard, Satellit oder Topografie.
3. Layer und Filter links steuern.
4. Mit Punkt, Linie oder Fläche zeichnen.
5. Attribute rechts ergänzen und `Objekt speichern` klicken.
6. GeoJSON oder Shape-ZIP importieren, wenn die Rolle berechtigt ist.
7. Sichtbare Daten oder einzelne Layer als GeoJSON exportieren.

Shape-Import erwartet eine ZIP-Datei und wird clientseitig nach GeoJSON konvertiert.

## Tagesanwesenheit

Das Tagesstatus-Modul wird über `attendance-module.js` und `attendance-module.css` geladen. Es ersetzt die alten statischen Sidebar-Infos durch einen operativen Tagesstatus.

### SQL

Für die Anwesenheitsfunktion zusätzlich ausführen:

1. `supabase/attendance_module.sql`

Die Live-Datenbank dieses Projekts wurde bereits erweitert.

### Datenmodell

- `daily_attendance`: genau ein Tagesstatus pro Person und Datum.
- Wichtige Felder: `participant_id`, `date`, `status`, `note`, `created_by`, `updated_by`, `created_at`, `updated_at`.
- Erlaubte Statuswerte: `anwesend`, `abgesagt`, `krank`, `sonstiger_ausfall`, `verspaetet`, `halbtags`, `unklar`.

### Anzeige und Pflege

- Sidebar unten zeigt Datum, theoretisch laut Liste geplante Personen, reale Anwesenheit und Ausfälle.
- `Anwesend laut Liste` zählt Personen, deren Verfügbarkeitszeitraum den heutigen Tag einschließt und deren Status nicht inaktiv oder anzufragen ist.
- `Real anwesend` kommt ausschließlich aus `daily_attendance`.
- Im Bereich `Teilnehmende` erscheint die Box `Heutige Anwesenheit`; dort pflegen berechtigte Rollen Status und Notiz pro Person.

### Rollenrechte

- `admin`, `technical_lead`, `assistant`: Tagesanwesenheit anlegen und bearbeiten.
- `admin`, `technical_lead`: Tagesanwesenheit löschen.
- alle aktiven freigeschalteten Rollen: lesen.
