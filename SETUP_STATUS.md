# SETUP_STATUS.md

## Zweck
Diese Datei hält den aktuellen technischen Stand fest.
Sie sollte nach jedem wichtigen Einrichtungsschritt aktualisiert werden.

## Aktueller bekannter Stand

### Repository
- GitHub-fertige Projektstruktur wurde erstellt.
- Enthalten sind Frontend-Dateien, Supabase-Schema, Seed-Daten und einfache Anleitungen.

### Supabase
- `schema.sql` wurde ausgeführt.
- `seed.sql` wurde ausgeführt.
- Es gab einen Fehler bei erneutem Einspielen der Seed-Daten in `participant_private` wegen doppelter `participant_id`.
- Dieser Fehler betrifft **nicht** die Admin-Aktivierung selbst.
- Admin-Aktivierung per `update public.profiles ...` wurde erfolgreich durchgeführt.

### Benutzerstatus
- Es gibt mindestens ein registriertes Benutzerkonto.
- Dieses Konto wurde erfolgreich auf `role = 'admin'` und `is_active = true` gesetzt.

### Cloudflare
- Deployment-Ziel ist Cloudflare Pages.
- Endgültiger Produktionsstatus im Repository dokumentieren, sobald die echte URL feststeht.

### Konfiguration
- `config.js` ist für Supabase URL und publishable / anon key vorgesehen.
- Es dürfen dort **keine Secret Keys** gespeichert werden.

## Noch zu ergänzen
Bitte nachtragen, sobald bekannt:

- Projektname in Cloudflare Pages:
- Produktions-URL (`pages.dev` oder Custom Domain):
- GitHub-Repository-URL:
- Supabase-Projektname:
- genutzte Site URL in Supabase:
- Redirect URL in Supabase:
- Stand der Custom Domain:

## Bekannte Stolperstellen
- Seed nicht einfach erneut komplett ausführen.
- Erst registrieren, dann Admin setzen.
- Redirect URL in Supabase erst korrekt setzen, wenn die echte Website-Adresse vorliegt.
