"use client";

import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { frFRLocale } from "@sanity/locale-fr-fr";
import { schemaTypes, SINGLETONS } from "./sanity/schemaTypes";
import { structure } from "./sanity/structure";
import { adminLinkTool } from "./sanity/admin-link-tool";

const singletons = new Set<string>(SINGLETONS);

export default defineConfig({
  name: "naaqati",
  title: "Naaqati — Catalogue et contenus",
  basePath: "/studio",
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "non-configure",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  plugins: [
    structureTool({ structure, title: "Contenu" }),
    frFRLocale(),
    ...(process.env.NODE_ENV === "development" ? [visionTool({ defaultApiVersion: "2026-10-01" })] : []),
  ],
  tools: (prev) => [...prev, adminLinkTool],
  schema: {
    types: schemaTypes,
    // Les documents uniques ne peuvent pas être créés en double.
    templates: (templates) => templates.filter(({ schemaType }) => !singletons.has(schemaType)),
  },
  document: {
    actions: (input, context) =>
      singletons.has(context.schemaType)
        ? input.filter(({ action }) => action && ["publish", "discardChanges", "restore"].includes(action))
        : input,
  },
});
