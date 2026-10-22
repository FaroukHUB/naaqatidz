-- Naaqati — schéma initial de la base privée (Supabase Postgres).
-- Contient : profils revendeurs/administrateurs, tarifs privés, paramètres commerciaux,
-- livraison, commandes. Le catalogue public (produits, prix publics DZD, poids) vit dans Sanity.
--
-- Principes :
--  * RLS activée sur toutes les tables ; aucun accès pour le rôle « anon ».
--  * Les commandes sont créées uniquement par le serveur (rôle service_role) via create_order(),
--    en une seule transaction, avec clé d'idempotence.
--  * Les montants sont des entiers en unités mineures (centimes).
--  * Les lignes de commande conservent un instantané (libellé, SKU, prix, devise, poids).

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'reseller');
create type public.account_status as enum ('pending', 'active', 'suspended');
create type public.pricing_profile as enum ('reseller_dz', 'reseller_fr');
create type public.order_channel as enum ('retail', 'reseller_dz', 'reseller_fr');
create type public.order_status as enum (
  'nouvelle', 'confirmee', 'en_preparation', 'expediee', 'livree', 'annulee', 'retournee'
);
create type public.payment_status as enum ('a_encaisser', 'encaisse', 'non_encaisse', 'rembourse');
create type public.payment_method as enum ('cod', 'a_definir');
create type public.shipping_quote_status as enum ('quoted', 'to_confirm', 'not_applicable');
create type public.billing_mode as enum ('per_order', 'per_carton', 'weight_brackets');
create type public.packing_status as enum ('not_required', 'calculated', 'adjusted');

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profils (1 ligne par utilisateur Supabase Auth)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role public.app_role not null default 'reseller',
  status public.account_status not null default 'pending',
  company_name text,
  contact_name text,
  phone text,
  -- Pays déclaré par le revendeur (information) ≠ pays validé par l'administratrice (fait foi).
  declared_country text,
  validated_country text check (validated_country in ('DZ', 'FR')),
  pricing_profile public.pricing_profile,
  validated_at timestamptz,
  validated_by uuid references auth.users (id) on delete set null,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un revendeur actif a obligatoirement un pays validé cohérent avec son profil tarifaire.
  constraint active_reseller_is_validated check (
    role = 'admin' or status <> 'active' or (
      (validated_country = 'DZ' and pricing_profile = 'reseller_dz')
      or (validated_country = 'FR' and pricing_profile = 'reseller_fr')
    )
  )
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Création automatique d'un profil « en attente » à la création d'un compte.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  );
$$;

create or replace function public.current_pricing_profile() returns public.pricing_profile
language sql stable security definer set search_path = '' as $$
  select p.pricing_profile from public.profiles p
  where p.id = auth.uid() and p.role = 'reseller' and p.status = 'active';
$$;

