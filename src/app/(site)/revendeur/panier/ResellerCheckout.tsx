"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useCart } from "@/components/cart/cart-store";
import { AddressFields, type WilayaOption } from "@/components/checkout/AddressFields";
import { IssuesList, PackingPlanView, QuoteSummary } from "@/components/checkout/QuoteSummary";
import { ShippingOptions } from "@/components/checkout/ShippingOptions";
import { useQuote } from "@/components/checkout/useQuote";
import { Notice } from "@/components/ui/Notice";
import { formatMoney } from "@/lib/domain/money";

interface Props {
  scope: string;
  profile: "reseller_dz" | "reseller_fr";
  wilayas: WilayaOption[];
  defaults: {
    contactName: string;
    companyName: string;
    phone: string;
    wilayaCode: string;
    communeCode: string;
    address: string;
    notes: string;
    country: string;
    city: string;
    postalCode: string;
  };
  france: { paymentTerms: string | null; shippingTerms: string | null; missing: string[] } | null;
}

export function ResellerCheckout({ scope, profile, wilayas, defaults, france }: Props) {
  const router = useRouter();
  const cart = useCart(scope);
  const [dest, setDest] = useState({ wilayaCode: defaults.wilayaCode, communeCode: defaults.communeCode });
  const [methodId, setMethodId] = useState<string | null>(null);
  const [f, setF] = useState({
    contactName: defaults.contactName,
    companyName: defaults.companyName,
    phone: defaults.phone,
    address: defaults.address,
    notes: defaults.notes,
    country: defaults.country,
    city: defaults.city,
    postalCode: defaults.postalCode,
  });
  const prefilled = Boolean(defaults.address);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const key = useRef<string | null>(null);

  const isFr = profile === "reseller_fr";
  const lines = cart.entries.map((e) => ({ sku: e.sku, quantity: e.quantity }));
  const destination = !isFr && dest.wilayaCode && dest.communeCode ? dest : null;
  const { quote, error, loading } = useQuote(
    "/api/revendeur/devis",
    lines.length ? (isFr ? { lines } : { lines, destination, shippingMethodId: methodId }) : null,
  );

  if (cart.entries.length === 0 && !submitting) {
    return (
      <div className="mt-6 rounded-lg bg-creme p-6">
        <p>Votre panier est vide.</p>
        <Link href="/revendeur" className="btn-primary mt-3">Retour au catalogue</Link>
      </div>
    );
  }

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    key.current ??= crypto.randomUUID();
    const body = isFr
      ? { idempotencyKey: key.current, lines, contactName: f.contactName, companyName: f.companyName, phone: f.phone, address: { country: f.country, city: f.city, postalCode: f.postalCode, address: f.address, notes: f.notes } }
      : { idempotencyKey: key.current, lines, contactName: f.contactName, companyName: f.companyName, phone: f.phone, address: { wilayaCode: dest.wilayaCode, communeCode: dest.communeCode, address: f.address, notes: f.notes }, shippingMethodId: methodId };
    try {
      const res = await fetch("/api/revendeur/commande", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.reference) {
        cart.clear();
        router.replace(`/revendeur/commandes/${encodeURIComponent(data.reference)}?nouvelle=1`);
        return;
      }
      if (res.status >= 400 && res.status < 500) key.current = null;
      setErrors(data.fieldErrors ?? {});
      setSubmitError(data.error ?? "La commande n'a pas pu être enregistrée.");
    } catch {
      setSubmitError("Connexion interrompue. Renvoyez la commande : elle ne sera pas dupliquée.");
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div className="space-y-6">
        <section className="card p-4">
          <h2 className="text-xl">Articles</h2>
          <ul className="mt-3 divide-y divide-sable">
            {cart.entries.map((e) => {
              const line = quote?.lines.find((l) => l.sku === e.sku);
              return (
                <li key={e.sku} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <span className="flex-1">{e.name}{e.label ? ` — ${e.label}` : ""} <span className="font-mono text-xs text-encre/60">{e.sku}</span></span>
                  <input
                    aria-label={`Quantité ${e.name}`}
                    className="field min-h-10 w-24 py-1"
                    inputMode="numeric"
                    value={e.quantity}
                    onChange={(ev) => cart.setQuantity(e.sku, Number.parseInt(ev.target.value.replace(/\D/g, "") || "0", 10))}
                  />
                  <span className="w-28 text-right font-semibold">{line ? formatMoney(line.lineTotalMinor, line.currency) : "—"}</span>
                  <button type="button" className="text-erreur underline" onClick={() => cart.remove(e.sku)}>Retirer</button>
                </li>
              );
            })}
          </ul>
        </section>

        {isFr && france && (
          <section className="card space-y-2 p-4 text-sm">
            <h2 className="text-xl">Conditions France</h2>
            {france.paymentTerms && <p><strong>Paiement :</strong> {france.paymentTerms}</p>}
            {france.shippingTerms && <p><strong>Expédition :</strong> {france.shippingTerms}</p>}
            {france.missing.length > 0 && (
              <Notice tone="warning" title="Commande ferme pas encore possible">
                <p>Vous pouvez préparer votre panier. Les éléments suivants doivent encore être confirmés par Naaqati :</p>
                <ul className="mt-1 list-disc pl-5">{france.missing.map((m) => <li key={m}>{m}</li>)}</ul>
              </Notice>
            )}
          </section>
        )}

        <fieldset className="card space-y-4 p-4">
          <legend className="px-1 font-serif text-xl text-marron">Contact et livraison</legend>
          {prefilled && <p className="text-sm text-encre/70">Vos informations habituelles sont pré-remplies : vérifiez-les, modifiez-les si besoin.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="contact">Nom du contact *</label>
              <input id="contact" className="field" value={f.contactName} onChange={set("contactName")} />
              {errors.contactName && <p className="field-error">{errors.contactName}</p>}
            </div>
            <div>
              <label className="field-label" htmlFor="company">Société / boutique</label>
              <input id="company" className="field" value={f.companyName} onChange={set("companyName")} />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="phone">Téléphone *</label>
            <input id="phone" type="tel" className="field" value={f.phone} onChange={set("phone")} />
            {errors.phone && <p className="field-error">{errors.phone}</p>}
          </div>
          {isFr ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="field-label" htmlFor="country">Pays (code) *</label>
                <input id="country" className="field uppercase" maxLength={2} value={f.country} onChange={(e) => setF((s) => ({ ...s, country: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="field-label" htmlFor="postal">Code postal *</label>
                <input id="postal" className="field" value={f.postalCode} onChange={set("postalCode")} />
                {errors["address.postalCode"] && <p className="field-error">{errors["address.postalCode"]}</p>}
              </div>
              <div>
                <label className="field-label" htmlFor="city">Ville *</label>
                <input id="city" className="field" value={f.city} onChange={set("city")} />
                {errors["address.city"] && <p className="field-error">{errors["address.city"]}</p>}
              </div>
            </div>
          ) : (
            <AddressFields wilayas={wilayas} wilayaCode={dest.wilayaCode} communeCode={dest.communeCode} onChange={(v) => { setDest(v); setMethodId(null); }} errors={errors} />
          )}
          <div>
            <label className="field-label" htmlFor="addr">Adresse *</label>
            <textarea id="addr" className="field min-h-20" value={f.address} onChange={set("address")} />
            {errors["address.address"] && <p className="field-error">{errors["address.address"]}</p>}
          </div>
          <div>
            <label className="field-label" htmlFor="notes">Indications</label>
            <textarea id="notes" className="field min-h-16" value={f.notes} onChange={set("notes")} />
          </div>
          {!isFr && quote && destination && <ShippingOptions quote={quote} selected={methodId} onSelect={setMethodId} />}
        </fieldset>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        {error && <Notice tone="error">{error}</Notice>}
        {quote && <IssuesList quote={quote} only={(c) => !(c === "destination_required" && !destination) && c !== "method_required" && !c.startsWith("fr_")} />}
        {quote && <QuoteSummary quote={quote} />}
        {quote && <PackingPlanView quote={quote} />}
        {submitError && <Notice tone="error">{submitError}</Notice>}
        <button type="submit" className="btn-primary w-full" disabled={!quote?.canOrder || loading || submitting}>
          {submitting ? "Enregistrement…" : "Valider la commande"}
        </button>
      </div>
    </form>
  );
}
