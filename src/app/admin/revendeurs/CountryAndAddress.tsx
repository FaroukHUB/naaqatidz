"use client";

import { useState } from "react";
import { AddressFields, type WilayaOption } from "@/components/checkout/AddressFields";

export interface AddressDefaults {
  wilayaCode: string;
  communeCode: string;
  city: string;
  postalCode: string;
  address: string;
  notes: string;
}

/**
 * Pays du revendeur (détermine ses prix) et son adresse de livraison habituelle.
 * L'adresse est facultative : elle pré-remplit le panier du revendeur.
 */
export function CountryAndAddress({ wilayas, country: initialCountry, address }: { wilayas: WilayaOption[]; country: "DZ" | "FR"; address: AddressDefaults }) {
  const [country, setCountry] = useState(initialCountry);
  const [dest, setDest] = useState({ wilayaCode: address.wilayaCode, communeCode: address.communeCode });
  const card = "flex cursor-pointer gap-3 rounded-md border border-sable bg-white p-3 has-[:checked]:border-symbole has-[:checked]:bg-creme";

  return (
    <>
      <fieldset className="sm:col-span-2">
        <legend className="field-label">Pays du revendeur *</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          <label className={card}>
            <input type="radio" name="country" value="DZ" checked={country === "DZ"} onChange={() => setCountry("DZ")} />
            <span><strong>Algérie</strong><br /><span className="text-sm text-encre/70">Prix publics en DZD, sans limite de quantité.</span></span>
          </label>
          <label className={card}>
            <input type="radio" name="country" value="FR" checked={country === "FR"} onChange={() => setCountry("FR")} />
            <span><strong>France</strong><br /><span className="text-sm text-encre/70">Tarifs France (menu « Tarifs France »).</span></span>
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:col-span-2">
        <legend className="field-label">Adresse de livraison (facultatif — pré-remplie dans son panier)</legend>
        {country === "DZ" ? (
          <>
            <AddressFields wilayas={wilayas} wilayaCode={dest.wilayaCode} communeCode={dest.communeCode} onChange={setDest} />
            <input type="hidden" name="ship_wilaya_code" value={dest.wilayaCode} />
            <input type="hidden" name="ship_commune_code" value={dest.communeCode} />
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="ship_postal_code" className="field-label">Code postal</label><input id="ship_postal_code" name="ship_postal_code" defaultValue={address.postalCode} className="field" /></div>
            <div><label htmlFor="ship_city" className="field-label">Ville</label><input id="ship_city" name="ship_city" defaultValue={address.city} className="field" /></div>
          </div>
        )}
        <div><label htmlFor="ship_address" className="field-label">Adresse (rue, numéro, quartier)</label><textarea id="ship_address" name="ship_address" defaultValue={address.address} rows={2} className="field" /></div>
        <div><label htmlFor="ship_notes" className="field-label">Indications pour la livraison</label><input id="ship_notes" name="ship_notes" defaultValue={address.notes} className="field" /></div>
      </fieldset>
    </>
  );
}