-- ---------------------------------------------------------------------------
-- Tarifs revendeurs (confidentiels). Clé : SKU, identifiant stable partagé avec Sanity.
-- ---------------------------------------------------------------------------
create table public.reseller_prices (
  market text not null default 'FR' check (market in ('FR')),
  sku text not null check (sku ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  unit_price_minor bigint not null check (unit_price_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (market, sku)
);
create trigger reseller_prices_updated_at before update on public.reseller_prices
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Paramètres commerciaux (ligne unique)
-- ---------------------------------------------------------------------------
create table public.commerce_settings (
  id smallint primary key default 1 check (id = 1),
  -- Règle cliente : 5 pièces maximum par référence pour une commande particulière.
  retail_max_units_per_sku integer not null default 5 check (retail_max_units_per_sku > 0),
  -- Règles clientes de colisage revendeurs Algérie.
  carton_max_units_per_sku integer not null default 10 check (carton_max_units_per_sku > 0),
  carton_max_weight_g integer not null default 10000 check (carton_max_weight_g > 0),
  -- À renseigner : aucune valeur par défaut inventée.
  carton_tare_g integer check (carton_tare_g >= 0),
  carton_safety_margin_g integer check (carton_safety_margin_g >= 0),
  allow_orders_without_shipping_rate boolean not null default false,
  -- Conditions revendeurs France : toutes à confirmer.
  fr_orders_enabled boolean not null default false,
  fr_currency char(3) check (fr_currency ~ '^[A-Z]{3}$'),
  fr_payment_terms text,
  fr_shipping_terms text,
  fr_shipping_fee_mode text check (fr_shipping_fee_mode in ('on_quote', 'fixed')),
  fr_shipping_fee_minor bigint check (fr_shipping_fee_minor >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint fr_orders_require_terms check (
    not fr_orders_enabled or (
      fr_currency is not null
      and coalesce(btrim(fr_payment_terms), '') <> ''
      and coalesce(btrim(fr_shipping_terms), '') <> ''
      and fr_shipping_fee_mode is not null
      and (fr_shipping_fee_mode <> 'fixed' or fr_shipping_fee_minor is not null)
    )
  )
);
insert into public.commerce_settings (id) values (1);
create trigger commerce_settings_updated_at before update on public.commerce_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Livraison Algérie
-- ---------------------------------------------------------------------------
create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  notes text,
  created_at timestamptz not null default now()
);

-- Une wilaya absente de cette table est considérée comme non desservie.
create table public.shipping_wilaya_settings (
  wilaya_code text primary key check (wilaya_code ~ '^[0-9]{2}$'),
  enabled boolean not null default false,
  zone_id uuid references public.shipping_zones (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Exceptions par commune (valeurs nulles = héritées de la wilaya).
create table public.shipping_commune_overrides (
  commune_code text primary key check (commune_code ~ '^[0-9]{4}$'),
  enabled boolean,
  zone_id uuid references public.shipping_zones (id) on delete set null,
  note text,
  updated_at timestamptz not null default now()
);

create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  description text,
  carrier text,
  audiences public.order_channel[] not null default '{}'
    check (not ('reseller_fr' = any (audiences))),
  active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  method_id uuid not null references public.shipping_methods (id) on delete cascade,
  zone_id uuid not null references public.shipping_zones (id) on delete cascade,
  billing_mode public.billing_mode not null,
  amount_minor bigint check (amount_minor >= 0),
  brackets jsonb,
  currency char(3) not null default 'DZD' check (currency = 'DZD'),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (method_id, zone_id),
  constraint rate_matches_mode check (
    (billing_mode in ('per_order', 'per_carton') and amount_minor is not null)
    or (billing_mode = 'weight_brackets' and jsonb_typeof(brackets) = 'array' and jsonb_array_length(brackets) > 0)
  )
);

-- ---------------------------------------------------------------------------
-- Commandes
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  channel public.order_channel not null,
  user_id uuid references auth.users (id) on delete set null,
  status public.order_status not null default 'nouvelle',
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'a_encaisser',
  -- Client / livraison (instantané au moment de la commande)
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  company_name text,
  ship_country char(2) not null,
  ship_wilaya_code text,
  ship_wilaya_name text,
  ship_commune_code text,
  ship_commune_name text,
  ship_city text,
  ship_postal_code text,
  ship_address text not null,
  ship_notes text,
  -- Montants
  currency char(3) not null,
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  shipping_minor bigint check (shipping_minor >= 0),
  shipping_quote_status public.shipping_quote_status not null,
  total_minor bigint not null check (total_minor >= 0),
  shipping_method_id uuid,
  shipping_method_label text,
  carrier text,
  -- Conditions appliquées et colisage (instantanés)
  conditions jsonb not null default '{}'::jsonb,
  packing_status public.packing_status not null default 'not_required',
  packing_plan jsonb,
  -- Sécurité
  idempotency_key uuid not null unique,
  request_hash text not null,
  confirmation_token_hash text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reseller_order_has_user check (channel = 'retail' or user_id is not null),
  constraint total_consistent check (total_minor = subtotal_minor + coalesce(shipping_minor, 0))
);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_user_idx on public.orders (user_id);
create index orders_phone_idx on public.orders (customer_phone);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  position integer not null,
  sku text not null,
  product_id text not null,
  product_name text not null,
  variant_label text,
  unit_price_minor bigint not null check (unit_price_minor > 0),
  currency char(3) not null,
  quantity integer not null check (quantity > 0),
  line_total_minor bigint not null,
  unit_weight_g integer,
  unique (order_id, position),
  constraint line_total_consistent check (line_total_minor = unit_price_minor * quantity)
);
create index order_items_order_idx on public.order_items (order_id);

-- Expéditions / colis et références de suivi (saisie manuelle ou future API transporteur).
create table public.order_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  carton_index integer,
  carrier text,
  tracking_number text,
  -- Identifiant côté transporteur : unique pour empêcher une double création d'expédition.
  external_id text unique,
  status text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_shipments_order_idx on public.order_shipments (order_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null,
  from_value text,
  to_value text,
  note text,
  actor uuid,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id);

-- Les instantanés d'une commande ne sont jamais réécrits ; seuls les champs de suivi évoluent.
create or replace function public.orders_guard_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.reference, new.channel, new.user_id, new.customer_name, new.customer_phone, new.customer_email,
      new.ship_country, new.ship_wilaya_code, new.ship_commune_code, new.ship_address, new.currency,
      new.subtotal_minor, new.conditions, new.idempotency_key, new.request_hash, new.created_at)
     is distinct from
     (old.reference, old.channel, old.user_id, old.customer_name, old.customer_phone, old.customer_email,
      old.ship_country, old.ship_wilaya_code, old.ship_commune_code, old.ship_address, old.currency,
      old.subtotal_minor, old.conditions, old.idempotency_key, old.request_hash, old.created_at) then
    raise exception 'Les informations enregistrées à la commande ne sont pas modifiables.' using errcode = 'P0001';
  end if;
  -- Le total suit toujours sous-total + livraison.
  new.total_minor := new.subtotal_minor + coalesce(new.shipping_minor, 0);
  new.updated_at := now();
  if new.status is distinct from old.status then
    insert into public.order_events (order_id, kind, from_value, to_value, actor)
    values (new.id, 'status', old.status::text, new.status::text, auth.uid());
  end if;
  if new.payment_status is distinct from old.payment_status then
    insert into public.order_events (order_id, kind, from_value, to_value, actor)
    values (new.id, 'payment_status', old.payment_status::text, new.payment_status::text, auth.uid());
  end if;
  if new.shipping_minor is distinct from old.shipping_minor then
    insert into public.order_events (order_id, kind, from_value, to_value, actor)
    values (new.id, 'shipping', old.shipping_minor::text, new.shipping_minor::text, auth.uid());
  end if;
  if new.packing_plan is distinct from old.packing_plan then
    insert into public.order_events (order_id, kind, actor) values (new.id, 'packing', auth.uid());
  end if;
  return new;
end;
$$;
create trigger orders_guard before update on public.orders
  for each row execute function public.orders_guard_update();

-- ---------------------------------------------------------------------------
-- Limitation des soumissions publiques (clé = empreinte, jamais l'IP en clair)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  bucket text not null,
  key_hash text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, key_hash, window_start)
);

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

