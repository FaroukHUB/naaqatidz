# Référentiel géographique Algérie (wilayas et communes)

Ce fichier documente `src/data/algeria-geo.json`, le référentiel des wilayas et des communes utilisé par le formulaire d'adresse de livraison. Il décrit l'état du découpage au **20 octobre 2026**.

## En bref

| | Valeur |
|---|---|
| Wilayas | **69** (codes `01` à `69`) |
| Communes | **1541** |
| Communes rattachées aux nouvelles wilayas 59-69 | 108 |
| Généré par | `node scripts/build-algeria-geo.mjs` (Node, ESM, sans dépendance) |
| Date de collecte des sources | 2026-10-20 |

## Cadre légal

- **Loi n° 26-06 du 4 avril 2026** relative à l'organisation territoriale (JORADP n° 25 du 5 avril 2026). Elle porte le pays de 58 à 69 wilayas, avec 1541 communes. Elle modifie la loi 84-09 : articles 52 bis 10 et suivants.
- **Décret présidentiel n° 26-206 du 25 mai 2026** (JORADP n° 40). Il fixe les noms, numéros (59 à 69) et chefs-lieux des 11 nouvelles wilayas.
- **Transition** : les wilayas d'origine continuent d'exercer les attributions des nouvelles wilayas jusqu'à leur installation, au plus tard le **31 décembre 2026**.
- Un décret 26-253 a ensuite réorganisé certaines daïras des nouvelles wilayas, d'après geoalgeria. Ce point ne concerne pas ce référentiel, qui ne contient pas les daïras.

| Code | Wilaya | Arabe | Wilaya d'origine | Communes |
|---|---|---|---|---|
| 59 | Aflou | أفلو | 03 Laghouat | 12 |
| 60 | Barika | بريكة | 05 Batna | 8 |
| 61 | El Kantara | القنطرة | 07 Biskra | 5 |
| 62 | Bir El Ater | بئر العاتر | 12 Tébessa | 4 |
| 63 | El Aricha | العريشة | 13 Tlemcen | 4 |
| 64 | Ksar Chellala | قصر الشلالة | 14 Tiaret | 6 |
| 65 | Aïn Ouessara | عين وسارة | 17 Djelfa | 10 |
| 66 | Messaad | مسعد | 17 Djelfa | 8 |
| 67 | Ksar El Boukhari | قصر البخاري | 26 Médéa | 21 |
| 68 | Bou Saâda | بوسعادة | 28 M'Sila | 23 |
| 69 | El Abiodh Sidi Cheikh | الأبيض سيدي الشيخ | 32 El Bayadh | 7 |

## Provenance

Tous les fichiers sources sont dans `scripts/data-sources/` et ont été téléchargés le **2026-10-20**.

### 1. Base : geoalgeria (Yasser's Studio)

- URL : https://raw.githubusercontent.com/yasserstudio/geoalgeria/ce8083dd18e5b77bd2c48790f3874aaa34ffbdee/packages/dataset/data/algeria.json
- Dépôt : https://github.com/yasserstudio/geoalgeria, commit `ce8083dd18e5b77bd2c48790f3874aaa34ffbdee`. Le fichier est identique octet pour octet à celui du paquet npm `geoalgeria@2.3.0`.
- Fichier local : `geoalgeria-algeria.json` (sha256 `85c2fff24566fc1631260e2ef38e1abaa04f08f57fb468bc6635c1ae42ba0fa4`).
- Licence : **MIT** pour la compilation des noms et des codes administratifs, qui est la seule partie utilisée ici. Les coordonnées et identifiants issus d'OpenStreetMap sont sous ODbL et ne sont **pas** repris. Le texte complet est dans `geoalgeria-LICENSE.txt` et `geoalgeria-NOTICE.txt`.
- Ce qu'on en tire :
  - les noms FR et AR des wilayas et des communes ;
  - les codes communes à 4 chiffres, tirés du *Code géographique national ONS 2021* selon le projet ;
  - le rattachement des communes aux 69 wilayas.

