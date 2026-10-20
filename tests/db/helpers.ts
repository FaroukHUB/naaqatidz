import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { mapSettings, mapShipping, type CommerceStore, type SettingsRow, type ShippingRows } from "@/lib/server/commerce-store";

/**
 * Base de test : PostgreSQL réel, avec une émulation minimale de Supabase (tests/db/supabase-stub.sql)
 * puis TOUTES les migrations de supabase/migrations, dans l'ordre.
 */
export const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/postgres";

export async function createTestDatabase(name: string): Promise<pg.Pool> {
  // Mode « sur place » : base Supabase réelle et vierge (ex. image supabase/postgres) déjà dotée du schéma auth.
  if (process.env.TEST_DB_IN_PLACE === "1") {
    const pool = new pg.Pool({ connectionString: ADMIN_URL, max: 8 });
    await applyMigrations(pool);
    return pool;
  }
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${name} with (force)`);
  await admin.query(`create database ${name}`);
  await admin.end();
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 8 });
  await pool.query(readFileSync("tests/db/supabase-stub.sql", "utf8"));
  await applyMigrations(pool);
  return pool;
}

async function applyMigrations(pool: pg.Pool) {
  const dir = "supabase/migrations";
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await pool.query(readFileSync(join(dir, file), "utf8"));
  }
}

/** Exécute fn avec un rôle Supabase (anon / authenticated avec un utilisateur / service_role). */
export async function asRole<T>(
  pool: pg.Pool,
  role: "anon" | "authenticated" | "service_role",
  userId: string | null,
  fn: (c: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    // Les deux formes lues par auth.uid() selon les versions de Supabase.
    await client.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [
      JSON.stringify(userId ? { sub: userId, role } : { role }),
      userId ?? "",
    ]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export async function createUser(pool: pg.Pool, email: string, profile: Record<string, unknown> = {}): Promise<string> {
  const { rows } = await pool.query<{ id: string }>("insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id", [email]);
  const id = rows[0]!.id;
  const keys = Object.keys(profile);
  if (keys.length) {
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
    await pool.query(`update public.profiles set ${sets} where id = $1`, [id, ...keys.map((k) => profile[k])]);
  }
  return id;
}

/** Implémentation de CommerceStore sur pg, avec le rôle service_role comme le client Supabase serveur. */
export function pgStore(pool: pg.Pool): CommerceStore {
  const svc = <T>(fn: (c: pg.PoolClient) => Promise<T>) => asRole(pool, "service_role", null, fn);
  return {
    getSettings: () => svc(async (c) => mapSettings((await c.query<SettingsRow>("select * from public.commerce_settings where id = 1")).rows[0]!)),
    getShippingConfig: () =>
      svc(async (c) => {
        const rows: ShippingRows = {
          wilayas: (await c.query("select wilaya_code, enabled, zone_id from public.shipping_wilaya_settings")).rows,
          communes: (await c.query("select commune_code, enabled, zone_id from public.shipping_commune_overrides")).rows,
          methods: (await c.query("select id, label, description, carrier, audiences::text[] as audiences, active, sort_order from public.shipping_methods")).rows,
          rates: (await c.query("select method_id, zone_id, billing_mode, amount_minor, brackets, active from public.shipping_rates")).rows,
        };
        return mapShipping(rows);
      }),
    getFrancePrices: (skus) =>
      svc(async (c) => {
        const { rows } = await c.query("select sku, unit_price_minor, currency from public.reseller_prices where market = 'FR' and sku = any($1)", [skus]);
        return new Map(rows.map((r) => [r.sku, { unitPriceMinor: Number(r.unit_price_minor), currency: r.currency }]));
      }),
    createOrder: (payload) =>
      svc(async (c) => {
        const { rows } = await c.query("select * from public.create_order($1::jsonb)", [JSON.stringify(payload)]);
        return { orderId: rows[0].order_id, reference: rows[0].reference, created: rows[0].created };
      }),
    consumeRateLimit: (bucket, key, win, max) =>
      svc(async (c) => (await c.query("select public.consume_rate_limit($1, $2, $3, $4) as ok", [bucket, key, win, max])).rows[0].ok),
  };
}
