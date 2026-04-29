# CHAT_HANDOFF.md

## Zweck
Diese Datei fasst den bisherigen Chatverlauf so zusammen, dass Codex oder ein anderer Entwickler ohne den vollständigen Originalchat weiterarbeiten kann.

## Ausgangslage
Der Nutzer leitet technisch eine archäologische Lehrgrabung in Kerpen-Manheim 2026.
Er braucht ein digitales System zur Planung, Übersicht, Rollensteuerung und Zusammenarbeit.

## Fachliche Eckpunkte
- Zeitraum: 27.07.2026 bis 09.10.2026
- Unterkunft: Grabungshaus in Kerpen-Buir
- Grabungsbüro: Kerpen
- Lehrgrabung mit Studierenden
- Schwerpunktflächen: Antoniterhof, Hofkapelle, Marktplatz-Erweiterung, römische Struktur, ggf. Eremitage

## Wichtige organisatorische Klarstellung
Die Amtsebene und Abstimmung mit dem Landesamt wird **nicht** vom Nutzer selbst übernommen.
Dies liegt bei einem Professor.
Der Nutzer ist die **technische Grabungsleitung**.
Zusätzlich gibt es:
- einen Assistenten für Dokumentationskontrolle
- Schnittleiter für Feldanleitung
- Studierende / Teilnehmende

## Bereits erstellte Materialien im Projektkontext
Es wurden in diesem Arbeitsprozess bereits erstellt:
- Excel-Arbeitsmappe für Leitungsplanung
- Leitungsheft als DOCX/PDF
- lokale HTML-Planungsseite
- erweiterte HTML-Version mit Teilnehmerdaten
- Online-App-Paket für Cloudflare + Supabase
- GitHub-fertiges Paket

## Ziel der Online-App
- mehrere Geräte
- mehrere Benutzer
- Rollen mit Rechten
- Adminsteuerung
- Aufgabenverwaltung
- Ideen-Inbox
- Timeline / Kalender
- Teilnehmerübersicht
- online verfügbar

## Bisherige technische Entscheidung
Die lokal gespeicherte HTML-Datei reicht nicht für Mehrbenutzerbetrieb.
Deshalb wurde auf folgende Architektur umgestellt:
- GitHub = Codebasis
- Cloudflare Pages = Hosting
- Supabase = Datenbank, Auth, Rollen, zentrale Speicherung

## Supabase-Stand
- Schema wurde eingespielt
- Seed-Daten wurden eingespielt
- bei erneutem kompletten Einspielen trat ein Konflikt in `participant_private` auf
- Ursache: doppelte `participant_id` bei erneutem Seeding
- Lösung: Admin-Update separat ausführen, Seed nicht erneut blind komplett einspielen

## Erfolgreich gelöst
Das erste Benutzerkonto wurde erfolgreich per SQL zu Admin gemacht.

## Offene praktische Themen
- Produktions-URL / offizielle Domain
- evtl. schönere Domain als `pages.dev`
- weitere UI-Verbesserungen
- bessere Editierbarkeit und Komfortfunktionen
- evtl. konfliktfeste Seed-Strategie

## Wichtig für jede weitere Arbeit
- Nicht die Amtsebene in operative Feldleitung zurückmischen.
- Einfache Sprache in Doku und UI.
- Änderungen für Anfänger nachvollziehbar halten.
- Keine sensiblen Schlüssel oder geheimen Zugangsdaten committen.
