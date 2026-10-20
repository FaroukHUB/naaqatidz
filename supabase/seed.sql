-- DONNÉES DE DÉMONSTRATION — développement local uniquement (exécuté par `supabase db reset`).
-- Valeurs FICTIVES : elles ne représentent aucune condition réelle de Naaqati ni d'un transporteur.
-- Ne jamais exécuter ce fichier sur la base de production.

update public.commerce_settings set carton_tare_g = 300, carton_safety_margin_g = 200 where id = 1;

insert into public.shipping_zones (id, name, notes)
values ('00000000-0000-4000-8000-00000000d001', 'Zone démo', 'Fictive — développement local');

insert into public.shipping_methods (id, label, description, carrier, audiences, active, sort_order) values
  ('00000000-0000-4000-8000-00000000d101', 'Domicile (démo)', 'Mode fictif de démonstration', null, '{retail,reseller_dz}', true, 1),
  ('00000000-0000-4000-8000-00000000d102', 'Point relais (démo)', 'Mode fictif de démonstration', null, '{retail}', true, 2);

insert into public.shipping_rates (method_id, zone_id, billing_mode, amount_minor) values
  ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000d001', 'per_order', 50000),
  ('00000000-0000-4000-8000-00000000d102', '00000000-0000-4000-8000-00000000d001', 'per_order', 30000);

insert into public.shipping_wilaya_settings (wilaya_code, enabled, zone_id) values
  ('16', true, '00000000-0000-4000-8000-00000000d001'),
  ('31', true, '00000000-0000-4000-8000-00000000d001');
