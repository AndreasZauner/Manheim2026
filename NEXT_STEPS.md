# NEXT_STEPS.md

## Ziel
Diese Liste beschreibt die nächsten sinnvollen Arbeitsschritte in Prioritätsreihenfolge.

## Sofort als Nächstes

### 1. Produktions-URL festhalten
- Cloudflare Pages Deployment prüfen
- finale `pages.dev`-Adresse dokumentieren
- später ggf. Custom Domain ergänzen

### 2. Supabase URL Configuration final setzen
- Site URL eintragen
- Redirect URL eintragen
- Magic Link / Login-Rückleitung testen

### 3. Adminbereich praktisch testen
- Admin-Login prüfen
- Rollenvergabe testen
- Benutzerfreischaltung testen

### 4. GitHub-Repository aufräumen
- Dokumentation prüfen
- Handoff-Dateien committen
- veraltete lokale Artefakte vermeiden

## Danach

### 5. UI-Verbesserungen
- bessere Rollenanzeige
- klarere Teilnehmeransicht
- komfortablere Bearbeitung einzelner Einträge
- mögliche Drag-and-drop-Funktion

### 6. Kalender / Timeline ausbauen
- bessere Wochenansicht
- Filter nach Rolle / Kategorie
- kommende Fristen prominenter anzeigen

### 7. Ideen-Inbox verbessern
- automatische Zuordnung transparenter machen
- manuelle Korrekturmöglichkeit nach automatischer Kategorisierung einbauen

### 8. Datenpflege verbessern
- Seed-Daten konfliktfest machen
- Importwege für neue Teilnehmerdaten verbessern
- sensible Datenbereiche noch klarer abgrenzen

### 9. Offizielle Domain planen
- Uni-Subdomain prüfen
- alternativ eigene Domain festlegen
- Supabase danach auf finale Domain umstellen

## Technische Hinweise für Codex
- Änderungen bitte klein halten.
- Bei SQL-Änderungen Rückwärtskompatibilität mitdenken.
- Falls Seed-Daten angepasst werden, Wiederholbarkeit bedenken.
