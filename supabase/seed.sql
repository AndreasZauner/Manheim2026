-- Public starter data for the Lehrgrabung Kerpen-Manheim 2026 planner.
-- Run after schema.sql. This file intentionally contains no phone numbers
-- and no private email addresses.

insert into public.tasks
  (title, description, category, subcategory, due_date, status, priority, assigned_role)
values
  ('Offene Verfügbarkeiten und Zusagen mit Teilnehmenden klären', 'Unklare Zusagen, Zusatzwochen und Sonderfälle aus der Teilnehmerübersicht nachfassen.', 'personal', 'Teilnehmendenmanagement', '2026-05-08', 'offen', 'hoch', 'Technische Leitung'),
  ('Schnittleiter benennen und Einsatzbereiche vorstrukturieren', 'Schnitte/Teilflächen und Lehrverantwortung pro Schnittleiter definieren.', 'schnitte', 'Feldorganisation', '2026-05-15', 'offen', 'hoch', 'Technische Leitung'),
  ('Grabungsbüro in Kerpen sichern und Einrichtungsplan erstellen', 'Arbeitsplätze, Lager, Druck/Scan, Fundannahme, Strom und Internet festlegen.', 'logistik', 'Grabungsbüro', '2026-05-22', 'offen', 'hoch', 'Technische Leitung'),
  ('Warnwestenbedarf und Größen erfassen', 'Stückzahlen nach Rollen, Größenmix und Druckvarianten für Team und Leitungsfunktionen festlegen.', 'logistik', 'Ausstattung', '2026-05-26', 'offen', 'mittel', 'Technische Leitung'),
  ('Dokumentationssystem finalisieren', 'Nummernkreise, Befundblätter, Foto-Logik, Freigaben und QC-Prozess mit Assistenz festziehen.', 'dokumentation', 'Standards', '2026-06-05', 'offen', 'hoch', 'Assistenz / Doku-QS'),
  ('Material- und Geräteinventar prüfen', 'Werkzeug, Kamera, Ladegeräte, Messausstattung, Fundmaterial, Regale und Verbrauchsmaterial erfassen.', 'logistik', 'Material', '2026-06-12', 'offen', 'hoch', 'Technische Leitung'),
  ('Transport- und Pendelplan Buir-Kerpen-Manheim erstellen', 'Fahrzeuge, Fahrer, Schlüssel, Abfahrtszeiten und Materialtransport definieren.', 'logistik', 'Transport', '2026-06-19', 'offen', 'mittel', 'Technische Leitung'),
  ('Onboarding-Paket für Studierende fertigstellen', 'Hausregeln, Tagesablauf, Sicherheitsunterweisung, Schnittzuweisung und Ansprechpersonen bündeln.', 'personal', 'Onboarding', '2026-06-26', 'offen', 'mittel', 'Technische Leitung'),
  ('Leitungsbriefing mit Assistent und Schnittleitern vorbereiten', 'Berichtslinien, Freigabepunkte und tägliche Besprechungsstruktur vor Saisonbeginn testen.', 'steuerung', 'Leitungsstruktur', '2026-07-03', 'offen', 'mittel', 'Technische Leitung'),
  ('Sicherheits- und Notfallstruktur einsatzfähig machen', 'Erste Hilfe, Notfallkontakte, Hitze-/Wetterregime und Feldkommunikation praktisch vorbereiten.', 'sicherheit', 'Notfall', '2026-07-10', 'offen', 'hoch', 'Technische Leitung'),
  ('Einrichtungswoche starten', 'Haus, Büro, Lager, Nummernkreise, Materialwege und Einweisungen live anfahren.', 'steuerung', 'Grabungsstart', '2026-07-27', 'offen', 'hoch', 'Technische Leitung'),
  ('Abschlussstrategie zwei Wochen vor Ende aktivieren', 'Keine neuen Großflächen ohne Abschlusskapazität; Doku- und Fundrückstände abbauen.', 'steuerung', 'Abschluss', '2026-09-25', 'offen', 'hoch', 'Technische Leitung')
on conflict do nothing;

insert into public.notes
  (title, body, category, subcategory, note_type, status)
