import { defineField, defineType } from "sanity";

/** Sous-catégorie (ex. « Shampoings » dans « Soins des cheveux »). Facultative : une catégorie peut s'en passer. */
export const subcategory = defineType({
  name: "subcategory",
  title: "Sous-catégorie",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Nom", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", title: "Adresse de la page", type: "slug", options: { source: "title", maxLength: 60 }, validation: (r) => r.required() }),
    defineField({ name: "category", title: "Catégorie", type: "reference", to: [{ type: "category" }], validation: (r) => r.required() }),
    defineField({ name: "description", title: "Description", type: "text", rows: 3 }),
    defineField({ name: "sortOrder", title: "Ordre d'affichage", type: "number", description: "Plus petit = affiché en premier.", initialValue: 100 }),
    defineField({ name: "seo", title: "Référencement", type: "seo" }),
  ],
  orderings: [{ title: "Ordre d'affichage", name: "sortOrder", by: [{ field: "sortOrder", direction: "asc" }] }],
  preview: {
    select: { title: "title", category: "category.title", order: "sortOrder" },
    prepare: ({ title, category, order }) => ({ title, subtitle: `${category ?? "Sans catégorie"} · ordre ${order ?? "–"}` }),
  },
});
