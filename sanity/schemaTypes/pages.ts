import { defineArrayMember, defineField, defineType } from "sanity";

export const homePage = defineType({
  name: "homePage",
  title: "Page d'accueil",
  type: "document",
  fields: [
    defineField({ name: "heroTitle", title: "Titre principal", type: "string" }),
    defineField({ name: "heroText", title: "Texte d'introduction", type: "text", rows: 3 }),
    defineField({ name: "heroImage", title: "Photo principale", type: "imageWithAlt" }),
    defineField({
      name: "featuredProducts",
      title: "Produits mis en avant",
      type: "array",
      of: [defineArrayMember({ type: "reference", to: [{ type: "product" }] })],
      validation: (r) => r.max(8).unique(),
    }),
    defineField({ name: "storyTitle", title: "Titre de la section « Notre histoire »", type: "string" }),
    defineField({ name: "storyText", title: "Texte court « Notre histoire »", type: "text", rows: 5 }),
    defineField({ name: "storyImage", title: "Photo « Notre histoire »", type: "imageWithAlt" }),
    defineField({ name: "seo", title: "Référencement", type: "seo" }),
  ],
  preview: { prepare: () => ({ title: "Page d'accueil" }) },
});

export const aboutPage = defineType({
  name: "aboutPage",
  title: "Page « À propos »",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Titre", type: "string", initialValue: "À propos de Naaqati", validation: (r) => r.required() }),
    defineField({ name: "image", title: "Photo", type: "imageWithAlt" }),
    defineField({ name: "body", title: "Texte", type: "richText" }),
    defineField({ name: "seo", title: "Référencement", type: "seo" }),
  ],
});

export const LEGAL_PAGES = [
  { title: "Mentions légales", value: "mentions-legales" },
  { title: "Conditions générales de vente", value: "conditions-generales-de-vente" },
  { title: "Livraison et retours", value: "livraison-et-retours" },
  { title: "Politique de confidentialité", value: "confidentialite" },
] as const;

export const legalPage = defineType({
  name: "legalPage",
  title: "Page d'information",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Titre", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      title: "Page",
      type: "string",
      options: { list: [...LEGAL_PAGES], layout: "radio" },
      validation: (r) => r.required(),
    }),
    defineField({ name: "body", title: "Texte", type: "richText" }),
    defineField({ name: "seo", title: "Référencement", type: "seo" }),
  ],
});

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Coordonnées et réglages du site",
  type: "document",
  fields: [
    defineField({ name: "phone", title: "Téléphone", type: "string" }),
    defineField({ name: "whatsapp", title: "WhatsApp (numéro au format international, ex. 213…)", type: "string" }),
    defineField({ name: "email", title: "Email de contact", type: "string", validation: (r) => r.email() }),
    defineField({ name: "address", title: "Adresse", type: "text", rows: 2 }),
    defineField({ name: "openingHours", title: "Horaires", type: "text", rows: 2 }),
    defineField({ name: "instagram", title: "Lien Instagram", type: "url" }),
    defineField({ name: "facebook", title: "Lien Facebook", type: "url" }),
    defineField({ name: "tiktok", title: "Lien TikTok", type: "url" }),
    defineField({ name: "contactIntro", title: "Texte de la page Contact", type: "text", rows: 3 }),
    defineField({ name: "resellerIntro", title: "Texte de présentation de l'espace revendeur", type: "text", rows: 3 }),
    defineField({ name: "defaultSeo", title: "Référencement par défaut", type: "seo" }),
  ],
  preview: { prepare: () => ({ title: "Coordonnées et réglages du site" }) },
});
