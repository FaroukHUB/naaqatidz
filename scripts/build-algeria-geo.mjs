#!/usr/bin/env node
// Builds src/data/algeria-geo.json (69 wilayas / 1541 communes, Algeria 2026)
// from pinned third-party datasets in scripts/data-sources/ plus the
// hand-written overrides scripts/data-sources/new-wilayas-2026.json.
// No dependencies. Run from the repo root: node scripts/build-algeria-geo.mjs
// See docs/referentiel-geographique.md for provenance and update procedure.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'scripts', 'data-sources');
const OUT = join(ROOT, 'src', 'data', 'algeria-geo.json');

const EXPECTED_WILAYAS = 69;
const EXPECTED_COMMUNES = 1541;

const SOURCES = [
  {
    label: 'geoalgeria (Yasser\'s Studio) — data/algeria.json, base: noms FR/AR, codes communes ONS 2021, rattachement 69 wilayas',
    url: 'https://raw.githubusercontent.com/yasserstudio/geoalgeria/ce8083dd18e5b77bd2c48790f3874aaa34ffbdee/packages/dataset/data/algeria.json',
    retrievedAt: '2026-10-20',
    license: 'MIT (compilation noms/codes) ; parties OSM non utilisées ici (ODbL)',
    notes: 'Commit ce8083dd18e5b77bd2c48790f3874aaa34ffbdee, identique au paquet npm geoalgeria@2.3.0. Fichier local: scripts/data-sources/geoalgeria-algeria.json (sha256 85c2fff2…0fa4).',
  },
  {
    label: 'syscli/algeria — data/communes.csv + data/wilayas.csv, contrôle croisé (transcription du JORADP)',
    url: 'https://raw.githubusercontent.com/syscli/algeria/7789ea926e7c0751f33775ecf558fa026e2ee81b/data/communes.csv',
    retrievedAt: '2026-10-20',
    license: 'MIT',
    notes: 'Commit 7789ea926e7c0751f33775ecf558fa026e2ee81b. Utilisé uniquement pour vérification (rattachements, comptes). Utilise les codes ONS antérieurs à 2019 pour les communes des wilayas 49-58.',
  },
  {
    label: 'Loi n° 26-06 du 4 avril 2026 relative à l\'organisation territoriale (JORADP n° 25 du 5 avril 2026)',
    url: 'https://www.joradp.dz/FTP/jo-francais/2026/F2026025.pdf',
    retrievedAt: '2026-10-20',
    notes: 'Texte officiel non consulté directement (hôte inaccessible depuis l\'environnement de recherche) ; contenu vérifié via les sources secondaires citées dans new-wilayas-2026.json.',
  },
  {
    label: 'Décret présidentiel n° 26-206 du 25 mai 2026 (noms, numéros et chefs-lieux des wilayas 59-69, JORADP n° 40)',
    url: 'https://www.joradp.dz/FTP/jo-francais/2026/F2026040.pdf',
    retrievedAt: '2026-10-20',
    notes: 'Idem : non consulté directement.',
  },
  {
    label: 'Overrides manuels wilayas 59-69 (scripts/data-sources/new-wilayas-2026.json), sources par entrée',
    url: 'scripts/data-sources/new-wilayas-2026.json',
    retrievedAt: '2026-10-20',
  },
];

const pad2 = (n) => String(n).padStart(2, '0');
const pad4 = (n) => String(n).padStart(4, '0');
const readJson = (f) => JSON.parse(readFileSync(join(SRC, f), 'utf8'));

function readCsv(f) {
  // Simple CSV: the syscli files contain no quoted commas in the columns we use.
  const [head, ...rows] = readFileSync(join(SRC, f), 'utf8').trim().split(/\r?\n/);
  const cols = head.split(',');
  return rows.map((r) => {
    const v = r.split(',');
    return Object.fromEntries(cols.map((c, i) => [c, v[i] ?? '']));
  });
}

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ---------- 1. Base dataset (geoalgeria) ----------
const base = readJson('geoalgeria-algeria.json');
const wilayas = new Map(); // code -> wilaya
const communes = new Map(); // code -> commune

