import type { Metadata, Viewport } from "next";
import "@fontsource/cinzel/latin-400.css";
import "@fontsource/cinzel/latin-600.css";
import "./globals.css";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: "Naaqati — Produits du Sahara", template: "%s | Naaqati" },
  description: "Naaqati, marque implantée au cœur du Sahara algérien : savons artisanaux, soins à base de graisse de bosse de chameau et khôl traditionnel.",
  applicationName: "Naaqati",
  openGraph: { siteName: "Naaqati", locale: "fr_DZ", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#f3e7e0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
