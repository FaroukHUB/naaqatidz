# Naaqati — site e-commerce

Site en français pour Naaqati (produits du Sahara) : boutique publique pour les particuliers en Algérie (sans compte,
paiement à la livraison), espace revendeur authentifié avec tarification selon le pays de résidence validé,
administration accessible depuis un ordinateur ou un téléphone.

Déploiement : https://naaqati-phi.vercel.app — projet Vercel `naaqati` (branche de production :
`claude/relaxed-bardeen-x4m1xa`, fonctions à Paris `cdg1`), projet Supabase `naaqati` (eu-west-3),
projet Sanity `Naaqati` (`u1f8tdc6`, dataset public `production`, Studio sur `/studio`). Pour finir le schéma de production, exécuter une fois `supabase/manuel/terminer-schema-production.sql`
dans Supabase → SQL Editor. Aucune commande n'est transmise à un service externe.

## Architecture

| Couche | Technologie (versions vérifiées sur le registre npm le 20/10/2026) |
|---|---|
| Application | Next.js 16.4.2 (App Router, `proxy.ts`), React 19.3.1, TypeScript 6.0.3 |
| Styles | Tailwind CSS 4.3.3 — variables de thème issues de la palette fournie (`src/app/globals.css`) |
| Catalogue et contenus | Sanity 6.20 + next-sanity 13.3.4, Studio intégré sur `/studio`, interface en français |
| Données privées | Supabase Postgres (migrations SQL versionnées, RLS) + Supabase Auth (`@supabase/ssr` 0.12.7) |
| Validation | zod 4 ; tests : vitest 5 |

TypeScript 6.0.3 (et non 7.0) et ESLint 9.39 (et non 10) : ce sont les versions les plus récentes compatibles avec
`typescript-eslint` (`<6.1`) et les plugins de `eslint-config-next` 16.4.2.

```
Navigateur ──(SKU + quantités + adresse)──► Next.js (serveur)
                                             ├── Sanity (publié, sans jeton) : produits, SKU, prix publics DZD, poids, textes
                                             ├── Supabase (clé secrète, serveur) : paramètres, livraison, tarifs France,
                                             │      création atomique des commandes (fonction create_order)
                                             └── Supabase (session utilisateur + RLS) : espace revendeur, administration
```

- `src/lib/domain/` : règles métier **pures et testées** (panier, tarification, colisage, livraison, devis).
- `src/lib/server/orders.ts` : validation stricte des requêtes, recalcul serveur, création de commande.
- `supabase/migrations/` : schéma, RLS, fonctions. `supabase/seed.sql` : données **fictives** pour le local uniquement.
- `sanity/` : schémas et structure du Studio. `src/data/algeria-geo.json` : référentiel des wilayas et communes.

### Répartition des données

| Sanity (dataset public) | Supabase (privé) |
|---|---|
| Produits, variantes, **SKU**, catégories et ordre | Comptes, profils, pays de résidence validé |
| Prix publics DZD, poids d'expédition, vente activée/archivage | Tarifs revendeurs France et devise |
| Images, textes, pages, coordonnées, SEO | Commandes, lignes (instantanés), plans de colisage, suivis, historique |
| | Paramètres commerciaux, livraison (zones, destinations, tarifs) |

Le **SKU** est l'identifiant stable entre les deux. Aucune donnée personnelle ni aucun tarif confidentiel n'est dans Sanity.

## Exigences confirmées et choix techniques

**Exigences de la cliente (appliquées telles quelles)** : particuliers en Algérie sans compte, DZD, paiement à la livraison,
5 pièces maximum par SKU (cumulé) ; revendeur Algérie = prix publics, sans limite, colisage 10 unités/SKU et 10 kg par carton,
expédition Maystro ; revendeur France = tarifs spécifiques non dérivés des prix algériens ; statuts de commande demandés.

**Choix techniques proposés (réversibles, documentés)** :
- Comptes revendeurs créés par l'administration, pays et profil tarifaire validés par elle ; inscription publique désactivée.
- Profil tarifaire déduit du pays validé ; le navigateur ne peut transmettre ni profil, ni canal, ni prix (schémas stricts).
- Montants en entiers (centimes). Référence de commande `NQ-AAMMJJ-XXXXXXXX` non séquentielle.
- Confirmation particulier lisible uniquement avec un jeton (cookie httpOnly, 30 jours) ; la référence seule ne donne accès à rien.
- Idempotence : clé générée par le navigateur + contrainte unique ; anti-abus : champ piège + limitation de débit (IP hachée).
- Colisage : heuristique déterministe « first-fit decreasing » (`ffd-v1`), borne inférieure calculée ; minimal prouvé seulement si atteint.
- Livraison : aucun tarif ni destination par défaut ; facturation par commande, par carton ou par tranches de poids.
- Commandes France fermées tant que devise, paiement, expédition et mode de frais ne sont pas renseignés (contrôle en base).
- Produit en « présentation uniquement » (ex. lait de chamelle) : visible, non commandable.

