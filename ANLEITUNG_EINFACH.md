# Einfache Anleitung: GitHub → Supabase → Cloudflare

Diese Anleitung ist absichtlich sehr einfach geschrieben.
Sie brauchen keine Programmierkenntnisse.

---

## Ziel

Am Ende haben Sie:
- eine **online erreichbare Seite**
- **Login** für verschiedene Personen
- **Adminrechte** für sich selbst
- **Rollen** für andere Teilnehmende
- zentrale Speicherung Ihrer Daten

---

## Was Sie dafür brauchen

Sie brauchen drei kostenlose Konten:
1. **GitHub** – dort liegt der Code
2. **Supabase** – dort liegen Daten, Login und Rollen
3. **Cloudflare** – dort wird die Seite online veröffentlicht

---

# Teil 1 – GitHub

## Schritt 1: GitHub-Konto anlegen
Wenn Sie noch kein GitHub-Konto haben, erstellen Sie eines.

## Schritt 2: Neues Repository anlegen
1. Bei GitHub einloggen
2. Oben rechts auf das **Plus-Symbol** klicken
3. **New repository** wählen
4. Name eingeben, z. B.:
   `lehrgrabung-kerpen-manheim-2026`
5. Auf **Create repository** klicken

## Schritt 3: Dateien hochladen
1. Im neuen Repository auf **Add file** klicken
2. **Upload files** wählen
3. Den **gesamten Inhalt** dieses Ordners hochladen
4. Unten auf **Commit changes** klicken

Wichtig:
Es müssen diese Dateien mit hochgeladen werden:
- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- `config.example.js`
- Ordner `supabase`

---

# Teil 2 – Supabase

## Schritt 4: Supabase-Projekt anlegen
1. Bei Supabase anmelden
2. **New project** anlegen
3. Projektname vergeben
4. Warten, bis das Projekt fertig erstellt ist

## Schritt 5: API-Daten finden
In Supabase:
1. **Project Settings** öffnen
2. **API** öffnen
3. diese zwei Werte kopieren:
   - **Project URL**
   - **anon / publishable key**

## Schritt 6: Datenbank einrichten
1. In Supabase links auf **SQL Editor** klicken
2. **New query** anklicken
3. Datei `supabase/schema.sql` öffnen
4. gesamten Inhalt hineinkopieren
5. auf **Run** klicken

Danach das gleiche mit:
- `supabase/seed.sql`

## Schritt 7: config.js füllen
Jetzt wieder zu Ihrem GitHub-Projekt oder lokal zu Ihrem Ordner.

Öffnen Sie `config.js` und tragen Sie dort die beiden Werte ein:

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://IHRE-PROJEKT-ID.supabase.co',
  SUPABASE_ANON_KEY: 'IHR-ANON-KEY',
  PROJECT_SLUG: 'lehrgrabung-kerpen-manheim-2026'
};
```

Dann speichern.

Wenn Sie die Datei direkt in GitHub ändern wollen:
1. Datei `config.js` im Repository anklicken
2. auf das **Stift-Symbol** klicken
3. Werte eintragen
4. unten auf **Commit changes** klicken

---

# Teil 3 – Cloudflare Pages

## Schritt 8: Cloudflare-Konto anlegen
Wenn Sie noch kein Konto haben, erstellen Sie eines.

## Schritt 9: GitHub mit Cloudflare verbinden
1. In Cloudflare auf **Workers & Pages** gehen
2. **Create application** klicken
3. **Pages** wählen
4. **Connect to Git** wählen
5. GitHub verbinden
6. Ihr Repository auswählen

## Schritt 10: Projekt veröffentlichen
Bei den Einstellungen:
- Framework preset: **None**
- Build command: **leer lassen**
- Build output directory: **/** oder leer, falls möglich

Dann auf **Save and Deploy** klicken.

Cloudflare erstellt jetzt eine Internetadresse wie:
`https://ihr-projektname.pages.dev`

---

# Teil 4 – Supabase mit der Online-Adresse verbinden

## Schritt 11: Redirect-Adressen eintragen
In Supabase:
1. links **Authentication** öffnen
2. **URL Configuration** öffnen
3. bei **Site URL** Ihre Cloudflare-Adresse eintragen
   Beispiel:
   `https://ihr-projektname.pages.dev`
4. bei **Redirect URLs** ebenfalls eintragen:
   `https://ihr-projektname.pages.dev/**`

Dann speichern.

---

# Teil 5 – Erstes Konto anlegen und Admin werden

## Schritt 12: Seite öffnen
Öffnen Sie jetzt Ihre neue Online-Adresse im Browser.

## Schritt 13: Registrieren
Legen Sie ein Konto mit Ihrer E-Mail-Adresse an.

## Schritt 14: Sich selbst zum Admin machen
Danach in Supabase wieder in den **SQL Editor** gehen und diesen Befehl ausführen:

```sql
update public.profiles
set role = 'admin',
    is_active = true
where email = 'IHREMAIL@BEISPIEL.DE';
```

Ihre E-Mail-Adresse einsetzen und **Run** drücken.

Dann die Seite neu laden und erneut anmelden.

Jetzt sind Sie **Admin**.

---

# Teil 6 – Andere Personen zulassen

## Schritt 15: Andere registrieren sich selbst
Andere Teilnehmende können sich jetzt auf der Seite registrieren.

## Schritt 16: Sie schalten diese frei
Als Admin können Sie später:
- Benutzer aktivieren
- Rollen vergeben
- steuern, wer was sehen oder ändern darf

---

# Empfohlene Rollen

- `admin` – Sie
- `professor` – Professor
- `technical_lead` – technische Grabungsleitung
- `assistant` – Assistent / Dokumentation
- `trench_lead` – Schnittleitung
- `participant` – Teilnehmende
- `viewer` – nur lesen

---

# Wenn etwas nicht funktioniert

## Die Seite zeigt keine Daten oder nur Setup-Hinweise
Dann ist meistens `config.js` noch leer oder falsch ausgefüllt.

## Login klappt nicht
Dann prüfen:
- stimmt die **Site URL** in Supabase?
- stimmt die **Redirect URL**?
- wurde `schema.sql` wirklich ausgeführt?

## Die Seite ist online, aber nicht aktuell
Dann in GitHub prüfen, ob Ihre Änderung wirklich gespeichert wurde.
Cloudflare veröffentlicht nach GitHub-Änderungen automatisch neu.

---

# Mein Rat für den Alltag

Änderungen an Texten oder kleinen Konfigurationen können Sie direkt in GitHub im Browser machen.
Dann brauchen Sie kein Programm auf dem Rechner zu installieren.

---

# Kurzfassung

1. GitHub-Repository anlegen
2. Dateien hochladen
3. Supabase-Projekt anlegen
4. `schema.sql` ausführen
5. `seed.sql` ausführen
6. `config.js` mit URL und Key füllen
7. Cloudflare mit GitHub verbinden
8. Seite deployen
9. Site URL in Supabase eintragen
10. eigenes Konto registrieren
11. per SQL zu Admin machen

Dann läuft die Seite online.
