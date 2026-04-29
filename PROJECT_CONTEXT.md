# PROJECT_CONTEXT.md

## Kurzbeschreibung
Dieses Projekt ist eine webbasierte Planungs- und Organisationsplattform für die archäologische Lehrgrabung **Kerpen-Manheim 2026**.

Die Anwendung soll auf verschiedenen Geräten online nutzbar sein und eine gemeinsame, rollenbasierte Arbeitsumgebung für Grabungsleitung und Team schaffen.

## Fachkontext
- Ort: Kerpen-Manheim
- Zeitraum: 27.07.2026 bis 09.10.2026
- Grabungshaus: Kerpen-Buir
- Grabungsbüro: Kerpen
- Charakter: Lehrgrabung mit Studierenden

## Untersuchungsrahmen
Zu den relevanten inhaltlichen Schwerpunkten gehören:
- Antoniterhof
- spätmittelalterliche Hofkapelle
- Erweiterung Richtung historischer Marktplatz
- mögliche römische Grabenstruktur / Villa rustica
- Eremitage (nachrangig / optional)

## Organisatorischer Rahmen
Die App soll helfen bei:
- Gesamtplanung der Grabung
- Aufgabenverteilung
- Teilnehmerverwaltung
- Tages- und Wochensteuerung
- Timeline / Kalenderfunktion
- Dokumentations- und Qualitätskontrolle
- Strukturierung neuer Ideen und Stichpunkte

## Rollenverständnis
### Professor
Übernimmt Amtsebene, Abstimmung mit Landesamt und rechtlich-organisatorische Außenebene.

### Technische Grabungsleitung
Operative Gesamtsteuerung, Feldorganisation, Personal, Freigaben, Prioritäten, Qualitätskontrolle.

### Assistenz
Überblick über richtige Grabungsdokumentation, Prüfung von Vollständigkeit und Konsistenz.

### Schnittleiter
Direkte feldpraktische Anleitung der Studierenden und Verantwortung für definierte Schnitte / Teilbereiche.

### Studierende / Teilnehmende
Arbeiten unter Anleitung im Lehrgrabungskontext.

## Wichtige Anforderungen an die App
- browserbasiert
- mobil und desktopfähig
- lokal verständlich
- online gemeinsam nutzbar
- Login mit Rollen
- Admin-Freigaben
- später einfach erweiterbar

## Bereits umgesetzte Funktionsidee
Die bisherige App wurde als einfache Webanwendung mit folgenden Kernbereichen angelegt:
- Dashboard
- Timeline / Kalender
- Aufgabenverwaltung
- Ideen-Inbox
- Teilnehmerübersicht
- automatische Kategorisierung neuer Stichpunkte
- lokale Planungslogik nun auf Supabase-/Cloudflare-Basis vorbereitet
