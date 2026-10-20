import "server-only";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";
import { sha256 } from "./orders";

export const CONFIRMATION_COOKIE = "nq_confirmation";

export interface ConfirmationView {
  reference: string;
  created_at: string;
  currency: string;
  subtotal_minor: number;
  shipping_minor: number | null;
  shipping_quote_status: "quoted" | "to_confirm" | "not_applicable";
  total_minor: number;
  payment_method: "cod" | "a_definir";
  shipping_method_label: string | null;
  ship_wilaya_name: string | null;
  ship_commune_name: string | null;
  items: { sku: string; product_name: string; variant_label: string | null; quantity: number; unit_price_minor: number; line_total_minor: number }[];
}

/**
 * Détail de confirmation : accessible uniquement avec le jeton conservé dans un cookie httpOnly
 * posé par le serveur lors de la commande. La référence seule ne donne accès à rien.
 */
export async function readConfirmation(reference: string): Promise<ConfirmationView | null> {
  const raw = (await cookies()).get(CONFIRMATION_COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.indexOf(".");
  const ref = raw.slice(0, dot);
  const token = raw.slice(dot + 1);
  if (dot < 1 || ref !== reference || !token) return null;
  const { data, error } = await createServiceClient().rpc("get_order_confirmation", { p_reference: reference, p_token_hash: sha256(token) });
  if (error || !data) return null;
  return data as ConfirmationView;
}
