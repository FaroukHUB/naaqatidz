import { defineField, defineType } from "sanity";

export const seo = defineType({
  name: "seo",
  title: "Référencement (Google)",
  type: "object",
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({
      name: "title",
      title: "Titre affiché dans Google",
      type: "string",
      description: "60 caractères environ. Laissez vide pour utiliser le titre de la page.",
      validation: (r) => r.max(70).warning("Un titre trop long sera tronqué par Google."),
    }),
    defineField({
      name: "description",
      title: "Description affichée dans Google",
      type: "text",
      rows: 3,
      description: "150 caractères environ.",
      validation: (r) => r.max(170).warning("Une description trop longue sera tronquée."),
    }),
  ],
});

export const imageWithAlt = defineType({
  name: "imageWithAlt",
  title: "Image",
  type: "image",
  options: { hotspot: true },
  fields: [
    defineField({
      name: "alt",
      title: "Description de l'image (texte alternatif)",
      type: "string",
      description: "Décrivez ce que montre la photo, pour les personnes malvoyantes et pour Google.",
      validation: (r) => r.required().error("Le texte alternatif est obligatoire."),
    }),
  ],
});

export const richText = defineType({
  name: "richText",
  title: "Texte",
  type: "array",
  of: [
    {
      type: "block",
      styles: [
        { title: "Paragraphe", value: "normal" },
        { title: "Intertitre", value: "h2" },
        { title: "Sous-intertitre", value: "h3" },
        { title: "Citation", value: "blockquote" },
      ],
      lists: [
        { title: "Liste à puces", value: "bullet" },
        { title: "Liste numérotée", value: "number" },
      ],
      marks: {
        decorators: [
          { title: "Gras", value: "strong" },
          { title: "Italique", value: "em" },
        ],
        annotations: [
          {
            name: "link",
            type: "object",
            title: "Lien",
            fields: [{ name: "href", type: "url", title: "Adresse", validation: (r) => r.uri({ scheme: ["http", "https", "mailto", "tel"], allowRelative: true }) }],
          },
        ],
      },
    },
  ],
});
