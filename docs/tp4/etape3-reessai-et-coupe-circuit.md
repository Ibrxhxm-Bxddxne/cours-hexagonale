# TP 4, étape 3 : deux Décorateurs, le réessai borné et le coupe-circuit

**Consigne :** ajouter deux Décorateurs, chacun avec son test :
- un réessai borné ;
- puis un coupe-circuit : il s'ouvre après 5 échecs, reste ouvert 30 s, puis laisse passer un
  appel d'essai.

**Où :** côté **Trafic**, autour du port `PublicateurSignalements`. Le cas d'utilisation et le
publicateur HTTP ne changent pas : on les **enveloppe**.

---

## 1. L'assemblage, dans [`principal.ts`](../../urbanhub-trafic/src/principal.ts)

```ts
const publicateur = new PublicateurAvecReessai(          // 3 essais, pauses 0,5 s puis 1 s
  new PublicateurAvecCoupeCircuit(                       // 5 échecs -> ouvert 30 s
    new PublicateurSignalementsHttp(URL_SIGNALEMENTS),   // délai 2 s (étape 2)
    5, 30_000));
```

```
SurveillanceTrafic → Réessai → Coupe-circuit → HTTP (délai 2 s) → réseau → Notifications
```

**L'ordre est celui du cours** (slide 83, comme Resilience4j) : le réessai à l'extérieur, le
coupe-circuit à l'intérieur.

Ainsi, **chaque essai** passe par le coupe-circuit et compte comme un échec. Quand le circuit est
ouvert, le réessai reçoit `CircuitOuvert` et **ne retente pas**.

Dans l'autre ordre, le coupe-circuit ne verrait qu'un échec par relevé, après 7,5 s de réessais.
Il faudrait alors 5 relevés, soit plus de 37 s, avant qu'il s'ouvre.

---

## 2. Le réessai borné : [`reessai.ts`](../../urbanhub-trafic/src/adaptateurs/reessai.ts)

Il existait depuis le TP 2 (étape 5). Il avait **une** borne, le nombre d'essais. Nous lui en
ajoutons **une seconde**, pour ne pas retenter ce qui ne peut pas réussir.

| Borne | Règle | Pourquoi |
|---|---|---|
| **1. Le nombre d'essais** | 3 essais au plus, pauses de 0,5 s puis 1 s ; au dernier, l'erreur **remonte** | au pire 3 × 2 s (délais) + 1,5 s (pauses) = 7,5 s par relevé, jamais plus |
| **2. Ce qui est inutile à retenter** | un `RefusDefinitif` (une réponse 4xx) et un `CircuitOuvert` remontent **au premier essai, sans pause** | Notifications répond **422** à une donnée fausse (étape 2) : la renvoyer trois fois ne la rendra pas juste. Et un circuit ouvert refuse tout pendant 30 s : attendre 1,5 s puis retenter serait du temps perdu |

Pour que le réessai puisse faire la différence, le publicateur HTTP distingue désormais deux cas
([`publicationHttp.ts`](../../urbanhub-trafic/src/adaptateurs/publicationHttp.ts)) :
- un **4xx** lève `RefusDefinitif` : le message est refusé ;
- un **5xx**, un délai dépassé ou une erreur réseau restent des erreurs ordinaires : c'est une
  panne, qu'on peut retenter.

Les deux erreurs sont dans [`erreurs.ts`](../../urbanhub-trafic/src/adaptateurs/erreurs.ts). Ce
sont des erreurs **techniques**, entre adaptateurs : le centre ne les connaît pas.

### Ses tests

| Fichier | Test | Ce qu'il prouve |
|---|---|---|
| [`patronsTrafic.test.ts`](../../test/patronsTrafic.test.ts) (TP 2) | 4 tests | une panne passagère est absorbée ; une panne durable remonte après 3 essais ; les pauses grandissent (500, puis 1 000 ms) |
| [`reessaiTrafic.test.ts`](../../test/reessaiTrafic.test.ts) (**nouveau**) | borne 1 | 3 appels exactement, pauses `[500, 1000]`, puis l'erreur remonte |
| | borne 2 : 422 | **1** appel, **aucune** pause |
| | borne 2 : circuit ouvert | **1** appel, **aucune** pause |
| [`publicationHttpTrafic.test.ts`](../../test/publicationHttpTrafic.test.ts) | **nouveau test** | un vrai serveur qui répond 422 donne un `RefusDefinitif` de statut 422 |

