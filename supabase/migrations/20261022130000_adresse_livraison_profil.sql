-- Naaqati — adresse de livraison habituelle du revendeur : saisie par l'administration ou mise à jour
-- automatiquement après chaque commande, pour pré-remplir le panier.
alter table public.profiles
  add column if not exists ship_country text check (ship_country is null or ship_country ~ '^[A-Z]{2}$'),
  add column if not exists ship_wilaya_code text check (ship_wilaya_code is null or ship_wilaya_code ~ '^[0-9]{2}$'),
  add column if not exists ship_commune_code text check (ship_commune_code is null or ship_commune_code ~ '^[0-9]{4}$'),
  add column if not exists ship_city text check (ship_city is null or char_length(ship_city) <= 120),
  add column if not exists ship_postal_code text check (ship_postal_code is null or char_length(ship_postal_code) <= 20),
  add column if not exists ship_address text check (ship_address is null or char_length(ship_address) <= 500),
  add column if not exists ship_notes text check (ship_notes is null or char_length(ship_notes) <= 500);
grant select on public.profiles to authenticated;
-- Modifiables par l'administration uniquement (règle RLS profiles_admin_update) ; le serveur met à jour
-- l'adresse du revendeur après une commande avec la clé secrète.
grant update (ship_country, ship_wilaya_code, ship_commune_code, ship_city, ship_postal_code, ship_address, ship_notes)
  on public.profiles to authenticated;
