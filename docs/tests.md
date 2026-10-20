# Vérifications et tests

## Commandes

```bash
npm run typecheck        # TypeScript
npm run lint             # ESLint (eslint-config-next)
npm test                 # tests métier (vitest, sans base de données)
npm run test:db          # tests d'intégration sur un vrai PostgreSQL (voir ci-dessous)
npm run build            # build de production
npm run check:secrets    # après le build : aucun secret ni code d'accès privé dans .next/static
```

### Tests base de données

Ils appliquent **toutes** les migrations de `supabase/migrations` puis vérifient la RLS, l'atomicité et l'idempotence.

- Sur un PostgreSQL nu (≥ 15) : une émulation minimale de Supabase est chargée (`tests/db/supabase-stub.sql`).
  `TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres npm run test:db` (crée une base `naaqati_test_orders`).
- Sur l'image officielle Supabase (recommandé, vrai schéma `auth` et vrais rôles), dans un conteneur **vierge** :
  ```bash
  docker run -d --name nq-pg -e POSTGRES_PASSWORD=postgres -p 127.0.0.1:54330:5432 supabase/postgres:17.11.0.004
  TEST_DB_IN_PLACE=1 TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54330/postgres npm run test:db
  ```

### Tests de bout en bout (navigateur)

1. Pile locale : `npx supabase start` (méthode standard), ou `scripts/local-stack/start.sh` si les images
   Docker d'Auth/PostgREST ne sont pas téléchargeables (binaires officiels Supabase Auth v2.197.0 et PostgREST v12.2.3).
2. `.env.local` avec les clés affichées, puis `npm run dev` (Sanity non configuré → catalogue de démonstration).
3. `cd scripts/local-stack && npm install && node e2e.mjs` (Chromium requis, `CHROMIUM_PATH` si besoin).

Les comptes de test (`*@test.local`) et les données de `supabase/seed.sql` sont **fictifs** et réservés au local.

## Résultats obtenus le 20/10/2026

| Contrôle | Résultat |
|---|---|
| TypeScript | OK |
| ESLint | OK |
| Tests métier | 36/36 |
| Tests base (PostgreSQL 16 + émulation) | 24/24 |
| Tests base (image officielle `supabase/postgres:17.11.0.004`) | 24/24 |
| Build de production Next.js | OK |
| Absence de secrets dans le JS public | OK (233 fichiers) |
| Scénarios navigateur (Supabase Auth + PostgREST réels, catalogue de démo) | 28/28 |
| Appels API de bout en bout (devis, commande, double soumission ×5, champs injectés) | OK |

### Correspondance avec les vérifications demandées

| Exigence | Où c'est testé |
|---|---|
| Commande particulière sans compte | `tests/db` « commande particulière… », E2E « Commande particulière sans compte confirmée » |
| Blocage > 5 unités du même SKU, y compris sur plusieurs lignes | `tests/unit/pricing-quote`, `tests/db`, appel API (422) |
| Revendeur Algérie : prix publics et > 5 unités | `tests/unit` « revendeur Algérie », `tests/db`, E2E (25 + 12 unités) |
| Tarifs France inaccessibles sans autorisation | `tests/db` RLS (anon, revendeur DZ, compte en attente), E2E (HTML DZ et page publique) |
| Impossible de choisir son profil tarifaire dans une requête | `tests/db` (champs inconnus refusés, 403 sur un autre profil), appel API (400) |
| Colisage par quantité et par poids, poids exact à la limite, unité trop lourde, lignes répétées | `tests/unit/packing.test.ts` (dont 300 paniers aléatoires) |
| Poids manquant, tare non configurée | `tests/unit/packing`, `tests/unit/pricing-quote` |
| Livraison non configurée | `tests/unit/pricing-quote` (refus ; option « à confirmer » avec total provisoire) |
| Total recalculé côté serveur | `tests/db` (prix client ignorés / refusés), contrainte SQL `total_consistent` |
| Double clic → une seule commande | `tests/db` (5 soumissions simultanées), appel API ×5, E2E (double-clic réel) |
| Un revendeur ne voit pas les commandes d'un autre | `tests/db` RLS, E2E (page introuvable, aucune donnée) |
| Historique inchangé après modification du catalogue | `tests/db` « historique inchangé », trigger `orders_guard` |
| Absence de secret dans le code client | `npm run check:secrets` |

Note : une commande d'un autre revendeur affiche la page « introuvable » sans aucune donnée ; le code HTTP est 200
car la page est rendue en streaming (comportement de Next.js), l'accès étant refusé par la RLS.
