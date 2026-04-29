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
