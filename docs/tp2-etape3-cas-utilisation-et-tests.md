# TP 2, étape 3 : le cas d'utilisation, son test et la règle de dépendance

**Consigne :** écrire le cas d'utilisation et son test, avec des adaptateurs en mémoire (sans base ni
réseau), puis écrire le test de la règle de dépendance : le centre n'importe aucune technique.

| Fichier | Contenu | Lignes |
|---|---|---|
| `urbanhub-trafic/src/service.ts` | le cas d'utilisation `SurveillanceTrafic` | 40 |
| `urbanhub-trafic/src/adaptateurs/depotMemoire.ts` | `DepotRelevesEnMemoire` | 16 |
| `urbanhub-trafic/src/adaptateurs/referentielMemoire.ts` | `ReferentielTronconsEnMemoire` | 15 |
| `urbanhub-trafic/src/adaptateurs/etatsMemoire.ts` | `EtatsTronconsEnMemoire` | 14 |
| `test/trafic.test.ts` | 7 tests du cas d'utilisation | 86 |
| `test/regleDependanceTrafic.test.ts` | la règle de dépendance | 39 |

**Résultat :** `npm test` passe **37 / 37** (25 avant cette étape, plus 12 nouveaux tests). Aucun
fichier existant n'a été modifié.

---

## 1. Le cas d'utilisation (`service.ts`)

`SurveillanceTrafic` implémente le port primaire `RecevoirReleve`. Son constructeur ne reçoit que des
**ports** :

```ts
  constructor(depot: DepotReleves, referentiel: ReferentielTroncons,
    etats: EtatsTroncons, publicateur: PublicateurSignalements) {
```

Ce que fait `executer(releve)`, dans l'ordre :

1. **Trouver le tronçon** dans le référentiel. S'il est inconnu, lever `TronconInconnu` **avant**
   de ranger le relevé.
2. **Ranger le relevé** dans le dépôt.
3. **Relire la fenêtre** : `depot.entre(troncon, debutFenetre(h), h)`, c'est-à-dire les 15 dernières
   minutes, bornes incluses.
4. **Calculer le nouvel état** : `etatSelon(vitesseMoyenne(fenetre), troncon)`.
5. **Si l'état ne change pas, s'arrêter.** C'est ce qui garantit « une seule fois par épisode ».
6. **S'il passe à congestionné, publier le signalement.**
7. **Enregistrer le nouvel état, après la publication.**

### Le choix important : l'état change après la publication

```ts
    // l'etat change APRES la publication : si elle echoue, le prochain releve retentera
    this.#etats.changer(releve.troncon, nouvel);
```

Si on marquait « congestionné » **avant** de publier, une panne du réseau ferait perdre le
signalement pour toujours. Le tronçon serait noté comme déjà signalé, alors que personne n'a été
prévenu.

Dans notre ordre, une panne laisse l'état à « fluide ». L'erreur remonte, sans être avalée, et le
relevé suivant retente la publication. Le dernier test le vérifie.

Le prix : si la publication réussit mais que `changer()` échoue, le signalement peut partir deux
fois. C'est pour cela que le signalement porte un `identifiant`
(`boulevard-voltaire-3:2026-11-18T08:10:00`), qui permet au destinataire d'ignorer le doublon, comme
le fait le service Alertes.

---

## 2. Les adaptateurs en mémoire

Il y en a un par port secondaire, sauf le publicateur. Le publicateur est une ligne dans le test : il
retient les signalements dans un tableau, comme dans `surveillance.test.ts`.

| Adaptateur | Port | Comment il fonctionne |
|---|---|---|
| `DepotRelevesEnMemoire` | `DepotReleves` | un tableau ; `entre()` filtre par tronçon et compare les horodatages comme du texte |
| `ReferentielTronconsEnMemoire` | `ReferentielTroncons` | une `Map`, remplie à la construction ; chaque tronçon passe par `troncon()` du domaine, qui le valide |
| `EtatsTronconsEnMemoire` | `EtatsTroncons` | une `Map` ; un tronçon jamais vu est « fluide » |

