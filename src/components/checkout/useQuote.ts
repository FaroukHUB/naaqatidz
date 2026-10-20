"use client";

import { useEffect, useRef, useState } from "react";
import type { Quote } from "@/lib/domain/quote";

export interface QuoteRequest {
  lines: { sku: string; quantity: number }[];
  destination?: { wilayaCode: string; communeCode: string } | null;
  shippingMethodId?: string | null;
}

/** Demande au serveur de recalculer le panier (prix, limites, livraison, colisage). */
export function useQuote(endpoint: string, request: QuoteRequest | null) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = request ? JSON.stringify(request) : null;
  const seq = useRef(0);

  useEffect(() => {
    if (!key) return;
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: key });
        const data = await res.json().catch(() => ({}));
        if (id !== seq.current) return;
        if (!res.ok) {
          setError(data.error ?? "Impossible de calculer le panier.");
          setQuote(null);
        } else {
          setError(null);
          setQuote(data.quote);
        }
      } catch {
        if (id === seq.current) setError("Connexion impossible. Vérifiez votre réseau.");
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [endpoint, key]);

  return { quote: key ? quote : null, error: key ? error : null, loading };
}
