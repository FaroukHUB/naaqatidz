import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { confirmationToken, placeOrder, sha256, type OrderDeps, type Viewer } from "@/lib/server/orders";
import type { CatalogSku } from "@/lib/domain/types";
import { asRole, createTestDatabase, createUser, pgStore } from "./helpers";

// Données de test uniquement (fictives).
let pool: pg.Pool;
let deps: OrderDeps;
let catalog: Map<string, CatalogSku>;
let zoneId: string;
let methodId: string;
let resellerDz: string;
let resellerDz2: string;
let resellerFr: string;
let pendingFr: string;
let adminId: string;

const geo = {
  resolveAddress: (w: string, c: string) =>
    w === "16" && c.startsWith("16") ? { wilaya: { code: "16", nameFr: "Alger" }, commune: { code: c, nameFr: "Commune test" } } : null,
};

function sku(code: string, over: Partial<CatalogSku> = {}): CatalogSku {
  return { sku: code, productId: `p-${code}`, productSlug: code.toLowerCase(), productName: `Produit ${code}`, variantLabel: null, priceDzdMinor: 100_000, shippingWeightG: 250, saleable: true, ...over };
}

function retailBody(over: Record<string, unknown> = {}) {
  return {
    idempotencyKey: randomUUID(),
    lines: [{ sku: "A", quantity: 2 }],
    firstName: "Test",
    lastName: "Client",
    phone: "0550 12 34 56",
    email: "",
    address: { wilayaCode: "16", communeCode: "1601", address: "Adresse de test" },
    shippingMethodId: null,
    website: "",
    ...over,
  };
}

const viewer = (userId: string, pricingProfile: Viewer["pricingProfile"], status: Viewer["status"] = "active"): Viewer => ({ userId, role: "reseller", status, pricingProfile });

beforeAll(async () => {
  pool = await createTestDatabase("naaqati_test_orders");
  catalog = new Map([["A", sku("A")], ["B", sku("B", { priceDzdMinor: 250_000, shippingWeightG: 900 })]]);
  deps = {
    catalog: { kind: "test", getSkusFresh: async (skus) => new Map([...catalog].filter(([k]) => skus.includes(k))) },
    store: pgStore(pool),
    geo,
    tokenSecret: "x".repeat(40),
  };
  // Configuration de test (fictive) : une zone, un mode, un tarif par commande et par carton.
  zoneId = (await pool.query("insert into shipping_zones (name) values ('Zone test') returning id")).rows[0].id;
  methodId = (await pool.query("insert into shipping_methods (label, audiences, active) values ('Domicile test', '{retail,reseller_dz}', true) returning id")).rows[0].id;
  await pool.query("insert into shipping_wilaya_settings (wilaya_code, enabled, zone_id) values ('16', true, $1)", [zoneId]);
  await pool.query("insert into shipping_rates (method_id, zone_id, billing_mode, amount_minor) values ($1, $2, 'per_order', 40000)", [methodId, zoneId]);
  await pool.query("update commerce_settings set carton_tare_g = 300, carton_safety_margin_g = 200");

  adminId = await createUser(pool, "admin@test.local", { role: "admin", status: "active" });
  resellerDz = await createUser(pool, "dz@test.local", { status: "active", validated_country: "DZ", pricing_profile: "reseller_dz" });
  resellerDz2 = await createUser(pool, "dz2@test.local", { status: "active", validated_country: "DZ", pricing_profile: "reseller_dz" });
  resellerFr = await createUser(pool, "fr@test.local", { status: "active", validated_country: "FR", pricing_profile: "reseller_fr" });
  pendingFr = await createUser(pool, "pending@test.local", { declared_country: "FR" });
  await pool.query("insert into reseller_prices (sku, unit_price_minor, currency) values ('A', 450, 'EUR')");
});

afterAll(async () => {
  await pool?.end();
});

