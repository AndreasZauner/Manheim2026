# DECISIONS.md

## Bereits getroffene Entscheidungen

### 1. Architekturentscheidung
Die App wird als statische Web-App betrieben.

**Entscheidung:**
- Hosting: Cloudflare Pages
- Datenbank / Auth / Rollen: Supabase
- Codeverwaltung: GitHub

### 2. Rollenmodell
Die App arbeitet mit einem festen Rollenmodell.

**Entscheidung:**
- `admin`
- `professor`
- `technical_lead`
- `assistant`
- `trench_lead`
- `participant`
- `viewer`

### 3. Fachliche Leitungsstruktur
Die Amtsebene ist **nicht** Teil der technischen Grabungsleitung.

**Entscheidung:**
- Professor = Landesamt / rechtlich-organisatorische Außenebene
- technische Grabungsleitung = operative Gesamtsteuerung
- Assistenz = Doku-QS
- Schnittleiter = Feldlehre / Schnittverantwortung

### 4. Sicherheits- und Rechteansatz
Zentraler Online-Zugriff soll nicht über eine reine HTML-Datei mit lokalem Speicher laufen.

**Entscheidung:**
- zentrale Speicherung über Supabase
- Rechteverwaltung über Rollen + Datenbankregeln
- Nutzerzugang über Login

### 5. UI-Ansatz
Die Seite soll keine komplexe Entwickleroberfläche sein.

**Entscheidung:**
- übersichtlich
- farblich ruhig
- verständlich für Anfänger
- feldtauglich
- einfache Begriffe

### 6. Seed-Daten
Seed-Daten wurden aus dem Chatverlauf und einer Teilnehmerübersicht vorbereitet.

**Entscheidung:**
- Seed nur einmal einspielen
- spätere Wiederholung nur mit Konfliktbehandlung (`ON CONFLICT`) oder gezielter Bereinigung

### 7. Admin-Freischaltung
Der erste registrierte Benutzer wird nicht automatisch Admin.

**Entscheidung:**
- erste Admin-Freischaltung per SQL-Update auf `public.profiles`

### 8. Dokumentationslogik
Die App soll die Trennung von technischer Leitung, Doku-QS und Feldanleitung abbilden.

**Entscheidung:**
- keine Vermischung der Amtsebene mit Feldsteuerung
- Dokumentationskontrolle als eigener Bereich mit Assistenzbezug
