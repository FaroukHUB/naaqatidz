import type { Metadata } from "next";
import { CartView } from "./CartView";

export const metadata: Metadata = { title: "Panier", robots: { index: false, follow: false } };

export default function CartPage() {
  return (
    <div className="container-page py-8">
      <h1 className="text-4xl">Votre panier</h1>
      <CartView />
    </div>
  );
}
