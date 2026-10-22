"use client";

import Link from "next/link";
import { useEffect } from "react";
import { claimResellerCart, RESELLER_SCOPE, useCart } from "./cart-store";

/** Onglet « Panier » de l'espace revendeur, avec le nombre d'articles ; réserve le panier au compte connecté. */
export function ResellerCartTab({ userId, className }: { userId: string; className: string }) {
  useEffect(() => claimResellerCart(userId), [userId]);
  const { count } = useCart(RESELLER_SCOPE);
  return (
    <Link href="/revendeur/panier" className={className}>
      Panier{count > 0 && <span className="ml-1.5 rounded-full bg-symbole px-2 py-0.5 text-xs text-white">{count}</span>}
    </Link>
  );
}
