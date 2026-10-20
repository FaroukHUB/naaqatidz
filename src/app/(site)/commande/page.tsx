import type { Metadata } from "next";
import { listWilayas } from "@/lib/geo/algeria";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "Commande", robots: { index: false, follow: false } };

export default function CheckoutPage() {
  const wilayas = listWilayas().map((w) => ({ code: w.code, name: w.nameFr }));
  return (
    <div className="container-page py-8">
      <p className="kicker text-center">Commande</p>
      <h1 className="title-display mt-2 text-center text-3xl">Finaliser la commande</h1>
      <p className="mt-3 text-center text-encre/80">Aucun compte n&apos;est nécessaire. Les champs marqués d&apos;un astérisque (*) sont obligatoires.</p>
      <CheckoutForm wilayas={wilayas} />
    </div>
  );
}
