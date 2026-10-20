export const ORDER_STATUSES = ["nouvelle", "confirmee", "en_preparation", "expediee", "livree", "annulee", "retournee"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  nouvelle: "Nouvelle",
  confirmee: "Confirmée",
  en_preparation: "En préparation",
  expediee: "Expédiée",
  livree: "Livrée",
  annulee: "Annulée",
  retournee: "Retournée",
};

export const PAYMENT_STATUSES = ["a_encaisser", "encaisse", "non_encaisse", "rembourse"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  a_encaisser: "À encaisser (paiement à la livraison)",
  encaisse: "Encaissé",
  non_encaisse: "Non encaissé",
  rembourse: "Remboursé",
};

export const CHANNEL_LABELS = { retail: "Particulier", reseller_dz: "Revendeur Algérie", reseller_fr: "Revendeur France" } as const;
export const PAYMENT_METHOD_LABELS = { cod: "Paiement à la livraison", a_definir: "Selon conditions France" } as const;