Ils sont dans `adaptateurs/`, **hors du centre**. Le cas d'utilisation ne les connaît pas : seul le
test les choisit et les assemble.

---

## 3. Le test du cas d'utilisation (`test/trafic.test.ts`)

Deux tronçons servent dans les tests : Voltaire, limité à 50 km/h (seuil à 20 km/h), et Rivoli,
limité à 30 km/h (seuil à 12 km/h).

| # | Test | Ce qu'il protège dans la règle |
|---|---|---|
| 1 | L'exemple chiffré de l'étape 1 donne **un seul** signalement, à 08:10, de moyenne 18,33 | la fenêtre de 15 minutes, la moyenne, « une seule fois » |
| 2 | Une moyenne égale au seuil (20 sur 50) reste fluide | « **sous** 40 % » : le seuil est strict |
| 3 | 15 km/h congestionne Voltaire (limite 50), mais pas Rivoli (limite 30) | « 40 % de **sa** vitesse limite » |
| 4 | Redevenu fluide, un nouvel épisode est signalé de nouveau | « jusqu'à ce que le tronçon redevienne fluide » |
| 5 | Les relevés d'un autre tronçon ne comptent pas | la moyenne est calculée par tronçon |
| 6 | Un tronçon inconnu est refusé, et son relevé n'est pas rangé | la validation, avant tout effet |
| 7 | Si la publication échoue, l'erreur remonte et le relevé suivant retente | aucun signalement perdu, et aucune erreur avalée |

**Durée :** chaque test prend entre **0,2 et 1,9 ms**. Il n'y a ni fichier, ni base, ni port réseau.

---

## 4. Le test de la règle de dépendance (`test/regleDependanceTrafic.test.ts`)

```ts
const INTERDIT = /from\s+["'](node:|\.\.?\/adaptateurs\/)|\bimport\(|\brequire\(|\bfetch\(/;
```

Il est **plus strict** que celui de Qualité de l'air. Celui-ci n'interdisait que `node:sqlite`,
`node:http` et `node:net`. Le nôtre interdit :

- **tout** module Node (`node:fs`, `node:sqlite`...) ;
- tout import d'un adaptateur ;
- les imports dynamiques (`import()`, `require()`) ;
- `fetch()`.

**La liste du centre est lue sur le disque.** Ce sont tous les `.ts` de `urbanhub-trafic/src/`, sauf
le dossier `adaptateurs/` et `principal.ts`, la future racine de composition. Si quelqu'un ajoute un
fichier au centre, il est vérifié **sans modifier le test**. Un premier test s'assure aussi que la
liste contient bien `domaine.ts`, `ports.ts` et `service.ts`, pour qu'une liste vide ne passe pas en
silence.

**Le test se teste lui-même.** « La règle attrape les fautes » vérifie que l'expression rejette 5
exemples de fautes : `node:sqlite`, `node:fs`, un adaptateur, `fetch(` et `import("pg")`.

### L'essai : une vraie faute dans le centre

Nous avons créé un fichier `urbanhub-trafic/src/faute.ts` qui importe `node:sqlite`, puis lancé le
test :

```
ok 2 - trafic/domaine.ts n'importe aucune technique
not ok 3 - trafic/faute.ts n'importe aucune technique
ok 4 - trafic/ports.ts n'importe aucune technique
ok 5 - trafic/service.ts n'importe aucune technique
# pass 5
# fail 1
```

La faute est attrapée **sans avoir ajouté `faute.ts` au test**. Le fichier a ensuite été supprimé.

---

## Ce que cette étape prouve

- **La règle est entièrement testée sans technique.** Sept cas en quelques millisecondes, avant
  même d'avoir choisi une base ou un canal de publication. La base et le canal viendront à
  l'étape 4.
- **Le centre est protégé** par un test qui échoue dès qu'une technique y entre.