values
  ('Rollenmodell der Grabung', 'Professor übernimmt Amtsebene und rechtlich-organisatorische Außenebene. Technische Grabungsleitung steuert operativ. Assistenz überwacht Dokumentationsqualität. Schnittleiter lehren im Feld. Studierende arbeiten unter Anleitung.', 'steuerung', 'Leitungsstruktur', 'decision', 'aktiv'),
  ('Untersuchungsschwerpunkte', 'Antoniterhof Priorität 1, Hofkapelle Priorität 2, Erweiterung Richtung historischer Marktplatz Priorität 3, römische Grabenstruktur/Villa-rustica-Frage Priorität 4, Eremitage optional nachrangig.', 'schnitte', 'Flächenpriorisierung', 'note', 'aktiv'),
  ('Unterkunft und Infrastruktur', 'Grabungshaus in Kerpen-Buir ist als Unterkunft gesetzt. Grabungsbüro in Kerpen muss einsatzfähig eingerichtet werden. Wohn- und Arbeitsfunktionen klar trennen.', 'logistik', 'Infrastruktur', 'note', 'aktiv'),
  ('Dokumentationsprinzip', 'Kein Profilabbau und kein Befundabschluss ohne dokumentarische Freigabe. Assistenz kontrolliert täglich Nummernkreise, Befundblätter, Fotos, Pläne und Nachdokumentation.', 'dokumentation', 'Freigaben', 'decision', 'aktiv'),
  ('Lehrgrabungsprinzip', 'Schnittleiter sind nicht nur Aufsicht, sondern didaktische Anleiter. Lernaufgaben, qualitätskritische Aufgaben und zeitkritische Aufgaben müssen bewusst getrennt werden.', 'personal', 'Lehre', 'decision', 'aktiv'),
  ('Tägliche Leitungsroutine', 'Morgens Leitungsbriefing, tagsüber Rundgänge und Rückmeldungen aus allen Schnitten, abends Kurz-Auswertung mit offenen Punkten und Plan für den Folgetag.', 'steuerung', 'Tagesbetrieb', 'note', 'aktiv'),
  ('Teilnehmendenlage laut Auswertung', 'Bisher 16 Personen in der Übersicht; Maximalbelegung laut Auswertungsblatt 10 gleichzeitig, Durchschnitt 4,4 aktive Teilnehmende.', 'personal', 'Kapazität', 'note', 'aktiv'),
  ('Offene Personalfälle', 'Zu klären sind u. a. Arbeitgeberfreigabe Rudolf Jürgens, Verlängerungsoption Jakob Redepenning, Sardinien-Pause Jakob Hetesy, Datumsangaben Finn Fesq und Phil Föckersperger.', 'personal', 'Offene Punkte', 'idea', 'offen'),
  ('Warnwesten und Außenauftritt', 'Bestellung hochwertiger, aber preisgünstiger Warnwesten mit Schriftzug und Unilogo als separates Beschaffungspaket einplanen.', 'logistik', 'Ausstattung', 'idea', 'offen')
on conflict do nothing;

insert into public.participants
  (full_name, public_role, availability_from, availability_to, status, availability_note, source_note)
values
  ('Yva Stamminger', 'Teilnehmende', '2026-08-10', '2026-08-28', 'zugesagt', 'Auch andere Termine möglich; nicht 31.08.-04.09.', 'Aus Teilnehmerübersicht übernommen.'),
  ('Mijana Terzic-Tanaskovic', 'Teilnehmende', '2026-08-03', '2026-08-28', 'zugesagt', 'Auch ab 01.08 möglich; evtl. bis 31.08.', 'Aus Teilnehmerübersicht übernommen.'),
  ('Verena Laubenbacher', 'Teilnehmende', '2026-08-03', '2026-08-24', 'zugesagt', null, 'Aus Teilnehmerübersicht übernommen.'),
  ('Anton Bönisch', 'Teilnehmende', '2026-08-10', '2026-09-04', 'zugesagt', null, 'Aus Teilnehmerübersicht übernommen.'),
  ('Rudolf Jürgens', 'Teilnehmende', '2026-07-27', '2026-08-14', 'zu_klären', 'Finale Abklärung mit dem Arbeitgeber steht noch aus.', 'Aus Teilnehmerübersicht übernommen.'),
  ('Marie Doetkotte', 'Teilnehmende', '2026-07-27', '2026-08-14', 'zugesagt', null, 'Aus Teilnehmerübersicht übernommen.'),
  ('Moritz Frimberger', 'Teilnehmende', '2026-08-03', '2026-08-23', 'zugesagt', 'Auch spätere Termine möglich; nicht möglich am 12.09.', 'Aus Teilnehmerübersicht übernommen.'),
  ('Jakob Redepenning', 'Teilnehmende', '2026-07-27', '2026-08-16', 'zu_klären', 'Möglicherweise auch länger; Prüfungsleistungen anderer Kurse noch offen.', 'Aus Teilnehmerübersicht übernommen.'),
  ('Alexander Voßberg', 'Teilnehmende', '2026-09-09', '2026-09-30', 'zugesagt', 'Erste Ausgrabung.', 'Aus Teilnehmerübersicht übernommen.'),
  ('Claudia Heindl', 'Teilnehmende', '2026-08-29', '2026-09-19', 'zugesagt', 'Zusatzwoche noch flexibel planbar.', 'Aus Teilnehmerübersicht übernommen.'),
  ('Clara Hausberg', 'Teilnehmende', '2026-08-08', '2026-09-19', 'zugesagt', 'Erste Ausgrabung.', 'Aus Teilnehmerübersicht übernommen.'),
  ('Jakob Hetesy', 'Teilnehmende', '2026-08-03', '2026-10-09', 'zu_klären', 'Pause mittendrin wegen Sardinien-Exkursion; genaue Daten offen.', 'Aus Teilnehmerübersicht übernommen.'),
  ('Finn Fesq', 'Teilnehmende / Spezialbereich Tierknochen', null, null, 'zu_klären', 'Angaben im Original uneinheitlich: 17.08.-29.08. sowie 05.-09.10. genannt.', 'Aus Teilnehmerübersicht übernommen.'),
  ('Andreas Zauner', 'Technische Grabungsleitung', '2026-07-27', '2026-10-09', 'gesetzt', 'Durchgehend eingeplant.', 'Aus Teilnehmerübersicht übernommen.'),
  ('Niklas Mahler', 'Assistenz technische Grabungsleitung', '2026-07-27', '2026-10-09', 'gesetzt', 'Durchgehend eingeplant.', 'Aus Teilnehmerübersicht übernommen.'),
  ('Phil Föckersperger', 'Teilnehmende / angefragt', null, '2026-09-11', 'anzufragen', 'Telefon wird angefragt; Startdatum in der Übersicht unklar.', 'Aus Teilnehmerübersicht übernommen.')
on conflict do nothing;
