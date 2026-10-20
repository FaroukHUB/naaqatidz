import { defineArrayMember, defineField, defineType } from "sanity";
import { skuIsUnique } from "./sku";

const singleSku = (doc: unknown) => !(doc as { hasVariants?: boolean } | undefined)?.hasVariants;

export const product = defineType({
  name: "product",
  title: "Produit",
  type: "document",
  groups: [
    { name: "general", title: "Général", default: true },
    { name: "vente", title: "Vente et prix" },
    { name: "contenu", title: "Description" },
    { name: "seo", title: "Référencement" },
  ],
  fields: [
    defineField({ name: "title", title: "Nom du produit", type: "string", group: "general", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      title: "Adresse de la page",
      type: "slug",
      group: "general",
      description: "Générée à partir du nom. Évitez de la modifier après publication.",
      options: { source: "title", maxLength: 80 },
      validation: (r) => r.required(),
    }),
    defineField({ name: "category", title: "Catégorie", type: "reference", to: [{ type: "category" }], group: "general", validation: (r) => r.required() }),
    defineField({
      name: "subcategory",
      title: "Sous-catégorie",
      type: "reference",
      to: [{ type: "subcategory" }],
      group: "general",
      description: "Facultatif. Seules les sous-catégories de la catégorie choisie sont proposées.",
      options: {
        filter: ({ document }) => {
          const cat = (document as { category?: { _ref?: string } }).category?._ref;
          return cat ? { filter: "category._ref == $cat", params: { cat } } : { filter: "false" };
        },
      },
      validation: (r) =>
        r.custom(async (value: { _ref?: string } | undefined, ctx) => {
          if (!value?._ref) return true;
          const cat = (ctx.document as { category?: { _ref?: string } } | undefined)?.category?._ref;
          const client = ctx.getClient({ apiVersion: "2026-10-01" });
          const parent = await client.fetch<string | null>("*[_id in [$id, 'drafts.' + $id]][0].category._ref", { id: value._ref });
          return parent && parent === cat ? true : "Cette sous-catégorie n'appartient pas à la catégorie choisie.";
        }),
    }),
    defineField({
      name: "images",
      title: "Photos",
      type: "array",
      group: "general",
      of: [defineArrayMember({ type: "imageWithAlt" })],
      description: "La première photo est utilisée dans la boutique.",
    }),
    defineField({ name: "shortDescription", title: "Description courte", type: "text", rows: 3, group: "general", validation: (r) => r.max(220) }),
    defineField({ name: "sortOrder", title: "Ordre d'affichage dans la catégorie", type: "number", group: "general", description: "Plus petit = affiché en premier.", initialValue: 100 }),
    defineField({
      name: "archived",
      title: "Archivé",
      type: "boolean",
      group: "general",
      initialValue: false,
      description: "Masque le produit du site sans le supprimer (recommandé pour un produit déjà commandé : l'historique est conservé).",
    }),

    defineField({
      name: "salesMode",
      title: "Mode de vente",
      type: "string",
      group: "vente",
      initialValue: "online",
      options: {
        list: [
          { title: "Vente en ligne", value: "online" },
          { title: "Présentation uniquement (non commandable en ligne)", value: "presentation" },
        ],
        layout: "radio",
      },
      description: "Utilisez « Présentation uniquement » pour un produit dont les conditions de vente ou d'expédition ne sont pas définies (par exemple le lait de chamelle).",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "presentationNote",
      title: "Message affiché à la place du bouton d'achat",
      type: "text",
      rows: 2,
      group: "vente",
      hidden: ({ document }) => document?.salesMode !== "presentation",
    }),
    defineField({
      name: "hasVariants",
      title: "Ce produit a plusieurs variantes",
      type: "boolean",
      group: "vente",
      initialValue: false,
      description: "Activez si le produit existe en plusieurs contenances ou formats, chacun avec son SKU et son prix.",
    }),
    defineField({
      name: "sku",
      title: "SKU (référence unique)",
      type: "string",
      group: "vente",
      hidden: ({ document }) => !singleSku(document),
      description: "Identifiant stable utilisé pour les commandes et les tarifs revendeurs. Ne le modifiez plus une fois le produit commandé.",
      validation: (r) =>
        r.custom(async (value: string | undefined, ctx) => {
          if (!singleSku(ctx.document)) return true;
          if (!value) return "Le SKU est obligatoire.";
          return skuIsUnique(value, ctx);
        }),
    }),
    defineField({
      name: "priceDzd",
      title: "Prix public (DZD)",
      type: "number",
      group: "vente",
      hidden: ({ document }) => !singleSku(document),
      description: "Prix en dinars algériens, pour les particuliers et les revendeurs résidant en Algérie.",
      validation: (r) =>
        r.integer().positive().custom((value, ctx) => {
          const d = ctx.document as { saleable?: boolean; hasVariants?: boolean; salesMode?: string } | undefined;
          if (!d?.hasVariants && d?.saleable && d.salesMode === "online" && !value) return "Un produit en vente doit avoir un prix public.";
          return true;
        }),
    }),
    defineField({
      name: "netContent",
      title: "Contenance / poids net affiché",
      type: "string",
      group: "vente",
      hidden: ({ document }) => !singleSku(document),
      description: "Information affichée au client (ex. « 50 ml », « 100 g »). N'est pas utilisée pour l'expédition.",
    }),
    defineField({
      name: "shippingWeightG",
      title: "Poids d'expédition unitaire (grammes)",
      type: "number",
      group: "vente",
      hidden: ({ document }) => !singleSku(document),
      description: "Poids réel du produit avec son emballage individuel, en grammes entiers. Indispensable au calcul des cartons revendeurs.",
      validation: (r) => r.integer().positive().max(100000),
    }),
    defineField({
      name: "saleable",
      title: "Vente activée",
      type: "boolean",
      group: "vente",
      initialValue: true,
      hidden: ({ document }) => !singleSku(document),
    }),
    defineField({
      name: "variants",
      title: "Variantes",
      type: "array",
      group: "vente",
      of: [defineArrayMember({ type: "variant" })],
      hidden: ({ document }) => singleSku(document),
      validation: (r) =>
        r.custom((value: unknown[] | undefined, ctx) =>
          (ctx.document as { hasVariants?: boolean } | undefined)?.hasVariants && !value?.length ? "Ajoutez au moins une variante." : true,
        ),
    }),

    defineField({ name: "description", title: "Description détaillée", type: "richText", group: "contenu" }),
    defineField({ name: "ingredients", title: "Ingrédients / composition", type: "text", rows: 4, group: "contenu" }),
    defineField({ name: "usage", title: "Conseils d'utilisation", type: "text", rows: 4, group: "contenu" }),
    defineField({ name: "seo", title: "Référencement", type: "seo", group: "seo" }),
  ],
  orderings: [
    { title: "Ordre d'affichage", name: "sortOrder", by: [{ field: "sortOrder", direction: "asc" }] },
    { title: "Nom", name: "title", by: [{ field: "title", direction: "asc" }] },
  ],
  preview: {
    select: { title: "title", media: "images.0", archived: "archived", mode: "salesMode", category: "category.title" },
    prepare: ({ title, media, archived, mode, category }) => ({
      title: `${title ?? "Sans nom"}${archived ? " (archivé)" : ""}`,
      subtitle: [category, mode === "presentation" ? "présentation uniquement" : null].filter(Boolean).join(" · "),
      media,
    }),
  },
});
