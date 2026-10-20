# Livraison en Algérie et Maystro

## Ce qui fonctionne aujourd'hui (sans API)

- Adresse structurée : wilaya (69) + commune (1 541), contrôle que la commune appartient à la wilaya.
- Desserte configurable : rien n'est desservi par défaut. Activation par wilaya, exceptions par commune
  (desservie / non desservie / autre zone).
- Zones tarifaires, modes de livraison (par parcours : particuliers, revendeurs Algérie) et tarifs par mode × zone.
- Modes de facturation : **par commande**, **par carton** (revendeurs, d'après le colisage) ou **par tranches de poids**.
  Aucun mode n'est imposé : à choisir selon les conditions réelles du transporteur.
- Sans tarif applicable : commande refusée (par défaut) ou, si l'option est activée dans les paramètres,
  livraison « à confirmer » et total affiché « hors livraison ». La livraison n'est jamais présentée comme gratuite.
- Commandes et cartons consultables dans l'administration ; ajustement manuel du colisage avec revalidation.
- **Export CSV générique** (une ligne par article et par carton). Ce format n'est **pas** le format d'import Maystro :
  ce dernier n'a pas été obtenu ni vérifié.
- Saisie manuelle des références de suivi (par colis) et des statuts.

Le transporteur des particuliers n'a pas été confirmé : aucun transporteur n'est imposé à ce parcours.
Les règles de colisage (10 unités d'une référence et 10 kg par carton) sont des **règles de la cliente**,
pas des conditions Maystro vérifiées.

## Code

- `src/lib/domain/shipping.ts` : résolution de la zone et calcul du tarif (fonctions pures, testées).
- `src/lib/domain/packing.ts` : colisage.
- `src/lib/carriers/types.ts` : interface transporteur ; seul l'adaptateur « manuel » existe.

## Connexion API Maystro (à faire lorsque les accès et la documentation seront fournis)

Maystro annonce une intégration par API (https://maystro-delivery.com/integration.html), mais cela ne fournit
ni accès, ni endpoints, ni conditions de compte. **Aucun endpoint n'a été supposé dans le code.**

Liste de vérification :

1. Authentification (type de clé, environnement de test, rotation) — clé en variable d'environnement serveur uniquement.
2. Correspondance des codes de destination : le référentiel du site utilise les 69 wilayas (2026) et les codes
   communes ONS. Vérifier si Maystro utilise encore les 58 wilayas ou ses propres identifiants
   (le référentiel conserve `formerWilayaCode` pour faciliter ce mapping).
3. Gestion de plusieurs colis pour une même commande.
4. Contre-remboursement : pour une commande en plusieurs colis, appliquer le mécanisme réellement prévu par Maystro.
   **Le total à encaisser ne doit jamais être reproduit sur chaque colis.**
5. Idempotence : ne jamais créer deux fois une expédition (clé référence + carton ; colonne `order_shipments.external_id` unique).
6. Erreurs et nouvelles tentatives (délais, erreurs temporaires, journalisation sans données personnelles).
7. Conservation des références de suivi dans `order_shipments`.
8. Tests uniquement en environnement de test Maystro ; **aucune commande réelle envoyée sans instruction explicite.**
