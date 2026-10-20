import { defineField, defineType } from "sanity";

export const category = defineType({
  name: "category",
  title: "Catégorie",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Nom", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", title: "Adresse de la page", type: "slug", options: { source: "title", maxLength: 60 }, validation: (r) => r.required() }),
    defineField({ name: "description", title: "Description", type: "text", rows: 3 }),
    defineField({ name: "image", title: "Image", type: "imageWithAlt" }),
    defineField({ name: "sortOrder", title: "Ordre d'affichage", type: "number", description: "Plus petit = affiché en premier.", initialValue: 100 }),
    defineField({ name: "hidden", title: "Masquer cette catégorie", type: "boolean", initialValue: false }),
    defineField({ name: "seo", title: "Référencement", type: "seo" }),
  ],
  orderings: [{ title: "Ordre d'affichage", name: "sortOrder", by: [{ field: "sortOrder", direction: "asc" }] }],
  preview: { select: { title: "title", media: "image", order: "sortOrder" }, prepare: ({ title, media, order }) => ({ title, media, subtitle: `Ordre : ${order ?? "–"}` }) },
});
