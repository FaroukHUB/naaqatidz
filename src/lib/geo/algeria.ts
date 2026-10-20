import "server-only";
import geo from "@/data/algeria-geo.json";

/**
 * Référentiel des wilayas et communes (69 wilayas, 1 541 communes — voir docs/referentiel-geographique.md).
 * Sa présence ne signifie PAS qu'une destination est desservie : la desserte se configure dans l'administration.
 */
export interface Wilaya {
  code: string;
  nameFr: string;
  nameAr: string;
  formerCode: string | null;
}
export interface Commune {
  code: string;
  nameFr: string;
  nameAr: string;
  wilayaCode: string;
  formerWilayaCode: string;
}

const wilayas = geo.wilayas as Wilaya[];
const communes = geo.communes as Commune[];
const communeByCode = new Map(communes.map((c) => [c.code, c]));
const wilayaByCode = new Map(wilayas.map((w) => [w.code, w]));

export const geoMeta = geo.meta;

export function listWilayas(): Wilaya[] {
  return wilayas;
}

export function getWilaya(code: string): Wilaya | undefined {
  return wilayaByCode.get(code);
}

export function listCommunes(wilayaCode: string): Commune[] {
  return communes.filter((c) => c.wilayaCode === wilayaCode);
}

export function getCommune(code: string): Commune | undefined {
  return communeByCode.get(code);
}

/** Vérifie qu'une commune existe et appartient bien à la wilaya indiquée. */
export function resolveAddress(wilayaCode: string, communeCode: string): { wilaya: Wilaya; commune: Commune } | null {
  const wilaya = wilayaByCode.get(wilayaCode);
  const commune = communeByCode.get(communeCode);
  if (!wilaya || !commune || commune.wilayaCode !== wilaya.code) return null;
  return { wilaya, commune };
}
