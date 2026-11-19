# TP 5, étape 6 : la déclaration d'usage de l'IA, et le README rejoué sur un poste propre

**Consigne :**
- écrivez la déclaration d'usage des assistants IA : outils, usages, demandes principales, ce que
  vous avez gardé ou rejeté ;
- puis vérifiez que les commandes du README se rejouent sur un poste propre.

**Livrables touchés :**
- [`README.md`](../../README.md) : la section « Déclaration d'usage des assistants IA », et la
  section « Sur un poste propre » ;
- [`.gitignore`](../../.gitignore) ;
- le [plan du dossier](../plan-dossier-ec01.md) (annexes A et B, limites, A-3) ;
- le [retour d'expérience](../retour-experience.md) (C2, et la partie 4 sur la sécurité).

---

## 1. La déclaration d'usage de l'IA

Elle est **dans le README**, parce que le cours l'y exige (« son absence est pénalisée »). Elle
suit la règle 05 : l'outil, son usage, les demandes principales, ce qui a été gardé ou rejeté, et
pourquoi.

**Deux choix d'écriture :**
- **Ne pas minimiser.** L'assistant a écrit l'essentiel du code, des tests et des fiches des
  TP 3 à 5. La déclaration le dit, et cite la recommandation du cours (« demandez-lui de
  critiquer, pas d'écrire à votre place ») pour en tirer la conséquence : à l'EC01, il faudra
  défendre chaque choix seul.
- **Les erreurs de l'assistant sont listées**, avec la façon dont elles ont été trouvées. Elles
  ont toutes été trouvées par une vérification rejouable : un test, un `git diff` ou un clone
  neuf.

**Deux cases restent marquées ⚠️ « à compléter par l'étudiant ».** L'assistant ne peut pas les
remplir à ma place :
- les outils utilisés aux TP 1 et 2 ;
- ce que j'ai relu, refait ou compris moi-même.

---

## 2. Le README rejoué sur un poste propre

### La méthode

**Le poste propre :** un **clone neuf depuis GitHub** (commit `ba10e42`), dans un dossier vide.
Il n'y a ni `node_modules`, ni base `.db`, ni configuration locale.
- Node.js 22.20.0, npm 10.9.3, Docker 29.1.3, Windows 11.
- Les services sont lancés **depuis le clone**, puis arrêtés par leur seul numéro de processus.

### Ce qui a été rejoué, et le résultat

| Commande du README | Résultat sur le clone neuf |
|---|---|
| `npm test`, **sans** `npm ci` | ❌ `ERR_MODULE_NOT_FOUND: Cannot find package 'kafkajs'` : 122 tests passent sur 123, et le fichier des tests Kafka plante |
| `npm ci` | ✅ `found 0 vulnerabilities` |
| `npm test` | ✅ tests 127, pass 127, fail 0 |
| `npm run test:trafic` | ✅ 65 / 65 |
| `npm run test:notifications` | ✅ 38 / 38 |
| `npm run air` et `npm run alertes` | ✅ mesures à 60 puis 70 → `202`, `202` ; mesure incomplète → `422` ; Alertes : `ALERTE capteur-12:PM10:2026-11-19 : moyenne 60`, une seule fois |
| `npm run trafic` et `npm run notifications` | ✅ relevés lents → `202`, `202` ; relevé incomplet → `422` ; Notifications : `NOTIFICATION rue-de-rivoli-1:… circulation a 9 km/h pour 30 km/h autorises` |
| `docker compose -f compose.tp4.yaml up -d --build` | ✅ code 0 ; les 5 conteneurs démarrent, Kafka `healthy` |
| 3 relevés lents par Kafka (port 8003) et par HTTP (port 8013) | ✅ `202` en 0,03 à 0,09 s. Notifications : `recu rue-de-rivoli-1:2026-11-19T08:10:00 (partition 0 offset 0)` puis `NOTIFICATION …` ; en HTTP, `NOTIFICATION boulevard-voltaire-3:…`. `audit` : `partition 0 offset 0 cle rue-de-rivoli-1` |
| `docker compose -f compose.tp4.yaml down -v` | ✅ pile arrêtée, aucun volume restant |

Après les tests, `git status` sur le clone est vide : les tests ne laissent aucun fichier.

### Ce que la vérification a trouvé, et ce qui a été corrigé

| # | Constat | Gravité | Correction |
|---|---|---|---|
| 1 | **Le README ne disait pas `npm ci`.** Sur un poste propre, la première commande, `npm test`, échouait | bloquant | README : une section « Sur un poste propre », avec les prérequis et `npm ci` |
| 2 | **Un seul relevé lent ne donne aucune notification avec Docker.** L'image de Trafic tourne avec `REGLE=avec-minimum`, qui demande 3 relevés. Mon premier essai n'en envoyait qu'un, et j'ai d'abord cru à une panne | trompeur | README : la règle est expliquée, avec un exemple de 3 relevés et la commande pour lire le journal |
| 3 | **Les volumes Docker de l'étape 6 du TP 4 étaient restés** (créés à 09:26). Le projet compose a un nom fixe (`urbanhub-tp4`), donc un clone neuf **retrouve les anciennes bases** : les tronçons y étaient déjà « congestionnés » | trompeur | README : `docker compose … down -v`, avec la raison. Le test a été refait après `down -v`. **Puis :** le script `scenario-etape6.sh` **refuse** désormais une pile qui n'est pas neuve, ce qui a été testé dans trois cas (pile arrêtée, pile neuve, pile déjà utilisée). J'ai rejoué moi-même le scénario, avec 8 captures ([TP 4, étape 6, partie 7](../tp4/etape6-scenario-panne-rejeu.md#7-le-scénario-rejoué-par-moi-même-les-captures)) |
| 4 | **Les services créent leur base SQLite dans le dossier courant** (`mesures.db`, `releves.db`, `notifications.db`), et `.gitignore` ne les excluait pas. C'est l'origine du `mesures.db` non suivi depuis le TP 1 | gêne | `.gitignore` : `*.db` |
| 5 | **Alertes, le service du cours, s'arrête net sur une requête au corps vide.** `SyntaxError: Unexpected end of JSON input` dans `urbanhub-alertes/src/entreeHttp.ts`, ligne 9, et le processus meurt. Reproduit : `POST /alertes` sans corps → pas de réponse, puis le port est fermé | **sécurité** : une seule requête coupe toutes les alertes | **Non corrigé** : c'est le code fourni par le cours. Il est écrit comme limite dans le plan (partie 8) et dans le retour d'expérience (partie 4, sécurité). Trafic et Notifications, eux, répondent 422 et continuent |
| 6 | **Trafic lit 8 variables d'environnement, pas 7.** `TRONCONS` avait échappé à mon premier `grep` | inexactitude | corrigé dans le retour d'expérience (C2) et le plan (A-3) |

**Comment le constat 5 a été trouvé.** Pour savoir si les ports étaient ouverts, j'envoyais une
requête vide à chaque service. Alertes en est mort, et Qualité de l'air a alors répondu 500. J'ai
refait la vérification des ports par une simple connexion TCP, sans rien envoyer, puis j'ai
reproduit l'arrêt **volontairement**, pour le prouver.

**Un incident de méthode, déclaré dans le README.** La première commande d'arrêt visait **tous**
les processus `node.exe` du poste. Elle a été bloquée par les permissions de l'assistant. Elle a
été remplacée par un arrêt des seuls processus lancés pour le test.

---

## Vérifications dans le dépôt de travail

```
npm test     # tests 127, pass 127, fail 0
git status   # mesures.db n'apparaît plus (ignoré par *.db)
```

Tous les liens relatifs du README, du plan, du retour d'expérience et de cette fiche pointent
vers des fichiers existants.
