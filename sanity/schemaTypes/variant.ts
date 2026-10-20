import { defineField, defineType } from "sanity";
import { skuIsUnique } from "./sku";

/** Variante vendable (ex. contenance différente). Chaque variante a son propre SKU. */
export const variant = defineType({
  name: "variant",
  title: "Variante",
  type: "object",
  fields: [
    defineField({ name: "label", title: "Nom de la variante", type: "string", description: "Ex. « 100 g », « Lot de 2 ».", validation: (r) => r.required() }),
    defineField({
      name: "sku",
      title: "SKU (référence unique)",
      type: "string",
      description: "Identifiant stable utilisé pour les commandes et les tarifs revendeurs. Ne le modifiez plus une fois la référence commandée.",
      validation: (r) => r.required().custom(skuIsUnique),
    }),
    defineField({
      name: "priceDzd",
      title: "Prix public (DZD)",
      type: "number",
      description: "Prix en dinars algériens, pour les particuliers et les revendeurs résidant en Algérie.",
      validation: (r) => r.integer().positive(),
    }),
    defineField({
      name: "netContent",
      title: "Contenance / poids net affiché",
      type: "string",
      description: "Information affichée au client (ex. « 50 ml », « 100 g »). N'est pas utilisée pour l'expédition.",
    }),
    defineField({
      name: "shippingWeightG",
      title: "Poids d'expédition unitaire (grammes)",
      type: "number",
      description: "Poids réel du produit avec son emballage individuel, en grammes entiers. Indispensable au calcul des cartons revendeurs.",
      validation: (r) => r.integer().positive().max(100000),
    }),
    defineField({ name: "saleable", title: "Vente activée", type: "boolean", initialValue: true }),
  ],
  validation: (r) =>
    r.custom((v: { saleable?: boolean; priceDzd?: number } | undefined) =>
      v?.saleable && !v.priceDzd ? "Une variante en vente doit avoir un prix public." : true,
    ),
  preview: {
    select: { title: "label", sku: "sku", price: "priceDzd", saleable: "saleable" },
    prepare: ({ title, sku, price, saleable }) => ({
      title: `${title ?? "Variante"}${saleable === false ? " (vente désactivée)" : ""}`,
      subtitle: `${sku ?? "sans SKU"} · ${price ? `${price} DZD` : "prix manquant"}`,
    }),
  },
});