describe("commande particulière sans compte", () => {
  it("enregistre la commande, ses lignes et un total recalculé côté serveur", async () => {
    const r = await placeOrder("retail", null, retailBody({ lines: [{ sku: "A", quantity: 2 }, { sku: "B", quantity: 1 }] }), deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.created).toBe(true);
    expect(r.reference).toMatch(/^NQ-\d{6}-[0-9A-F]{8}$/);
    const o = (await pool.query("select * from orders where reference = $1", [r.reference])).rows[0];
    expect(o.channel).toBe("retail");
    expect(o.user_id).toBeNull();
    expect(o.customer_phone).toBe("0550123456");
    expect(o.currency).toBe("DZD");
    expect(Number(o.subtotal_minor)).toBe(450_000);
    expect(Number(o.shipping_minor)).toBe(40_000);
    expect(Number(o.total_minor)).toBe(490_000);
    expect(o.payment_method).toBe("cod");
    expect(o.payment_status).toBe("a_encaisser");
    expect(o.status).toBe("nouvelle");
    const items = (await pool.query("select * from order_items where order_id = $1 order by position", [o.id])).rows;
    expect(items.map((i) => [i.sku, i.quantity, Number(i.unit_price_minor)])).toEqual([["A", 2, 100_000], ["B", 1, 250_000]]);
  });

  it("ignore tout prix envoyé par le client et refuse les champs inconnus (profil tarifaire, canal, prix)", async () => {
    for (const extra of [{ channel: "reseller_fr" }, { pricingProfile: "reseller_fr" }, { total: 1 }]) {
      const r = await placeOrder("retail", null, retailBody(extra), deps);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(400);
    }
    const priced = await placeOrder("retail", null, retailBody({ lines: [{ sku: "A", quantity: 1, unitPrice: 1 }] }), deps);
    expect(priced.ok).toBe(false);
  });

  it("bloque au-delà de 5 unités du même SKU, y compris réparties sur plusieurs lignes", async () => {
    const r = await placeOrder("retail", null, retailBody({ lines: [{ sku: "A", quantity: 3 }, { sku: "A", quantity: 3 }] }), deps);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(422);
      expect(r.issues?.map((i) => i.code)).toContain("retail_limit_exceeded");
    }
  });

  it("refuse une commune qui n'appartient pas à la wilaya", async () => {
    const r = await placeOrder("retail", null, retailBody({ address: { wilayaCode: "16", communeCode: "3101", address: "x" } }), deps);
    expect(r.ok).toBe(false);
  });

  it("rejette la soumission si le champ piège est rempli", async () => {
    const r = await placeOrder("retail", null, retailBody({ website: "http://spam" }), deps);
    expect(r.ok).toBe(false);
  });

  it("double clic (soumissions simultanées) : une seule commande", async () => {
    const body = retailBody();
    const results = await Promise.all(Array.from({ length: 5 }, () => placeOrder("retail", null, body, deps)));
    const refs = new Set(results.map((r) => (r.ok ? r.reference : "ERR")));
    expect(refs.size).toBe(1);
    expect(refs.has("ERR")).toBe(false);
    expect(results.filter((r) => r.ok && r.created)).toHaveLength(1);
    const count = (await pool.query("select count(*)::int as n from orders where idempotency_key = $1", [body.idempotencyKey])).rows[0].n;
    expect(count).toBe(1);
    // Même jeton de confirmation pour toutes les réponses.
    expect(new Set(results.map((r) => (r.ok ? r.confirmationToken : null))).size).toBe(1);
  });

  it("même clé d'idempotence avec un contenu différent : refus", async () => {
    const body = retailBody();
    expect((await placeOrder("retail", null, body, deps)).ok).toBe(true);
    const r = await placeOrder("retail", null, { ...body, lines: [{ sku: "B", quantity: 1 }] }, deps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(409);
  });

  it("confirmation accessible uniquement avec le jeton, pas avec la seule référence", async () => {
    const body = retailBody();
    const r = await placeOrder("retail", null, body, deps);
    if (!r.ok) throw new Error("commande attendue");
    const read = (hash: string) =>
      asRole(pool, "service_role", null, async (c) => (await c.query("select public.get_order_confirmation($1, $2) as d", [r.reference, hash])).rows[0].d);
    const good = await read(sha256(confirmationToken(deps.tokenSecret, body.idempotencyKey)));
    expect(good.reference).toBe(r.reference);
    expect(JSON.stringify(good)).not.toContain("0550123456"); // pas de téléphone dans la confirmation
    expect(await read(sha256("mauvais-jeton"))).toBeNull();
    // Les rôles anon / authenticated ne peuvent pas appeler la fonction.
    await expect(asRole(pool, "anon", null, (c) => c.query("select public.get_order_confirmation('x', 'y')"))).rejects.toThrow(/permission denied/);
  });

  it("historique inchangé après modification du catalogue", async () => {
    const r = await placeOrder("retail", null, retailBody({ lines: [{ sku: "A", quantity: 1 }] }), deps);
    if (!r.ok) throw new Error("commande attendue");
    catalog.set("A", sku("A", { productName: "Nouveau nom", priceDzdMinor: 999_900, shippingWeightG: 5000 }));
    const item = (await pool.query("select i.* from order_items i join orders o on o.id = i.order_id where o.reference = $1", [r.reference])).rows[0];
    expect(item.product_name).toBe("Produit A");
    expect(Number(item.unit_price_minor)).toBe(100_000);
    expect(item.unit_weight_g).toBe(250);
    catalog.set("A", sku("A"));
  });
});