for (const w of base) {
  const code = pad2(w.code);
  wilayas.set(code, { code, nameFr: w.name_fr, nameAr: w.name_ar, formerCode: null });
  for (const c of w.communes) {
    const cc = pad4(c.code_commune);
    if (communes.has(cc)) fail(`code commune en double dans la base: ${cc}`);
    if (pad2(c.wilaya_code) !== code) fail(`commune ${cc}: wilaya_code ${c.wilaya_code} ≠ wilaya parente ${code}`);
    communes.set(cc, {
      code: cc,
      nameFr: c.name_fr,
      nameAr: c.name_ar,
      wilayaCode: code,
      formerWilayaCode: cc.slice(0, 2),
    });
  }
}

// ---------- 2. Overrides for wilayas 59-69 ----------
const ov = readJson('new-wilayas-2026.json');
const overridden = new Set();
for (const w of ov.wilayas) {
  const cur = wilayas.get(w.code);
  if (!cur) fail(`wilaya ${w.code} (${w.nameFr}) absente de la base`);
  if (cur && (cur.nameFr !== w.nameFr || cur.nameAr !== w.nameAr)) {
    warn(`wilaya ${w.code}: nom base "${cur.nameFr} / ${cur.nameAr}" remplacé par override "${w.nameFr} / ${w.nameAr}"`);
  }
  wilayas.set(w.code, { code: w.code, nameFr: w.nameFr, nameAr: w.nameAr, formerCode: w.formerCode });
  if (!w.communes.includes(w.capitalCommune)) fail(`wilaya ${w.code}: chef-lieu ${w.capitalCommune} absent de sa liste`);
  for (const cc of w.communes) {
    const c = communes.get(cc);
    if (!c) { fail(`override ${w.code}: commune ${cc} absente de la base`); continue; }
    if (overridden.has(cc)) fail(`commune ${cc} présente dans deux overrides`);
    overridden.add(cc);
    if (c.wilayaCode !== w.code) warn(`commune ${cc} ${c.nameFr}: base=${c.wilayaCode}, override=${w.code} (override appliqué)`);
    if (cc.slice(0, 2) !== w.formerCode) fail(`commune ${cc}: préfixe ≠ wilaya d'origine ${w.formerCode}`);
    c.wilayaCode = w.code;
  }
}
// No commune outside the overrides may sit in 59-69.
for (const c of communes.values()) {
  if (+c.wilayaCode >= 59 && !overridden.has(c.code)) fail(`commune ${c.code} ${c.nameFr} en wilaya ${c.wilayaCode} sans override`);
}

// ---------- 3. Cross-check with syscli/algeria ----------
const sysCommunes = readCsv('syscli-communes.csv');
const sysWilayas = readCsv('syscli-wilayas.csv');
let sysAgree = 0;
const sysDiff = [];
for (const s of sysCommunes) {
  const c = communes.get(s.code);
  if (!c) continue; // pre-2019 code for a commune of wilayas 49-58, handled by counts below
  if (c.wilayaCode === s.wilaya_code) sysAgree++;
  else sysDiff.push(`${s.code} ${s.name_fr}: référentiel=${c.wilayaCode}, syscli=${s.wilaya_code}`);
}
const countBy = (arr, key) => arr.reduce((m, x) => m.set(x[key], (m.get(x[key]) ?? 0) + 1), new Map());
const ourCounts = countBy([...communes.values()], 'wilayaCode');
for (const sw of sysWilayas) {
  const n = ourCounts.get(sw.code) ?? 0;
  if (String(n) !== sw.communes) sysDiff.push(`wilaya ${sw.code}: ${n} communes ici, ${sw.communes} chez syscli`);
}
const knownUnresolved = new Set((ov.unresolved ?? []).map((u) => u.commune));
for (const d of sysDiff) {
  const isKnown = [...knownUnresolved].some((k) => d.startsWith(k)) || /wilaya (30|55):/.test(d);
  (isKnown ? warn : fail)(`écart syscli${isKnown ? ' (connu, non résolu)' : ''}: ${d}`);
}

