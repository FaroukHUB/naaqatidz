"use client";

import Link from "next/link";
import { RETAIL_SCOPE, useCart } from "./cart-store";

export function CartLink() {
  const { count } = useCart(RETAIL_SCOPE);
  return (
    <Link href="/panier" className="relative inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 font-semibold text-marron hover:bg-creme">
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 7h12l-1 13H7L6 7Z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
      <span>Panier</span>
      {count > 0 && (
        <span className="rounded-full bg-symbole px-2 py-0.5 text-xs text-white" aria-label={`${count} article${count > 1 ? "s" : ""}`}>
          {count}
        </span>
      )}
    </Link>
  );
}
