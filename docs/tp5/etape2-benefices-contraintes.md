# TP 5, étape 2 : les bénéfices observés et les contraintes

**Consigne :** listez les bénéfices observés, chacun avec sa preuve, et les contraintes, chacune
avec ce qu'elle a coûté.

**Livrable touché :** [`docs/retour-experience.md`](../retour-experience.md), partie 2.

---

## Ce qui a été fait

| Partie | Contenu |
|---|---|
| § 2.1 | **9 bénéfices** (B1 à B9). Chacun cite une preuve : test, commit, `git diff` ou trace |
| § 2.2 | **9 contraintes** (C1 à C9). Chacune chiffre son coût : lignes, fichiers, millisecondes, ou un défaut qui reste |
| § 2.3 | Ce que je retiens : l'hexagone rapporte là où la technique change ; les plus gros coûts viennent du découpage en services |

## Les mesures faites à cette étape

Certains chiffres n'existaient dans aucune fiche. Je les ai mesurés sur le dépôt :

| Mesure | Commande | Résultat |
|---|---|---|
| Le passage à Kafka n'a pas touché les centres | `git diff --stat e04d6e8 646ba3a -- <domaine, ports, regles, service des deux services>` | vide |
| Les Décorateurs n'ont pas changé pour Kafka | `git diff --stat e04d6e8 646ba3a -- reessai.ts coupeCircuit.ts` | vide |
| Le remplacement de l'adaptateur | `git show --stat 197c622` | 2 fichiers, 35 lignes ajoutées et 3 supprimées |
| La taille du TP 4 | `git diff --shortstat bbca6ce 0996b1a -- . ':!docs' ':!package-lock.json'` | 36 fichiers, 1 344 lignes ajoutées |
| Le déploiement | `wc -l compose.tp4.yaml Dockerfile.* k8s/trafic.yaml .dockerignore` | 180 lignes |
| Les racines de composition | `wc -l` sur les deux `principal.ts` et `audit.ts` | 109 lignes, 7 variables d'environnement |
| La suite de tests | `npm test` | 127 tests, environ 2,2 s |

## Les erreurs corrigées en route

- **Une première mesure était fausse.** J'ai d'abord comparé `50a58ee` à `646ba3a`. Cette plage
  contient aussi l'étape 4 (l'idempotence), et le `diff` montrait donc `ports.ts` et `service.ts`
  de Notifications modifiés. Sur la seule étape 5 (`e04d6e8` à `646ba3a`), il est vide. La
  modification de l'étape 4 est devenue la contrainte **C4**, puisque le centre a bien changé, mais
  pour un **besoin**, pas pour une technique.
- **Le chiffre de 800 ms est à l'échelle du test.** Je l'ai précisé dans B7 : 7,5 s à l'échelle
  réelle ([TP 4, étape 3](../tp4/etape3-reessai-et-coupe-circuit.md)).

## Une contrainte que les TP n'avaient pas écrite

**C7, le contrat implicite entre les services.** J'ai relu
[`traductionTrafic.ts`](../../urbanhub-notifications/src/adaptateurs/traductionTrafic.ts) et
[`entreeKafka.ts`](../../urbanhub-notifications/src/adaptateurs/entreeKafka.ts). Un signalement
dont un champ est renommé devient un `IncidentInvalide`.
- En HTTP, Notifications répond 422.
- Par Kafka, il **journalise et ignore** le message. C'était le choix de l'étape 5, pour ne pas
  bloquer la partition. L'incident est alors perdu, sans erreur visible chez Trafic.

Ce défaut alimentera les recommandations de l'étape 3.

## Vérifications

```
npm test     # tests 127, pass 127, fail 0
```

Tous les liens relatifs du retour d'expérience et de cette fiche pointent vers des fichiers
existants.
