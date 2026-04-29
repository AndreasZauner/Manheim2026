-- Beispiel-Layer und erste Kartenobjekte fuer das Kartenmodul.
-- Nach supabase/map_module.sql ausfuehren.

insert into public.map_layers
  (name, slug, description, color, symbol, sort_order)
values
  ('Organisation', 'organisation', 'Leitungs- und Treffpunkte fuer Tagesbetrieb und Briefings.', '#2d7dd2', 'circle', 10),
  ('Sicherheit', 'sicherheit', 'Notfallpunkte, Sammelplaetze und sicherheitsrelevante Hinweise.', '#d83b2d', 'warning', 20),
  ('Infrastruktur', 'infrastruktur', 'Grabungsbuero, Unterkunft, Lager, Wasser, Strom und Arbeitsbereiche.', '#6f46c7', 'square', 30),
  ('Grabungsflaechen', 'grabungsflaechen', 'Arbeitsflaechen, Prioritaetsbereiche und Schnittplanung.', '#24995a', 'polygon', 40),
  ('Treffpunkte', 'treffpunkte', 'Morgenbriefing, Pendelverkehr und Sammelpunkte.', '#0a95ae', 'marker', 50),
  ('Dokumentation', 'dokumentation', 'Doku-Stationen, Foto-/Planbezug und Kontrollpunkte.', '#c88900', 'document', 60),
  ('Logistik', 'logistik', 'Materialwege, Transport, Ausgabe und Lagerung.', '#c44b6e', 'route', 70)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    color = excluded.color,
    symbol = excluded.symbol,
    sort_order = excluded.sort_order;

with layer_lookup as (
  select slug, id from public.map_layers
)
insert into public.map_features
  (primary_layer_id, title, description, geometry, geometry_type, category, status, priority, responsible_role, label, properties)
values
  ((select id from layer_lookup where slug = 'organisation'), 'Grabungsbuero Kerpen', 'Zentraler Buero- und Koordinationspunkt fuer Tagesplanung, Druck/Scan und Ausgabe.', '{"type":"Point","coordinates":[6.6960,50.8690]}'::jsonb, 'Point', 'Buero', 'aktiv', 'hoch', 'technical_lead', 'Grabungsbuero', '{"seed":true}'::jsonb),
  ((select id from layer_lookup where slug = 'treffpunkte'), 'Treffpunkt Pendelverkehr', 'Sammelpunkt fuer Fahrten zwischen Kerpen-Buir, Buero und Grabungsflaeche.', '{"type":"Point","coordinates":[6.6505,50.8615]}'::jsonb, 'Point', 'Treffpunkt', 'geplant', 'mittel', 'assistant', 'Pendel-Treffpunkt', '{"seed":true}'::jsonb),
  ((select id from layer_lookup where slug = 'sicherheit'), 'Sammelplatz Notfall', 'Vorgeschlagener Sammelpunkt fuer Unterweisung, Hitze-/Wetterunterbrechung und Notfallkommunikation.', '{"type":"Point","coordinates":[6.6220,50.8805]}'::jsonb, 'Point', 'Sicherheit', 'geplant', 'hoch', 'technical_lead', 'Sammelplatz', '{"seed":true}'::jsonb),
  ((select id from layer_lookup where slug = 'grabungsflaechen'), 'Prioritaetsflaeche Antoniterhof', 'Arbeitsbereich Prioritaet 1; genaue Grenzen nach amtlicher Abstimmung praezisieren.', '{"type":"Polygon","coordinates":[[[6.6201,50.8816],[6.6231,50.8814],[6.6233,50.8796],[6.6200,50.8797],[6.6201,50.8816]]]}'::jsonb, 'Polygon', 'Grabungsflaeche', 'geplant', 'hoch', 'technical_lead', 'Antoniterhof', '{"seed":true}'::jsonb),
  ((select id from layer_lookup where slug = 'logistik'), 'Materialroute Buero-Flaeche', 'Arbeitsroute fuer Materialtransport; als Platzhalter vor Ort pruefen.', '{"type":"LineString","coordinates":[[6.6960,50.8690],[6.6505,50.8615],[6.6220,50.8805]]}'::jsonb, 'LineString', 'Transport', 'geplant', 'mittel', 'technical_lead', 'Materialroute', '{"seed":true}'::jsonb)
on conflict do nothing;