describe("création de commande réservée au serveur", () => {
  it("anon et authenticated ne peuvent ni appeler create_order ni insérer directement", async () => {
    await expect(asRole(pool, "anon", null, (c) => c.query("select * from public.create_order('{}'::jsonb)"))).rejects.toThrow(/permission denied/);
    await expect(asRole(pool, "authenticated", resellerDz, (c) => c.query("select * from public.create_order('{}'::jsonb)"))).rejects.toThrow(/permission denied/);
    await expect(
      asRole(pool, "authenticated", resellerDz, (c) => c.query("insert into orders (reference) values ('x')")),
    ).rejects.toThrow(/permission denied/);
  });

  it("transaction atomique : une ligne invalide annule toute la commande", async () => {
    const key = randomUUID();
    const before = (await pool.query("select count(*)::int as n from orders")).rows[0].n;
    const payload = {
      channel: "retail", user_id: null, payment_method: "cod", customer_name: "X", customer_phone: "0550000000", ship_country: "DZ",
      ship_address: "x", currency: "DZD", subtotal_minor: 100, shipping_minor: null, shipping_quote_status: "to_confirm",
      idempotency_key: key, request_hash: "h", items: [{ sku: "A", product_id: "p", product_name: "A", unit_price_minor: 100, quantity: 1 }, { sku: "B", product_id: "p", product_name: "B", unit_price_minor: -5, quantity: 1 }],
    };
    await expect(asRole(pool, "service_role", null, (c) => c.query("select * from public.create_order($1::jsonb)", [JSON.stringify(payload)]))).rejects.toThrow();
    expect((await pool.query("select count(*)::int as n from orders")).rows[0].n).toBe(before);
  });
});