### 2. Contrôle croisé : syscli/algeria

- URLs :
  - https://raw.githubusercontent.com/syscli/algeria/7789ea926e7c0751f33775ecf558fa026e2ee81b/data/communes.csv
  - https://raw.githubusercontent.com/syscli/algeria/7789ea926e7c0751f33775ecf558fa026e2ee81b/data/wilayas.csv
- Commit : `7789ea926e7c0751f33775ecf558fa026e2ee81b`. Licence : **MIT** (`syscli-LICENSE.txt`).
- Il s'agit d'une transcription indépendante du JORADP : lois 84-09 et 19-12, ordonnance 97-14, loi 26-06, décrets 84-79, 21-117 et 26-206. Elle sert **uniquement à vérifier** les rattachements et les comptes par wilaya ; le script échoue en cas d'écart non documenté.

### 3. Overrides manuels : `scripts/data-sources/new-wilayas-2026.json`

Ce fichier contient, pour chacune des wilayas 59 à 69 :
- le code, le nom FR et AR, et la wilaya d'origine ;
- le chef-lieu ;
- la liste des codes communes ;
- un statut et les URL des sources consultées.

Ces sources sont la presse et des sites de référence :
- El Moudjahid, Express DZ, algerie-eco, Ennahar ;
- dzbuild, upgrowth.dz ;
- le projet de loi publié par le Conseil de la Nation ;
- Wikipédia.

Le script applique ces overrides par-dessus la base et vérifie leur cohérence.

### 4. Sources écartées