// ---------- 4. Validate & write ----------
const wilayaList = [...wilayas.values()].sort((a, b) => a.code.localeCompare(b.code));
const coll = new Intl.Collator('fr', { sensitivity: 'base' });
const communeList = [...communes.values()].sort(
  (a, b) => a.wilayaCode.localeCompare(b.wilayaCode) || coll.compare(a.nameFr, b.nameFr) || a.code.localeCompare(b.code),
);

if (wilayaList.length !== EXPECTED_WILAYAS) fail(`${wilayaList.length} wilayas (attendu ${EXPECTED_WILAYAS})`);
if (communeList.length !== EXPECTED_COMMUNES) fail(`${communeList.length} communes (attendu ${EXPECTED_COMMUNES})`);
for (const w of wilayaList) {
  if (!(ourCounts.get(w.code) > 0)) fail(`wilaya ${w.code} sans commune`);
  if (!w.nameFr || !w.nameAr) fail(`wilaya ${w.code}: nom manquant`);
}
for (const c of communeList) {
  if (!/^\d{4}$/.test(c.code)) fail(`code commune invalide: ${c.code}`);
  if (!c.nameFr || !c.nameAr) fail(`commune ${c.code}: nom manquant`);
  if (!wilayas.has(c.wilayaCode)) fail(`commune ${c.code}: wilaya ${c.wilayaCode} inconnue`);
}

const movedCount = communeList.filter((c) => c.wilayaCode !== c.formerWilayaCode).length;

const out = {
  meta: {
    generatedAt: new Date().toISOString(),
    wilayaCount: wilayaList.length,
    communeCount: communeList.length,
    sources: SOURCES,
    notes: [
      'Découpage à 69 wilayas : loi n° 26-06 du 4 avril 2026 (JORADP n° 25) ; numéros 59-69 fixés par le décret présidentiel n° 26-206 du 25 mai 2026 (JORADP n° 40).',
      'Transition : les wilayas d\'origine continuent d\'exercer les attributions au profit des nouvelles wilayas jusqu\'au 31 décembre 2026 au plus tard.',
      `"code" = code commune ONS 2021 (Code géographique national), identifiant stable ; ses 2 premiers chiffres = wilaya du découpage à 58 (formerWilayaCode). ${movedCount} communes ont wilayaCode ≠ formerWilayaCode (rattachées aux wilayas 59-69).`,
      'Les communes des wilayas 49-58 (créées en 2019) portent les codes ONS 2021 (49xx-58xx) ; certaines sources plus anciennes utilisent encore les codes ONS 2008 (ex. Timimoun 0109 au lieu de 4901).',
      'NON RÉSOLU : El Borma (3021) laissée en wilaya 30 (Ouargla) comme la base et le code ONS 2021 ; une autre compilation du JORADP (syscli) la place en 55 (Touggourt) depuis la loi 19-12. Texte officiel non vérifié.',
      'Le JORADP n\'a pas pu être consulté directement ; les listes des wilayas 59-69 reposent sur deux compilations concordantes et des sources de presse/encyclopédiques (voir scripts/data-sources/new-wilayas-2026.json).',
      'Présence dans ce référentiel ≠ desserte par un transporteur (ex. Maystro). Les transporteurs peuvent encore utiliser les codes à 58 wilayas pendant la transition (non vérifié).',
    ],
  },
  wilayas: wilayaList,
  communes: communeList,
};

console.log(`wilayas: ${wilayaList.length} (attendu ${EXPECTED_WILAYAS})`);
console.log(`communes: ${communeList.length} (attendu ${EXPECTED_COMMUNES})`);
console.log(`communes rattachées aux wilayas 59-69: ${movedCount}`);
console.log(`contrôle syscli: ${sysAgree} communes au même code concordantes, ${sysDiff.length} écart(s)`);
for (const w of warnings) console.log(`AVERTISSEMENT: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`ERREUR: ${e}`);
  console.error(`${errors.length} erreur(s) — fichier NON écrit.`);
  process.exit(1);
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`écrit: ${OUT}`);