---

## 3. Le coupe-circuit : [`coupeCircuit.ts`](../../urbanhub-trafic/src/adaptateurs/coupeCircuit.ts)

Il est **nouveau**, et a le même port que les autres : `PublicateurSignalements`.

| État | Ce qu'il fait | Comment il en sort |
|---|---|---|
| **Fermé** | les appels passent ; il compte les échecs **d'affilée** | au **5ᵉ** échec d'affilée, il passe à ouvert. Un succès remet le compte à zéro |
| **Ouvert** | pendant **30 s**, tout appel échoue **aussitôt** avec `CircuitOuvert`, **sans toucher le réseau** | au bout de 30 s, il passe à semi-ouvert |
| **Semi-ouvert** | **un seul** appel d'essai passe ; les autres sont refusés pendant ce temps | essai réussi : fermé. Essai raté : de nouveau ouvert pour 30 s |

### Les choix, et leur raison

| Choix | Raison |
|---|---|
| Un `RefusDefinitif` (4xx) **ne compte pas** comme un échec | un 422 prouve que Notifications **répond**. Ce n'est pas une panne, et ouvrir le circuit couperait les signalements valides |
| L'horloge est un paramètre (`maintenant = Date.now`) | les tests avancent de 30 s **sans attendre 30 s**. C'est la même idée que le paramètre `attendre` du réessai |
| Un getter `etat` (fermé, ouvert ou semi-ouvert) | pour les tests, et pour la supervision : le TP 3 (étape 4) demandait un signal quand Notifications est en panne |
| L'erreur n'est jamais avalée | même en état ouvert, `publier` **lève** une erreur. Trafic ne change donc pas l'état du tronçon, et le signalement repartira quand le circuit se refermera |

### Ses tests : [`test/coupeCircuit.test.ts`](../../test/coupeCircuit.test.ts) (9 tests)

| Test | Ce qu'il prouve |
|---|---|
| 4 échecs | il reste fermé, et les 4 appels atteignent le destinataire |
| 5 échecs | il s'ouvre : le 6ᵉ appel lève `CircuitOuvert`, et le destinataire n'est **pas** appelé |
| 4 échecs, 1 succès, 4 échecs | il reste fermé : les échecs comptent **d'affilée** |
| à 29,999 s, puis à 30 s | encore ouvert, puis semi-ouvert |
| essai réussi | un appel passe, et le circuit se **referme** |
| essai raté | il se **rouvre** : ouvert à 59,999 s, semi-ouvert à 60 s |
| deux appels pendant l'essai | le second est refusé : **un seul** essai à la fois |
| 10 refus 422 | il reste fermé : un refus n'est pas une panne |
| **empilé comme dans `principal.ts`** | relevé 1 : 3 appels réseau. Relevé 2 : 2 appels, puis le circuit s'ouvre et le réessai s'arrête. Relevé 3 : **0** appel réseau, **0** pause |

**Les tests attrapent une erreur de seuil.** Nous avons changé `>= seuil` en `> seuil`, ce qui
ouvre le circuit au 6ᵉ échec au lieu du 5ᵉ. Résultat : 4 tests passent, 2 échouent et 3 sont
annulés. Le fichier remis en état, les 9 passent.

---

## 4. Ce que le coupe-circuit change, mesuré

[`experience-etape3.ts`](experience-etape3.ts) joue **10 relevés lents** sur Rivoli face à un
Notifications **figé** (il accepte la connexion, mais ne répond jamais). Il utilise le vrai cas
d'utilisation de Trafic et le vrai publicateur HTTP.

Les temps sont réduits au 1/10 pour que l'essai dure quelques secondes : délai de 200 ms au lieu
de 2 s, pauses de 50 puis 100 ms. Le seuil (5) et l'ordre des Décorateurs sont ceux de
`principal.ts`.

