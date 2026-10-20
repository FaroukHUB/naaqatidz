-- À exécuter UNE FOIS dans Supabase → SQL Editor (projet naaqati), si les étapes précédentes ont été appliquées par l'assistant.
-- Termine le schéma : fonctions de commande, droits et règles RLS. Contenu identique aux migrations du dépôt.
begin;

create or replace function public.consume_rate_limit(
  p_bucket text, p_key_hash text, p_window_seconds integer, p_max integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits as r (bucket, key_hash, window_start, hits)
  values (p_bucket, p_key_hash, v_window, 1)
  on conflict (bucket, key_hash, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  -- Nettoyage opportuniste des fenêtres expirées.
  delete from public.rate_limits where window_start < now() - interval '2 days';
  return v_hits <= p_max;
end;
$$;

-- ---------------------------------------------------------------------------
-- Création atomique et idempotente d'une commande (appelée uniquement par le serveur)
-- ---------------------------------------------------------------------------
create or replace function public.create_order(p jsonb)
returns table (order_id uuid, reference text, created boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_existing public.orders%rowtype;
  v_id uuid;
  v_ref text;
  v_item jsonb;
  v_pos integer := 0;
  v_subtotal bigint := 0;
  v_attempt integer := 0;
begin
  -- Double soumission : même clé d'idempotence → même commande, aucune création.
  select * into v_existing from public.orders o where o.idempotency_key = (p->>'idempotency_key')::uuid;
  if found then
    if v_existing.request_hash <> p->>'request_hash' then
      raise exception 'idempotency_conflict' using errcode = 'P0001';
    end if;
    return query select v_existing.id, v_existing.reference, false;
    return;
  end if;

  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'order_without_items' using errcode = 'P0001';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_ref := 'NQ-' || to_char(now() at time zone 'Africa/Algiers', 'YYMMDD') || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.orders (
        reference, channel, user_id, payment_method, payment_status,
        customer_name, customer_phone, customer_email, company_name,
        ship_country, ship_wilaya_code, ship_wilaya_name, ship_commune_code, ship_commune_name,
        ship_city, ship_postal_code, ship_address, ship_notes,
        currency, subtotal_minor, shipping_minor, shipping_quote_status, total_minor,
        shipping_method_id, shipping_method_label, carrier,
        conditions, packing_status, packing_plan,
        idempotency_key, request_hash, confirmation_token_hash
      ) values (
        v_ref, (p->>'channel')::public.order_channel, nullif(p->>'user_id', '')::uuid,
        (p->>'payment_method')::public.payment_method,
        case when p->>'payment_method' = 'cod' then 'a_encaisser'::public.payment_status else 'non_encaisse'::public.payment_status end,
        p->>'customer_name', p->>'customer_phone', nullif(p->>'customer_email', ''), nullif(p->>'company_name', ''),
        p->>'ship_country', p->>'ship_wilaya_code', p->>'ship_wilaya_name', p->>'ship_commune_code', p->>'ship_commune_name',
        p->>'ship_city', p->>'ship_postal_code', p->>'ship_address', nullif(p->>'ship_notes', ''),
        p->>'currency', (p->>'subtotal_minor')::bigint, (p->>'shipping_minor')::bigint,
        (p->>'shipping_quote_status')::public.shipping_quote_status,
        (p->>'subtotal_minor')::bigint + coalesce((p->>'shipping_minor')::bigint, 0),
        nullif(p->>'shipping_method_id', '')::uuid, p->>'shipping_method_label', p->>'carrier',
        coalesce(p->'conditions', '{}'::jsonb),
        coalesce((p->>'packing_status')::public.packing_status, 'not_required'),
        case when jsonb_typeof(p->'packing_plan') = 'object' then p->'packing_plan' end,
        (p->>'idempotency_key')::uuid, p->>'request_hash', p->>'confirmation_token_hash'
      ) returning id into v_id;
      exit;
    exception when unique_violation then
      -- Collision de clé d'idempotence (requête concurrente) : renvoyer la commande existante.
      select * into v_existing from public.orders o where o.idempotency_key = (p->>'idempotency_key')::uuid;
      if found then
        if v_existing.request_hash <> p->>'request_hash' then
          raise exception 'idempotency_conflict' using errcode = 'P0001';
        end if;
        return query select v_existing.id, v_existing.reference, false;
        return;
      end if;
      if v_attempt >= 5 then raise; end if; -- collision de référence : nouvel essai
    end;
  end loop;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    v_pos := v_pos + 1;
    insert into public.order_items (
      order_id, position, sku, product_id, product_name, variant_label,
      unit_price_minor, currency, quantity, line_total_minor, unit_weight_g
    ) values (
      v_id, v_pos, v_item->>'sku', v_item->>'product_id', v_item->>'product_name', v_item->>'variant_label',
      (v_item->>'unit_price_minor')::bigint, p->>'currency', (v_item->>'quantity')::integer,
      (v_item->>'unit_price_minor')::bigint * (v_item->>'quantity')::integer,
      (v_item->>'unit_weight_g')::integer
    );
    v_subtotal := v_subtotal + (v_item->>'unit_price_minor')::bigint * (v_item->>'quantity')::integer;
  end loop;

  -- Contrôle de cohérence : le sous-total transmis doit correspondre aux lignes.
  if v_subtotal <> (p->>'subtotal_minor')::bigint then
    raise exception 'subtotal_mismatch' using errcode = 'P0001';
  end if;

  insert into public.order_events (order_id, kind, to_value) values (v_id, 'created', 'nouvelle');
  return query select v_id, v_ref, true;
end;
$$;

-- Lecture de la confirmation d'une commande particulière par jeton (sans compte).
create or replace function public.get_order_confirmation(p_reference text, p_token_hash text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'reference', o.reference,
    'created_at', o.created_at,
    'status', o.status,
    'currency', o.currency,
    'subtotal_minor', o.subtotal_minor,
    'shipping_minor', o.shipping_minor,
    'shipping_quote_status', o.shipping_quote_status,
    'total_minor', o.total_minor,
    'payment_method', o.payment_method,
    'shipping_method_label', o.shipping_method_label,
    'ship_wilaya_name', o.ship_wilaya_name,
    'ship_commune_name', o.ship_commune_name,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'sku', i.sku, 'product_name', i.product_name, 'variant_label', i.variant_label,
        'quantity', i.quantity, 'unit_price_minor', i.unit_price_minor, 'line_total_minor', i.line_total_minor
      ) order by i.position), '[]'::jsonb)
      from public.order_items i where i.order_id = o.id
    )
  )
  from public.orders o
  where o.reference = p_reference
    and o.confirmation_token_hash is not null
    and o.confirmation_token_hash = p_token_hash
    and o.created_at > now() - interval '30 days';
$$;


-- ---------------------------------------------------------------------------
-- Droits et RLS
-- ---------------------------------------------------------------------------

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

-- Nettoyage d'une entrée de test de l'historique des migrations.
delete from supabase_migrations.schema_migrations where name = 'types_test_probe';

commit;
