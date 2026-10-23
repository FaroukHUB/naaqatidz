import type { Metadata } from "next";
import { listWilayas } from "@/lib/geo/algeria";
import { PageHeader } from "@/components/site/PageHeader";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Devenir revendeur",
  description: "Créez votre compte revendeur Naaqati pour commander nos produits en quantité.",
  alternates: { canonical: "/devenir-revendeur" },
};

export default function BecomeResellerPage() {
  const wilayas = listWilayas().map((w) => ({ code: w.code, name: w.nameFr }));
  return (
    <>
      <PageHeader kicker="Professionnels" title="Devenir revendeur" intro="Boutiques et commerçants : créez votre compte pour commander nos produits en quantité." />
      <div className="container-page max-w-3xl py-10">
        <SignupForm wilayas={wilayas} />
      </div>
    </>
  );
}
