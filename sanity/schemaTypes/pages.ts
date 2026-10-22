import { defineArrayMember, defineField, defineType } from "sanity";

function linkRule(value: string | undefined): true | string {
  if (!value) return true;
  return /^\/(?!\/)/.test(value) || /^https:\/\//.test(value) ? true : "Le lien doit commencer par « / » (page du site) ou « https:// ».";
}

export const homePage = defineType({
  name: "homePage",
  title: "Page d'accueil",
  type: "document",
  fields: [
    defineField({ name: "heroTitle", title: "Titre principal", type: "string" }),
    defineField({ name: "heroText", title: "Texte d'introduction", type: "text", rows: 3 }),
    defineField({ name: "heroImage", title: "Photo principale", type: "imageWithAlt", description: "Utilisée seulement s'il n'y a pas de vidéo." }),
    defineField({
      name: "heroVideoDesktop",
      title: "Vidéo d'en-tête (paysage 16:9)",
      type: "file",
      options: { accept: "video/mp4,video/webm" },
      description: "MP4, sans son, idéalement moins de 8 Mo. Affichée en entier sur téléphone (texte dessous) et sur ordinateur (texte à gauche), sauf si une photo ordinateur est choisie ci-dessous.",
    }),
    defineField({
      name: "heroDesktopImage",
      title: "Photo d'en-tête — ordinateur (facultatif)",
      type: "imageWithAlt",
      description: "Si elle est renseignée, elle remplace la vidéo sur ordinateur ; le téléphone garde la vidéo. Format paysage 16:9 conseillé (ex. 1920 × 1080), côté gauche dégagé pour le texte.",
    }),
    defineField({
      name: "heroVideoMobile",
      title: "Vidéo pour téléphone (facultatif)",
      type: "file",
      options: { accept: "video/mp4,video/webm" },
      description: "MP4, sans son, idéalement moins de 5 Mo. Verticale (9:16) : plein écran, texte en bas. Horizontale : affichée en entier, texte dessous. Si vide, la vidéo paysage ci-dessus est utilisée.",
    }),
    defineField({
      name: "heroPoster",
      title: "Image d'attente de la vidéo",
      type: "imageWithAlt",
      description: "Affichée pendant le chargement, et à la place de la vidéo pour les visiteurs qui ont désactivé les animations. Conseillé : une image extraite de la vidéo.",
    }),
    defineField({ name: "heroButtonLabel", title: "Bouton principal — texte", type: "string", initialValue: "Découvrir la boutique" }),
    defineField({ name: "heroButtonLink", title: "Bouton principal — lien", type: "string", initialValue: "/boutique", description: "Adresse d'une page du site (ex. /boutique, /categorie/soin-de-la-peau) ou lien complet https://…", validation: (r) => r.custom(linkRule) }),
    defineField({ name: "heroSecondaryLabel", title: "Second bouton — texte (facultatif)", type: "string" }),
    defineField({ name: "heroSecondaryLink", title: "Second bouton — lien", type: "string", validation: (r) => r.custom(linkRule) }),
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

export const LEGAL_PAGES = [ // synchronisé avec src/lib/legal-pages.ts
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
    defineField({
      name: "contacts",
      title: "Numéros de contact",
      type: "array",
      description: "Affichés sur la page Contact et en bas de chaque page (ex. « Contact hommes », « Contact femmes »).",
      of: [
        defineArrayMember({
          type: "object",
          name: "contactLine",
          title: "Numéro",
          fields: [
            defineField({ name: "label", title: "Intitulé", type: "string", validation: (r) => r.required() }),
            defineField({ name: "phone", title: "Numéro (format international, ex. +213 779 82 72 20)", type: "string", validation: (r) => r.required().regex(/^\+?[0-9 ]{8,20}$/, { name: "numéro" }) }),
            defineField({ name: "whatsapp", title: "Joignable sur WhatsApp", type: "boolean", initialValue: false }),
          ],
          preview: { select: { title: "label", subtitle: "phone" } },
        }),
      ],
    }),
    defineField({ name: "phone", title: "Téléphone (ancien champ, utilisez plutôt « Numéros de contact »)", type: "string", hidden: ({ value }) => !value }),
    defineField({ name: "whatsapp", title: "WhatsApp (numéro au format international, ex. 213…)", type: "string" }),
    defineField({ name: "email", title: "Email de contact", type: "string", validation: (r) => r.email() }),
    defineField({ name: "address", title: "Adresse", type: "text", rows: 2 }),
    defineField({ name: "openingHours", title: "Horaires", type: "text", rows: 2 }),
    defineField({ name: "instagram", title: "Lien Instagram", type: "url" }),
    defineField({ name: "facebook", title: "Lien Facebook", type: "url" }),
    defineField({ name: "tiktok", title: "Lien TikTok", type: "url" }),
    defineField({ name: "telegram", title: "Lien Telegram", type: "url" }),
    defineField({ name: "contactIntro", title: "Texte de la page Contact", type: "text", rows: 3 }),
    defineField({ name: "resellerIntro", title: "Texte de présentation de l'espace revendeur", type: "text", rows: 3 }),
    defineField({ name: "defaultSeo", title: "Référencement par défaut", type: "seo" }),
  ],
  preview: { prepare: () => ({ title: "Coordonnées et réglages du site" }) },
});