- `othmanus/algeria-cities` (https://github.com/othmanus/algeria-cities, commit `e42fcae`) : il ne contient pas de code ONS (seulement un identifiant séquentiel), pas de fichier de licence, et seulement 58 wilayas.
- `algeria-wilayas-communes` (npm) : il n'a pas de code commune ONS.

## Méthode

1. Charger la base geoalgeria : 69 wilayas et 1541 communes, chaque code commune étant unique.
2. Appliquer `new-wilayas-2026.json`. Pour chaque wilaya 59-69, le nom FR/AR et `formerCode` viennent de l'override, et chaque commune listée est rattachée à cette wilaya. Le script échoue dans trois cas :
   - une commune listée est absente de la base ;
   - un préfixe de code ne correspond pas à la wilaya d'origine ;
   - une commune se trouve en wilaya 59-69 sans figurer dans un override.
3. Croiser avec syscli. Le rattachement est identique pour **1481** communes qui ont le même code dans les deux jeux. Les 59 autres communes appartiennent aux wilayas 49-58 et syscli les code à l'ancienne (voir plus bas) ; pour elles, on compare le nombre de communes par wilaya. Le seul écart est El Borma (voir « Points non résolus »).
4. Vérifier les totaux (69 et 1541), puis écrire le fichier trié par code de wilaya, puis par nom FR de commune (collation `fr`).

Les **108 communes** des wilayas 59-69 sont **identiques** dans les deux compilations indépendantes. Chaque liste a aussi été recoupée avec au moins une source de presse ou encyclopédique.

## Format de `src/data/algeria-geo.json`

```jsonc
{
  "meta": { "generatedAt": "...", "wilayaCount": 69, "communeCount": 1541, "sources": [...], "notes": [...] },
  "wilayas":  [ { "code": "60", "nameFr": "Barika", "nameAr": "بريكة", "formerCode": "05" } ],
  "communes": [ { "code": "0542", "nameFr": "Barika", "nameAr": "بريكة", "wilayaCode": "60", "formerWilayaCode": "05" } ]
}
```

- `wilayas[].formerCode` : la wilaya d'origine pour les wilayas 59-69, `null` pour les autres.
- `communes[].code` : le code ONS 2021 à 4 chiffres, sous forme de chaîne avec zéro initial. C'est l'**identifiant stable** à stocker dans les commandes.
- `communes[].wilayaCode` : la wilaya actuelle, dans le découpage à 69.
- `communes[].formerWilayaCode` : la wilaya dans le découpage à 58. Elle est égale aux 2 premiers chiffres du code.

## Limites connues et points non résolus

- **Texte officiel non lu directement.** Le site joradp.dz était inaccessible depuis l'environnement de collecte (proxy et DNS). Les listes reposent sur deux compilations concordantes qui déclarent s'appuyer sur le JORADP n° 25, et sur des sources secondaires. À faire : comparer avec `F2026025.pdf` et `F2026040.pdf`.
- **El Borma (3021) : rattachement non résolu.** La commune est laissée en **30 Ouargla**, comme dans la base, ce qui est cohérent avec son code ONS 2021 en `30xx` et avec la page Wikipédia FR (Touggourt = 13 communes). Mais syscli, qui cite la loi 19-12, et la page Wikipédia EN (Touggourt = 14 communes, 6 daïras) la placent en **55 Touggourt**. Ce point n'est pas lié à la réforme de 2026. Il faut vérifier dans le JORADP 2019 n° 78.
- **Wilayas 65 (Aïn Ouessara), 66 (Messaad) et 69 (El Abiodh Sidi Cheikh) : sources plus faibles.** En dehors des deux jeux de données, une seule source secondaire a été trouvée, ou bien seul le nombre de communes a pu être confirmé.
- **Codes des communes des wilayas 49-58** (créées en 2019) : le référentiel utilise les codes ONS 2021 (par exemple Timimoun `4901`). Des sources plus anciennes, dont syscli, utilisent encore les codes ONS 2008 (Timimoun `0109`). C'est à prendre en compte si un partenaire envoie des codes.
- **Graphies.** Les noms FR de la base sont souvent sans accents (« Ain Benian »). Les graphies varient d'une source à l'autre : Aïn Ouessara ou Aïn Oussera, M'Doukal ou Amdoukal, etc. Pour la recherche, il faut normaliser (accents, tirets, apostrophes).
- **Pas de daïras ni de codes postaux** dans ce référentiel.

## Avertissements pour la livraison

- **Être présent dans ce référentiel ne signifie pas qu'un transporteur dessert la destination.** Que Maystro (ou un autre transporteur) desserve une commune, et à quel tarif, dépend de sa propre liste. Il faut la vérifier séparément, idéalement via son API ou sa grille tarifaire.
- **Pendant la transition, et peut-être au-delà du 31/12/2026, les transporteurs peuvent encore utiliser les codes du découpage à 58 wilayas** (par exemple Bou Saâda toujours en 28 M'Sila). Cela n'a **pas été vérifié** pour Maystro. Le champ `formerWilayaCode` sert à faire cette correspondance.

## Mise à jour

1. Vérifier s'il y a un nouveau texte au JORADP : création ou rattachement de communes, renommages, codes ONS.
2. Mettre à jour la base si nécessaire :
   ```sh
   git ls-remote https://github.com/yasserstudio/geoalgeria HEAD   # nouveau SHA
   curl -sSf -o scripts/data-sources/geoalgeria-algeria.json \
     https://raw.githubusercontent.com/yasserstudio/geoalgeria/<SHA>/packages/dataset/data/algeria.json
   ```
   Faire de même pour `syscli/algeria` (`data/communes.csv` et `data/wilayas.csv`). Reporter ensuite les nouveaux SHA et dates dans `SOURCES` de `scripts/build-algeria-geo.mjs` et dans ce document.
3. Modifier `scripts/data-sources/new-wilayas-2026.json` en ajoutant les URL des sources. Un point tranché passe de `unresolved` à un override explicite.
4. Lancer `node scripts/build-algeria-geo.mjs` depuis la racine. Le script s'arrête avec un code non nul, sans écrire, en cas d'incohérence : totaux, doublons, override invalide ou écart non documenté avec syscli.
5. Relire le diff de `src/data/algeria-geo.json`. Les codes communes ne doivent jamais être réattribués, car des commandes existantes peuvent les référencer.