describe("revendeurs", () => {
  it("revendeur Algérie : prix publics, au-delà de 5 unités, colisage enregistré", async () => {
    const body = { idempotencyKey: randomUUID(), lines: [{ sku: "A", quantity: 12 }, { sku: "A", quantity: 9 }], contactName: "Boutique test", phone: "0661000000", address: { wilayaCode: "16", communeCode: "1601", address: "Adresse" }, shippingMethodId: null };
    const r = await placeOrder("reseller_dz", viewer(resellerDz, "reseller_dz"), body, deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const o = (await pool.query("select * from orders where reference = $1", [r.reference])).rows[0];
    expect(o.user_id).toBe(resellerDz);
    expect(Number(o.subtotal_minor)).toBe(21 * 100_000);
    expect(o.packing_status).toBe("calculated");
    expect(o.packing_plan.cartons).toHaveLength(3);
  });

  it("un client connecté ne peut pas choisir un autre profil tarifaire que le sien", async () => {
    const frBody = { idempotencyKey: randomUUID(), lines: [{ sku: "A", quantity: 1 }], contactName: "X", phone: "+33 6 00 00 00 00", address: { country: "FR", city: "Paris", postalCode: "75000", address: "x" } };
    for (const v of [null, viewer(resellerDz, "reseller_dz"), viewer(pendingFr, null, "pending"), viewer(resellerFr, "reseller_fr", "suspended")]) {
      const r = await placeOrder("reseller_fr", v, frBody, deps);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(403);
    }
  });

  it("revendeur France : commande refusée tant que les conditions ne sont pas validées", async () => {
    const body = { idempotencyKey: randomUUID(), lines: [{ sku: "A", quantity: 3 }], contactName: "X", phone: "+33 6 00 00 00 00", address: { country: "FR", city: "Paris", postalCode: "75000", address: "x" } };
    const r = await placeOrder("reseller_fr", viewer(resellerFr, "reseller_fr"), body, deps);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(422);
      expect(r.issues?.map((i) => i.code)).toContain("fr_orders_disabled");
    }
    // La base refuse d'ouvrir les commandes France sans conditions complètes.
    await expect(pool.query("update commerce_settings set fr_orders_enabled = true")).rejects.toThrow(/fr_orders_require_terms/);
  });

  it("revendeur France : prix France, jamais de repli sur le prix algérien", async () => {
    await pool.query("update commerce_settings set fr_currency = 'EUR', fr_payment_terms = 'À confirmer (test)', fr_shipping_terms = 'Test', fr_shipping_fee_mode = 'on_quote', fr_orders_enabled = true");
    const base = { contactName: "X", phone: "+33 6 00 00 00 00", address: { country: "FR", city: "Paris", postalCode: "75000", address: "x" } };
    const ok = await placeOrder("reseller_fr", viewer(resellerFr, "reseller_fr"), { ...base, idempotencyKey: randomUUID(), lines: [{ sku: "A", quantity: 3 }] }, deps);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      const o = (await pool.query("select * from orders where reference = $1", [ok.reference])).rows[0];
      expect(o.currency).toBe("EUR");
      expect(Number(o.subtotal_minor)).toBe(1350);
      expect(o.shipping_quote_status).toBe("to_confirm");
      expect(o.payment_method).toBe("a_definir");
    }
    const missing = await placeOrder("reseller_fr", viewer(resellerFr, "reseller_fr"), { ...base, idempotencyKey: randomUUID(), lines: [{ sku: "B", quantity: 1 }] }, deps);
    expect(missing.ok).toBe(false);
    await pool.query("update commerce_settings set fr_orders_enabled = false");
  });
});

