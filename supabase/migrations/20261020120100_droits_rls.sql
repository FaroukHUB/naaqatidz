-- Naaqati — droits et règles RLS (suite de 20261020120000_schema_initial.sql).

-- ---------------------------------------------------------------------------
-- Droits et RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.reseller_prices enable row level security;
alter table public.commerce_settings enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.shipping_wilaya_settings enable row level security;
alter table public.shipping_commune_overrides enable row level security;
alter table public.shipping_methods enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_shipments enable row level security;
alter table public.order_events enable row level security;
alter table public.rate_limits enable row level security;

-- Aucun accès anonyme direct à la base privée.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;
revoke all on function public.create_order(jsonb) from public, anon, authenticated;
revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.get_order_confirmation(text, text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.get_order_confirmation(text, text) to service_role;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_pricing_profile() to authenticated;

-- Profils : chacun lit le sien ; seule l'administration modifie (rôle, statut, pays, profil tarifaire).
grant select on public.profiles to authenticated;
grant update (status, company_name, contact_name, phone, declared_country, validated_country,
  pricing_profile, validated_at, validated_by, admin_notes) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_admin_update on public.profiles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Tarifs France : lisibles uniquement par un revendeur France actif et par l'administration.
grant select, insert, update, delete on public.reseller_prices to authenticated;
create policy reseller_prices_select on public.reseller_prices for select to authenticated
  using ((select public.is_admin()) or (market = 'FR' and (select public.current_pricing_profile()) = 'reseller_fr'));
create policy reseller_prices_admin_write on public.reseller_prices for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Paramètres commerciaux : administration uniquement (le serveur les lit avec la clé secrète).
grant select, update on public.commerce_settings to authenticated;
create policy commerce_settings_admin on public.commerce_settings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Livraison : administration uniquement.
grant select, insert, update, delete on public.shipping_zones, public.shipping_wilaya_settings,
  public.shipping_commune_overrides, public.shipping_methods, public.shipping_rates to authenticated;
create policy shipping_zones_admin on public.shipping_zones for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy shipping_wilayas_admin on public.shipping_wilaya_settings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy shipping_communes_admin on public.shipping_commune_overrides for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy shipping_methods_admin on public.shipping_methods for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy shipping_rates_admin on public.shipping_rates for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Commandes : un revendeur ne voit que les siennes ; l'administration voit tout.
-- Les colonnes techniques (idempotence, jetons) ne sont pas exposées aux revendeurs.
grant select (id, reference, channel, user_id, status, payment_method, payment_status,
  customer_name, customer_phone, customer_email, company_name, ship_country, ship_wilaya_code,
  ship_wilaya_name, ship_commune_code, ship_commune_name, ship_city, ship_postal_code, ship_address,
  ship_notes, currency, subtotal_minor, shipping_minor, shipping_quote_status, total_minor,
  shipping_method_id, shipping_method_label, carrier, conditions, packing_status, packing_plan,
  admin_notes, created_at, updated_at) on public.orders to authenticated;
grant update (status, payment_status, shipping_minor, shipping_quote_status, carrier,
  packing_status, packing_plan, admin_notes) on public.orders to authenticated;
create policy orders_select on public.orders for select to authenticated
  using ((select public.is_admin()) or user_id = (select auth.uid()));
create policy orders_admin_update on public.orders for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

grant select on public.order_items to authenticated;
create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
    and ((select public.is_admin()) or o.user_id = (select auth.uid()))));

grant select, insert, update, delete on public.order_shipments to authenticated;
create policy order_shipments_select on public.order_shipments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
    and ((select public.is_admin()) or o.user_id = (select auth.uid()))));
create policy order_shipments_admin_write on public.order_shipments for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

grant select, insert on public.order_events to authenticated;
create policy order_events_admin on public.order_events for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- rate_limits : aucun accès client (service_role uniquement).
