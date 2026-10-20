import type { PackingPlan } from "@/lib/domain/packing";

/**
 * Interface transporteur. Les responsabilités sont séparées :
 *  - la COMMANDE est créée par le site (src/lib/server/orders.ts), indépendamment du transporteur ;
 *  - le COLISAGE est calculé par src/lib/domain/packing.ts (règles de la cliente) ;
 *  - la TARIFICATION de livraison est administrable (src/lib/domain/shipping.ts + tables shipping_*) ;
 *  - la CRÉATION D'EXPÉDITIONS et le SUIVI passent par un adaptateur comme celui-ci.
 *
 * Seul l'adaptateur « manuel » existe : aucune API transporteur n'est connectée.
 * Un adaptateur Maystro ne doit être écrit qu'à partir de la documentation et des accès officiels
 * (voir docs/livraison-et-maystro.md) — aucun endpoint n'est supposé ici.
 */
export interface ShipmentRequest {
  orderReference: string;
  /** Un colis par carton du plan de colisage (ou un seul colis sans plan). */
  parcels: { cartonIndex: number; weightG: number | null }[];
  /**
   * Montant total à encaisser pour la commande. Pour plusieurs colis, la répartition du
   * contre-remboursement doit suivre le mécanisme réellement prévu par le transporteur :
   * le total ne doit jamais être reproduit sur chaque colis.
   */
  cashOnDeliveryTotalMinor: number | null;
  currency: string;
  recipient: { name: string; phone: string; wilayaCode: string | null; communeCode: string | null; address: string };
  packingPlan: PackingPlan | null;
}

export interface ShipmentResult {
  cartonIndex: number;
  externalId: string | null;
  trackingNumber: string | null;
}

export interface CarrierAdapter {
  readonly code: string;
  readonly label: string;
  /** false tant que l'intégration n'est pas réellement configurée et vérifiée. */
  readonly automated: boolean;
  /** Doit être idempotent (clé = référence de commande + carton) pour éviter toute double création. */
  createShipments?(request: ShipmentRequest): Promise<ShipmentResult[]>;
  getTracking?(externalId: string): Promise<{ status: string; updatedAt: string } | null>;
}

/** Fonctionnement actuel : export CSV, saisie manuelle des références de suivi et des statuts. */
export const manualCarrier: CarrierAdapter = {
  code: "manuel",
  label: "Saisie manuelle",
  automated: false,
};
