# AGENTS.md

## Projekt
Dieses Repository enthält die Web-App und Infrastrukturdateien für die Lehrgrabung **Kerpen-Manheim 2026**.

Ziel ist eine online verfügbare, rollenbasierte Planungs- und Organisationsplattform für die Grabungsleitung, Assistenz, Schnittleitungen und Teilnehmenden.

## Fachlicher Rahmen
- Projekt: archäologische Lehrgrabung in Kerpen-Manheim
- Zeitraum der Maßnahme: **27.07.2026 bis 09.10.2026**
- Unterkunft: Grabungshaus in **Kerpen-Buir**
- Grabungsbüro: **Kerpen**, noch einzurichten bzw. digital/organisatorisch mitzudenken

## Rollenmodell im Projekt
- `admin`: Hauptverwaltung der App, Benutzerfreischaltung, volle Projektkontrolle
- `professor`: Amtsebene / Landesamt / rechtlich-organisatorische Außenebene
- `technical_lead`: technische Grabungsleitung, operative Gesamtsteuerung
- `assistant`: Dokumentationsaufsicht und Qualitätskontrolle
- `trench_lead`: Schnittleitung und Feldanleitung
- `participant`: Teilnehmende / Studierende
- `viewer`: nur lesender Zugriff

## Wichtige fachliche Festlegung
Die **Amtsebene liegt nicht bei der technischen Grabungsleitung**.
Der Professor übernimmt Abstimmung mit Landesamt und rechtlich-organisatorische Außenkommunikation.
Die App soll diese Struktur respektieren.

## Technische Architektur
- Frontend: statische Web-App (`index.html`, `styles.css`, `app.js`)
- Hosting: **Cloudflare Pages**
- Datenbank + Auth + Rollen: **Supabase**
- Quellcodeverwaltung: **GitHub**

## Arbeitsprinzipien für Codex
1. Lies zuerst diese Datei und danach:
   - `README.md`
   - `docs/PROJECT_CONTEXT.md`
   - `docs/DECISIONS.md`
   - `docs/SETUP_STATUS.md`
   - `docs/NEXT_STEPS.md`
   - `docs/CHAT_HANDOFF.md`
2. Nimm **kleine, nachvollziehbare Änderungen** vor.
3. Keine destruktiven Änderungen an `supabase/schema.sql` ohne Begründung.
4. Keine sensiblen Daten neu in das Repository schreiben.
5. Bestehende Seed-Daten nur vorsichtig anfassen; erneutes Seeding kann zu Konflikten führen.
6. Änderungen an Rollen, Policies oder Auth nur mit klarer Kommentierung.
7. Dokumentation in **einfachem Deutsch** halten, da das Projekt von Nicht-Entwicklern bedient wird.
8. Wenn du neue Dateien anlegst, halte die Struktur schlicht und gut wartbar.
9. Bevorzugt Vanilla JS / einfache Lösungen; keine unnötigen Frameworks einführen.
10. UI-Änderungen sollen die Seite **übersichtlich, farblich ruhig und feldtauglich** halten.

## Was dieses Projekt besonders braucht
- gute Übersicht
- einfache Bedienung im Browser
- Rollen- und Rechtesystem
- klare Timeline / Kalenderfunktion
- gute Ergänzbarkeit neuer Ideen und Informationen
- automatische oder halbautomatische Zuordnung neuer Stichpunkte zu passenden Bereichen
- saubere Trennung zwischen öffentlichen und internen Teilnehmerdaten

## Vorsichtspunkte
- Seed-Daten wurden bereits eingespielt.
- Es gab einen Konflikt bei erneutem Seeding in `participant_private` wegen doppelter `participant_id`.
- Admin-Aktivierung erfolgt separat über SQL-Update auf `public.profiles`.
- `config.js` enthält projektspezifische Supabase-Werte und darf nicht mit geheimen Schlüsseln gefüllt werden.

## Stil für weitere Arbeit
- pragmatisch
- verständlich
- robust
- dokumentiert
- möglichst wenig Magie