## Installation

Prérequis : Node.js ≥ 22.12.

```bash
npm install
cp .env.example .env.local   # puis renseigner les variables (aucun secret dans le dépôt)
npm run dev                  # sans Sanity : catalogue de démonstration (dev uniquement)
```

### Supabase

1. Créer un projet (région proche de l'Algérie, ex. Europe).
2. Appliquer les migrations : `npx supabase link --project-ref <ref>` puis `npx supabase db push`.
   **Ne pas exécuter `supabase/seed.sql` en production** (valeurs fictives).
3. Auth : désactiver les inscriptions publiques ; URL du site = `NEXT_PUBLIC_SITE_URL` ; ajouter
   `<site>/auth/confirm` aux URL de redirection ; configurer un SMTP pour les emails de réinitialisation.
4. Clés : « publishable » → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, « secret » → `SUPABASE_SECRET_KEY` (serveur uniquement).
5. Premier administrateur : créer l'utilisateur (Dashboard → Authentication → Add user), puis dans l'éditeur SQL :
   ```sql
   update public.profiles set role = 'admin', status = 'active' where email = 'adresse@exemple.com';
   ```

### Sanity

1. Créer un projet (sanity.io/manage), dataset `production` **public** (il ne contient que du contenu public).
2. Renseigner `NEXT_PUBLIC_SANITY_PROJECT_ID` / `NEXT_PUBLIC_SANITY_DATASET`.
3. Ajouter l'origine du site aux CORS avec identifiants (`npx sanity cors add https://… --credentials`) pour `/studio`.
4. Webhook (publication → `POST <site>/api/revalidate`, secret = `SANITY_REVALIDATE_SECRET`).
5. Inviter la cliente comme membre du projet (éditrice).

### Autres variables

`ORDER_TOKEN_SECRET` (≥ 32 caractères aléatoires), `NEXT_PUBLIC_SITE_URL`.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Développement / build / serveur de production |
| `npm run typecheck`, `npm run lint` | Contrôles statiques |
| `npm test`, `npm run test:db` | Tests métier / tests base de données (voir `docs/tests.md`) |
| `npm run check:secrets` | Après build : pas de secret dans le JavaScript public |
| `npm run geo:build` | Régénère le référentiel géographique (`docs/referentiel-geographique.md`) |

## État

**Fonctionnel et testé** (pile locale réelle : Postgres Supabase, Supabase Auth, PostgREST) : catalogue, fiches, variantes,
panier, commande particulière avec confirmation, limites, devis serveur, livraison configurable, espace revendeur DZ/FR,
colisage enregistré et ajustable, historique revendeur, administration (commandes, statuts, paiement, suivi, export CSV,
revendeurs, tarifs France, livraison, paramètres), SEO (métadonnées, canonicals, sitemap, robots, JSON-LD), RLS.

**Nécessite une configuration réelle** : projets Sanity et Supabase, SMTP (mot de passe oublié), webhook Sanity,
hébergement. **Non réalisé** : API Maystro (accès et documentation absents) — voir `docs/livraison-et-maystro.md`.

## Informations à obtenir avant la mise en production

- Polices confirmées (le document fourni indique des polices « proches, non confirmées ») ; logo carré pour l'icône du site.
- Photographies ; catalogue réel : produits, SKU, prix publics, **poids d'expédition**.
- Tare des cartons et marge de protection.
- Destinations desservies et tarifs de livraison Algérie ; transporteur des particuliers.
- Tarifs revendeurs France, devise, conditions de paiement et d'expédition France.
- Accès et documentation API Maystro, format d'import éventuel.
- Coordonnées, mentions légales, CGV, politique de confidentialité, conditions de livraison et de retour.
- Validation du texte « À propos » (`docs/a-propos.md`).
- Conditions de vente et d'expédition du lait de chamelle.

## Limites connues

- Colisage : contraintes de quantité et de poids uniquement (ni volume, ni fragilité) ; heuristique, pas d'optimum garanti.
- Référentiel géographique : quelques points signalés comme incertains (`docs/referentiel-geographique.md`).
- La limitation de débit repose sur l'IP transmise par l'hébergeur (`x-forwarded-for`).
- `npm audit` signale des vulnérabilités modérées/hautes dans des dépendances internes de `sanity` (outillage du Studio) ;
  le correctif proposé rétrograde Sanity. À suivre lors des mises à jour.
- Pas de gestion de stock ni de comptabilité (non demandées).

## Documentation

- `docs/guide-cliente.md` — guide d'utilisation pour la cliente
- `docs/a-propos.md` — texte source et version proposée (à valider)
- `docs/livraison-et-maystro.md` — livraison manuelle et plan d'intégration Maystro
- `docs/referentiel-geographique.md` — provenance des wilayas/communes
- `docs/tests.md` — vérifications et résultats
