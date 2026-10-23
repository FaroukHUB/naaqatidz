# Guide d'utilisation — administration du site Naaqati

Deux outils, reliés entre eux par des liens :

| Je veux… | Où ? |
|---|---|
| Ajouter, modifier ou archiver un produit, ses photos, ses textes | **Sanity Studio** — `/studio` |
| Gérer les variantes, les SKU, le prix public en DZD, le poids d'expédition | **Sanity Studio** — fiche produit, onglet « Vente et prix » |
| Activer ou désactiver la vente d'une référence | **Sanity Studio** — case « Vente activée » |
| Gérer les catégories et leur ordre | **Sanity Studio** — Catégories (champ « Ordre d'affichage ») |
| Modifier l'accueil, la page « À propos », les coordonnées, les pages d'information | **Sanity Studio** |
| Voir et traiter les commandes, changer un statut, saisir un suivi, voir les cartons | **Tableau de bord** — `/admin` → Commandes |
| Créer un compte revendeur, valider son pays, le suspendre | **Tableau de bord** → Revendeurs |
| Saisir les tarifs revendeurs France | **Tableau de bord** → Tarifs France |
| Choisir les wilayas desservies, les zones, les tarifs de livraison | **Tableau de bord** → Livraison |
| Tare des cartons, conditions France, règles commerciales | **Tableau de bord** → Paramètres |

Dans le Studio, l'onglet « Commandes & revendeurs » ouvre le tableau de bord ; dans le tableau de bord,
le bouton « Catalogue & contenus (Sanity Studio) » ouvre le Studio.

## Vidéo d'en-tête de la page d'accueil

Studio → **Page d'accueil** :
1. **Vidéo d'en-tête — ordinateur** : vidéo paysage (16:9), MP4, sans son, idéalement moins de 8 Mo.
   Le texte et les boutons s'affichent à gauche : gardez le côté gauche de l'image dégagé.
2. **Vidéo d'en-tête — téléphone** : vidéo portrait (9:16), MP4, idéalement moins de 5 Mo ; le texte s'affiche en bas.
   Si elle est vide, la vidéo ordinateur est affichée en entier (16:9) avec le texte dessous. Ne mettez ici qu'une vidéo verticale.
3. **Image d'attente** : une image tirée de la vidéo, affichée pendant le chargement (et pour les visiteurs qui
   ont désactivé les animations).
4. **Titre principal**, **Texte d'introduction**, **Bouton principal** (texte + lien, ex. `/boutique`) et
   **second bouton** facultatif.
5. Cliquez sur **Publier**.

**Photo sur ordinateur, vidéo sur téléphone** : remplissez **Photo d'en-tête — ordinateur** (16:9 conseillé, côté
gauche dégagé). La photo remplace alors la vidéo sur ordinateur ; le téléphone garde la vidéo.

Sans vidéo, l'ancien en-tête illustré reste affiché.

## Produits

- **Produit sans variante** : renseignez SKU, prix public (DZD), poids d'expédition, puis publiez.
- **Produit avec variantes** : cochez « Ce produit a plusieurs variantes », puis ajoutez une ligne par variante
  (nom, SKU, prix, poids).
- **SKU** : identifiant unique (ex. `SAV-ASLI-100`). Ne le changez plus une fois la référence commandée :
  il relie le catalogue, les tarifs France et les commandes.
- **Poids d'expédition** : poids réel du produit **avec son emballage individuel**, en grammes. Ce n'est ni la contenance (ml)
  ni le poids net. Sans ce poids, les commandes revendeurs Algérie sont bloquées.
- **Ne supprimez pas** un produit déjà commandé : cochez « Archivé ». Il disparaît du site, l'historique est conservé.
- **Présentation uniquement** : pour un produit visible mais non commandable (par exemple le lait de chamelle,
  tant que ses conditions de vente et d'expédition ne sont pas définies).
- Chaque photo doit avoir une description (texte alternatif).
- Modifier un prix ne change jamais les commandes déjà passées.

## Commandes

1. Tableau de bord → Commandes (recherche par référence, nom ou téléphone ; filtres par statut, parcours, dates).
2. Ouvrez une commande : articles, client, adresse, cartons.
3. Changez le statut : Nouvelle → Confirmée → En préparation → Expédiée → Livrée (ou Annulée / Retournée).
   Le **statut de paiement** est distinct : une commande payée à la livraison reste « À encaisser » jusqu'à l'encaissement.
4. Si la livraison était « à confirmer », saisissez le montant : le total est recalculé.
5. Ajoutez les références de suivi (une par colis si besoin).
6. « Exporter (CSV) » produit un fichier de préparation (format générique, pas le format d'import Maystro).

## Administrateurs

**Administration → Administrateurs** : saisissez l'email (et le nom), cliquez sur « Ajouter l'administrateur ».
Le compte est actif tout de suite ; un message avec l'adresse de connexion, l'email et le mot de passe s'affiche
(« Copier le message » ou « Envoyer par WhatsApp »). « Retirer l'accès » bloque un administrateur sans le supprimer.

## Revendeurs

Tout se fait dans **Administration → Revendeurs** (`/admin/revendeurs`), sans passer par Supabase :

1. Remplissez **« Ajouter un revendeur »** : email, pays (Algérie ou France), nom, boutique, téléphone et,
   si vous la connaissez, son adresse de livraison (elle sera pré-remplie dans son panier).
   Laissez le mot de passe vide pour qu'il soit créé automatiquement.
2. Cliquez sur **« Créer le compte »** : le compte est **actif immédiatement**.
3. Un message prêt à envoyer s'affiche (adresse du site, email, mot de passe) : **« Copier le message »** ou
   **« Envoyer par WhatsApp »**. Il reste affiché 30 minutes.
4. Mot de passe oublié ou perdu : ouvrez le revendeur (« Gérer ») → **« Créer un nouveau mot de passe »**.
5. Pour bloquer un revendeur : « Gérer » → Accès au site : **Suspendu**.

Après chaque commande, l'adresse utilisée est mémorisée : le revendeur n'a plus à la retaper.

Le pays choisi détermine les prix : Algérie = prix publics DZD ; France = tarifs du menu « Tarifs France ».

## Avant l'ouverture

La page d'accueil du tableau de bord affiche une liste « Configuration avant mise en vente » (pastilles rouges / vertes).