describe("RLS et confidentialité", () => {
  it("tarifs France : invisibles pour anon, revendeur Algérie, compte en attente ; visibles pour revendeur France et admin", async () => {
    const count = (role: "anon" | "authenticated", uid: string | null) =>
      asRole(pool, role, uid, async (c) => (await c.query("select count(*)::int as n from reseller_prices")).rows[0].n);
    await expect(count("anon", null)).rejects.toThrow(/permission denied/);
    expect(await count("authenticated", resellerDz)).toBe(0);
    expect(await count("authenticated", pendingFr)).toBe(0);
    expect(await count("authenticated", resellerFr)).toBe(1);
    expect(await count("authenticated", adminId)).toBe(1);
  });

  it("un revendeur ne voit que ses propres commandes", async () => {
    const own = (uid: string) => asRole(pool, "authenticated", uid, async (c) => (await c.query("select user_id from orders")).rows);
    const rowsDz = await own(resellerDz);
    expect(rowsDz.length).toBeGreaterThan(0);
    expect(rowsDz.every((r) => r.user_id === resellerDz)).toBe(true);
    expect(await own(resellerDz2)).toHaveLength(0);
    const items = await asRole(pool, "authenticated", resellerDz2, async (c) => (await c.query("select * from order_items")).rows);
    expect(items).toHaveLength(0);
    const all = await asRole(pool, "authenticated", adminId, async (c) => (await c.query("select count(*)::int as n from orders")).rows[0].n);
    expect(all).toBeGreaterThan(rowsDz.length);
  });

  it("les colonnes techniques des commandes ne sont pas lisibles par un revendeur", async () => {
    await expect(asRole(pool, "authenticated", resellerDz, (c) => c.query("select idempotency_key from orders"))).rejects.toThrow(/permission denied/);
    await expect(asRole(pool, "authenticated", resellerDz, (c) => c.query("select confirmation_token_hash from orders"))).rejects.toThrow(/permission denied/);
  });

  it("un revendeur ne peut pas modifier son propre profil tarifaire ni son statut", async () => {
    const res = await asRole(pool, "authenticated", pendingFr, (c) =>
      c.query("update profiles set status = 'active', validated_country = 'FR', pricing_profile = 'reseller_fr' where id = $1", [pendingFr]),
    );
    expect(res.rowCount).toBe(0);
    const p = (await pool.query("select status, pricing_profile from profiles where id = $1", [pendingFr])).rows[0];
    expect(p).toEqual({ status: "pending", pricing_profile: null });
    await expect(asRole(pool, "authenticated", pendingFr, (c) => c.query("update profiles set role = 'admin' where id = $1", [pendingFr]))).rejects.toThrow(/permission denied/);
  });

  it("un revendeur ne peut pas modifier une commande", async () => {
    const res = await asRole(pool, "authenticated", resellerDz, (c) => c.query("update orders set status = 'livree' where user_id = $1", [resellerDz]));
    expect(res.rowCount).toBe(0);
  });

  it("aucun accès anonyme aux paramètres, à la livraison ni aux profils", async () => {
    for (const t of ["commerce_settings", "shipping_rates", "shipping_methods", "profiles", "orders", "rate_limits"]) {
      await expect(asRole(pool, "anon", null, (c) => c.query(`select * from ${t}`))).rejects.toThrow(/permission denied/);
    }
  });

  it("un compte actif doit avoir un pays validé cohérent avec son profil tarifaire", async () => {
    await expect(pool.query("update profiles set status = 'active', validated_country = 'DZ', pricing_profile = 'reseller_fr' where id = $1", [pendingFr])).rejects.toThrow(/active_reseller_is_validated/);
  });
});

describe("administration des commandes", () => {
  it("changement de statut journalisé ; instantanés non modifiables ; total recalculé", async () => {
    const r = await placeOrder("retail", null, retailBody(), deps);
    if (!r.ok) throw new Error("commande attendue");
    await asRole(pool, "authenticated", adminId, (c) => c.query("update orders set status = 'confirmee', shipping_minor = 30000 where reference = $1", [r.reference]));
    const o = (await pool.query("select * from orders where reference = $1", [r.reference])).rows[0];
    expect(o.status).toBe("confirmee");
    expect(Number(o.total_minor)).toBe(Number(o.subtotal_minor) + 30000);
    const events = (await pool.query("select kind, from_value, to_value, actor from order_events where order_id = $1 order by id", [o.id])).rows;
    expect(events.find((e) => e.kind === "status")).toMatchObject({ from_value: "nouvelle", to_value: "confirmee", actor: adminId });
    await expect(asRole(pool, "authenticated", adminId, (c) => c.query("update orders set subtotal_minor = 1 where reference = $1", [r.reference]))).rejects.toThrow(/permission denied/);
    await expect(pool.query("update orders set subtotal_minor = 1 where reference = $1", [r.reference])).rejects.toThrow(/pas modifiables/);
    await expect(asRole(pool, "authenticated", adminId, (c) => c.query("update order_items set unit_price_minor = 1"))).rejects.toThrow(/permission denied/);
  });
});

describe("limitation des soumissions", () => {
  it("bloque au-delà du seuil dans la fenêtre", async () => {
    const store = pgStore(pool);
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await store.consumeRateLimit("test", "cle", 3600, 3));
    expect(results).toEqual([true, true, true, false]);
  });
});
