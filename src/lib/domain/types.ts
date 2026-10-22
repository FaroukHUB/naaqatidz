/**
 * Types métier partagés. Ce module ne dépend ni de Sanity ni de Supabase :
 * les règles commerciales sont des fonctions pures, testées unitairement,
 * et appelées côté serveur avec des données chargées depuis les sources autorisées.
 */

/** Parcours de commande. Déterminé côté serveur, jamais par le navigateur. */
export type Channel = "retail" | "reseller_dz" | "reseller_fr";

/**
 * Référence vendable (SKU) telle que publiée dans le catalogue Sanity.
 * Pour un produit sans variante, le produit lui-même est la référence.
 */
export interface CatalogSku {
  sku: string;
  productId: string;
  productSlug: string;
  productName: string;
  /** Libellé de la variante (ex. « 100 g ») ; null pour un produit sans variante. */
  variantLabel: string | null;
  /** Prix public Algérie en unités mineures (centimes de dinar) ; null si non renseigné. */
  priceDzdMinor: number | null;
  /** Poids d'expédition unitaire (produit + conditionnement individuel), en grammes entiers. */
  shippingWeightG: number | null;
  /** true si la référence est commandable en ligne (vente activée, produit non archivé, mode « vente en ligne »). */
  saleable: boolean;
  imageUrl?: string | null;
  /** Contenance affichée (ex. « 110 g »), pour l'affichage uniquement. */
  netContent?: string | null;
}

export interface CartLineInput {
  sku: string;
  quantity: number;
}

export interface CartItem {
  sku: string;
  quantity: number;
}

export interface PackingConfig {
  /** Règle cliente : 10 unités maximum d'une même référence par carton. */
  maxUnitsPerSkuPerCarton: number;
  /** Règle cliente : 10 000 g maximum par carton (tare et marge comprises). */
  maxCartonWeightG: number;
  /** Tare du carton vide, en grammes. null = non configurée (bloque le colisage). */
  cartonTareG: number | null;
  /** Marge de protection réservée sur chaque carton, en grammes. null = non configurée. */
  safetyMarginG: number | null;
}

export interface FranceTerms {
  /** Activé explicitement par l'administratrice une fois les conditions validées. */
  ordersEnabled: boolean;
  currency: string | null;
  paymentTerms: string | null;
  shippingTerms: string | null;
  /** « on_quote » : frais d'expédition communiqués après la commande ; « fixed » : montant fixe par commande. */
  shippingFeeMode: "on_quote" | "fixed" | null;
  shippingFeeMinor: number | null;
}

export interface CommerceSettings {
  retailMaxUnitsPerSku: number;
  packing: PackingConfig;
  /**
   * Si true, une commande Algérie peut être enregistrée alors qu'aucun tarif de
   * livraison ne s'applique : la livraison est alors « à confirmer » et le total
   * est explicitement présenté comme provisoire. Désactivé par défaut.
   */
  allowOrdersWithoutShippingRate: boolean;
  france: FranceTerms;
}

export interface Issue {
  code: string;
  message: string;
  sku?: string;
}