```
$ node --no-warnings docs/tp4/experience-etape3.ts
reessai seul               : 10 releves en 7970 ms ; requetes recues par Notifications : 30
   duree de chaque releve (ms) : 821 799 819 799 791 792 784 798 773 794
reessai + coupe-circuit    : 10 releves en 1381 ms ; requetes recues par Notifications : 5
   duree de chaque releve (ms) : 796 585 0 0 0 0 0 0 0 0
```

| | Réessai seul | Réessai + coupe-circuit |
|---|---|---|
| Requêtes reçues par le Notifications en panne | **30** (3 par relevé) | **5**, puis plus rien |
| Durée d'un relevé, une fois le circuit ouvert | environ 800 ms à chaque fois (**7,5 s** à l'échelle réelle) | **0 ms** : refus immédiat |
| Total pour 10 relevés | 7 970 ms | 1 381 ms |

**Les deux problèmes du cours (slide 84) sont réglés :**
- Notifications ne reçoit plus d'appels en rafale, ce qui l'aide à redémarrer ;
- Trafic ne perd plus 7,5 s par relevé, donc les capteurs ne restent plus connectés pour rien.

### Le vrai service, lancé sans Notifications en face

Trafic tourne avec sa vraie racine de composition, et le port de `URL_SIGNALEMENTS` est fermé :
c'est une panne franche.

```
releve 08:00 -> 500 en 1.57 s     # 3 essais (echecs 1 a 3) + pauses 0,5 et 1 s
releve 08:01 -> 500 en 1.54 s     # echecs 4 et 5 : le circuit s'ouvre ; le 3e essai recoit CircuitOuvert
releve 08:02 -> 500 en 0.015 s    # circuit ouvert : refus sans reseau
releve 08:03 -> 500 en 0.010 s
journal de Trafic : 3 x « CircuitOuvert: circuit ouvert … »
```

### Ce qui reste, et ce que coûte ce Décorateur

- **Le capteur reçoit toujours 500.** C'est voulu : l'état du tronçon ne change pas, et le
  relevé suivant retentera la publication. Le signalement **n'est pas perdu** tant que des relevés
  arrivent. Il **arrive en retard** : au mieux 30 s après le retour de Notifications.
- **Le coût :**
  - un fichier de 58 lignes de plus, et un état à garder en mémoire ;
  - un état **par copie** de Trafic : avec deux copies, chacune a son propre circuit ;
  - 30 s de signalements refusés même si Notifications revient au bout de 2 s.
  
  Le TP 4 impose les réglages (5 échecs, 30 s), et nous les avons gardés.

---

## 5. Résultats

```
npm test              # tests 107, pass 107, fail 0   (94 avant cette étape, + 13)
npm run test:trafic   # tests 60,  fail 0
```

| Fichier | Nouveau ou modifié |
|---|---|
| `urbanhub-trafic/src/adaptateurs/coupeCircuit.ts` | nouveau : le coupe-circuit |
| `urbanhub-trafic/src/adaptateurs/erreurs.ts` | nouveau : `RefusDefinitif`, `CircuitOuvert` |
| `urbanhub-trafic/src/adaptateurs/reessai.ts` | modifié : seconde borne (+4 lignes) |
| `urbanhub-trafic/src/adaptateurs/publicationHttp.ts` | modifié : 4xx devient `RefusDefinitif` (+3 lignes) |
| `urbanhub-trafic/src/principal.ts` | modifié : les deux Décorateurs empilés |
| `test/coupeCircuit.test.ts`, `test/reessaiTrafic.test.ts` | nouveaux |
| `test/publicationHttpTrafic.test.ts` | modifié : + 1 test (422) |
| `package.json` | modifié : `test:trafic` inclut les deux nouveaux fichiers |
| `docs/tp4/experience-etape3.ts`, `docs/tp4/etape3-reessai-et-coupe-circuit.md` | nouveaux |

**Le centre de Trafic n'a pas changé d'une ligne** : `domaine.ts`, `ports.ts`, `regles.ts` et
`service.ts` sont intacts. Les deux Décorateurs sont des adaptateurs, branchés dans la racine de
composition.
