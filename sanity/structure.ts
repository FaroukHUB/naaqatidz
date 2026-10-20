import type { StructureResolver } from "sanity/structure";

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Contenu Naaqati")
    .items([
      S.listItem().title("Produits").schemaType("product").child(S.documentTypeList("product").title("Produits").defaultOrdering([{ field: "sortOrder", direction: "asc" }])),
      S.listItem().title("Catégories").schemaType("category").child(S.documentTypeList("category").title("Catégories").defaultOrdering([{ field: "sortOrder", direction: "asc" }])),
      S.listItem().title("Sous-catégories").schemaType("subcategory").child(S.documentTypeList("subcategory").title("Sous-catégories").defaultOrdering([{ field: "sortOrder", direction: "asc" }])),
      S.divider(),
      S.listItem().title("Page d'accueil").id("homePage").child(S.document().schemaType("homePage").documentId("homePage")),
      S.listItem().title("Page « À propos »").id("aboutPage").child(S.document().schemaType("aboutPage").documentId("aboutPage")),
      S.listItem().title("Pages d'information (CGV, mentions…)").schemaType("legalPage").child(S.documentTypeList("legalPage").title("Pages d'information")),
      S.listItem().title("Coordonnées et réglages").id("siteSettings").child(S.document().schemaType("siteSettings").documentId("siteSettings")),
    ]);
