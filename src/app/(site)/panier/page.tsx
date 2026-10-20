import type { Metadata } from "next";
import { CartView } from "./CartView";

export const metadata: Metadata = { title: "Panier", robots: { index: false, follow: false } };

export default function CartPage() {
  return (
    <div className="container-page py-10">
      <p className="kicker text-center">Boutique</p>
      <h1 className="title-display mt-2 text-center text-3xl">Votre panier</h1>
      <CartView />
    </div>
  );
}
