# Plan du dossier d'architecture : UrbanHub (EC01)

**Épreuve :** EC01, « Conception et modélisation d'architecture logicielle ».
- Ce dossier vise les critères **C4.1** (adéquation aux besoins et contraintes projet) et **C5.1**
  (argumentation technique : performance, sécurité, maintenabilité).
- Il part du dépôt `cours-hexagonale`, dans l'état des TP 1 à 4.

**Ce document est un plan.** Chaque partie annonce ce qu'elle contiendra, puis liste ses
**choix**. Chaque choix a quatre colonnes, toujours remplies :

| Colonne | Ce qu'elle dit |
|---|---|
| **Choix** | la décision, en une ligne, avec un identifiant (par exemple `A-2`) |
| **Raison** | pourquoi ce choix plutôt qu'un autre ; « un choix sans raison écrite ne rapporte pas de point » |
| **Prix** | ce que le choix coûte. Un avantage sans son coût se lit comme un argument de vente |
| **Preuve** | un test (**T**), un commit (**C**), une trace ou une mesure (**M**), ou un fichier du dépôt (**F**) |

Les choix marqués **⏳** ne sont pas encore faits : ce sont les manques relevés dans le
[retour d'expérience](retour-experience.md#4-la-grille-ec01--ce-que-mes-tp-prouvent-déjà-pour-c41-et-c51)
(partie 4). Le dossier les présentera comme des décisions **à prendre**, avec leur prix. Il ne
les présentera pas comme faites.

| Partie | Titre | Critère visé |
|---|---|---|
| 1 | Le besoin | C4.1 |
| 2 | L'architecture : ports et adaptateurs | C5.1, maintenabilité |
| 3 | Le découpage | C4.1 |
| 4 | Les patrons | C5.1, maintenabilité et performance |
| 5 | La communication | C5.1, performance |
| 6 | Le déploiement | C4.1 ; C5.1, sécurité |
| 7 | La sécurité | C5.1, sécurité |
| 8 | Les limites et les évolutions | C4.1, C5.1 |
| Annexes | Commandes à rejouer, déclaration d'usage de l'IA, index des preuves | règles 05 et 06 du cours |

---

## 1. Le besoin

**Contenu de la partie :**
- le contexte UrbanHub : les capteurs de la ville, et les services Qualité de l'air et Alertes
  déjà là ;
- la règle de congestion, avec son exemple chiffré : 08:00 à 08:30 sur `boulevard-voltaire-3` ;
- le vocabulaire du domaine (tronçon, relevé, fenêtre, seuil, épisode, signalement) ;
- le besoin des opérateurs : être prévenus **une fois** par incident ;
- **les contraintes du projet** : 3 tronçons, un groupe de 3 ou 4 personnes, des postes Windows,
  TypeScript sous Node.js comme l'existant, un seul dépôt ;
- **les besoins non fonctionnels**, posés comme des hypothèses chiffrées, puisque personne ne les
  a fixés.

| | Choix | Raison | Prix | Preuve |
|---|---|---|---|---|
| B-1 | Le service **Trafic** : un tronçon est congestionné quand la moyenne sur 15 min tombe sous 40 % de sa limite ; il est signalé **une fois** par épisode | La règle passe les trois questions du cours (1.4) : une vraie règle métier, plusieurs entrées et sorties, des techniques qui vont changer | Un hexagone complet pour environ 550 lignes de service ; un vocabulaire à tenir | **T** `trafic.test.ts`, « l'exemple de l'étape 1 » ; **C** `90487e3` |
| B-2 | Un seuil **relatif** à chaque tronçon, et une fenêtre qui inclut sa borne | 15 km/h, c'est un bouchon sur un boulevard limité à 50, pas dans une rue limitée à 30 | Un référentiel des tronçons à tenir à jour (`troncons.json`) | **T** « le seuil dépend du tronçon » ; **T** « une moyenne égale au seuil reste fluide » |
| B-3 | Les opérateurs sont prévenus **une seule fois** par incident (Notifications) | Le réessai et Kafka livrent des doublons. Un opérateur prévenu deux fois finit par ignorer les alertes | L'idempotence dans le récepteur (voir P-5) | **T** `idempotenceNotifications.test.ts` ; **M** rejeu : 0 notification de plus |
| B-4 ⏳ | Des besoins non fonctionnels **chiffrés** : un délai entre le relevé et la notification, une disponibilité, un volume cible | Sans eux, on ne peut juger ni le choix HTTP ou Kafka, ni le seuil du signal n° 3 | Des hypothèses à assumer, et à défendre à l'oral | à écrire ; point de départ : **M** 0,06 s avec Kafka, 7,54 s au pire en HTTP |

---

## 2. L'architecture : ports et adaptateurs

**Contenu de la partie :**
- le schéma d'un service : le centre, les ports primaires et secondaires, les adaptateurs. Il
  reprend celui du README ;
- la règle de dépendance, et comment elle est vérifiée ;
- la racine de composition et sa configuration ;
- la stratégie de test : le centre en mémoire, les adaptateurs par des tests de contrat, et un
  test de bout en bout.

| | Choix | Raison | Prix | Preuve |
|---|---|---|---|---|
| A-1 | **Hexagone** pour Trafic et Notifications : le centre n'importe aucune technique | Le métier se teste sans base ni réseau, et les techniques changent (stockage, transport) sans toucher au centre | Plus de code autour du centre que dedans : 326 lignes contre 226 (Trafic), un adaptateur en mémoire par port | **M** test en mémoire environ 50 fois plus rapide (TP 1) ; **C** `197c622` : 2 fichiers |
| A-2 | La **règle de dépendance vérifiée par un test**, qui interdit aussi les paquets npm dans le centre | Une frontière tenue par la relecture finit par céder ; une machine ne l'oublie pas | Une expression régulière à maintenir, qui ne voit que les imports écrits en clair | **T** `regleDependance*.test.ts` ; **M** un `faute.ts` qui importe `kafkajs` donne 1 échec |
| A-3 | **Une racine de composition par programme**, réglée par des variables d'environnement | Un seul fichier décide de la base, de la règle et du transport | 7 variables à documenter (`PORT`, `REGLE`, `BASE_RELEVES`, `BASE_NOTIFICATIONS`, `URL_SIGNALEMENTS`, `KAFKA_BROKERS`, `KAFKA_GROUPE`) | **F** `principal.ts` ; **C** `646ba3a` : le transport choisi là, et seulement là |
| A-4 | **Un test de contrat** pour chaque port qui a un adaptateur réel | L'adaptateur en mémoire et l'adaptateur SQLite doivent se comporter pareil, sinon les tests du centre mentent | 61 lignes de contrat pour un adaptateur de 31 | **T** `contratDepotReleves`, `contratEtatsTroncons`, `contratHistorique` |
| A-5 | **SQLite** (`node:sqlite`), une base par service | Aucun serveur, aucune dépendance ; assez pour 3 tronçons ; les données survivent à un redémarrage | Une seule copie possible par service : cela bloque la montée en charge et la mise à jour progressive | **T** « les relevés survivent à un redémarrage » ; **M** TP 3, étape 3, § 3 |

---

## 3. Le découpage

**Contenu de la partie :**
- les contextes délimités, et la carte qui les relie ;
- les deux dessins du TP 3 : le monolithe hexagonal et les microservices ;
- **la décision d'aujourd'hui, et les signaux qui la changeraient** ;
- le découpage **exercé** au TP 4 : ce qu'il a prouvé, et ce qu'il a coûté ;
- la comparaison avec Segment (5.1).

| | Choix | Raison | Prix | Preuve |
|---|---|---|---|---|
| D-1 | **Quatre contextes délimités** : Qualité de l'air, Alertes, Trafic, Notifications. Capteurs reste hors du dépôt | Les mêmes mots n'ont pas le même sens d'un contexte à l'autre (« alerte », « seuil ») ; chacun a ses données | Une **traduction** à chaque frontière | **F** TP 3, étape 1, § 3 ; **F** `traductionTrafic.ts` |
| D-2 | **Aujourd'hui, un monolithe hexagonal, dans un seul dépôt** | Un appel coûte 1 µs en processus et 1 ms en HTTP ; il n'y a qu'une équipe ; SQLite bloque la montée en charge dans les deux dessins ; Segment est revenu à cette forme | **L'isolement des pannes** : une exception non rattrapée arrête tous les hexagones | **M** TP 3, étape 3 ; **C** `079855e` |
| D-3 | **Découper sur l'un des 5 signaux observables** ; Alertes ou Notifications en premier | Le découpage se paie dès le 2ᵉ service : il doit être justifié par une mesure | Des métriques à produire (95ᵉ centile, incidents), qui ne le sont pas encore | **F** TP 3, étape 6, § 2 |
| D-4 | **Le découpage a été exercé** : Trafic et Notifications, chacun avec son processus, sa base, son modèle et ses tests | Prouver que les coutures de l'hexagone tiennent le jour où un signal arrive | 1 344 lignes dans 36 fichiers pour transporter un message | **C** `f278619` à `0996b1a` ; **T** la règle « aucun import d'un autre service » |

---

## 4. Les patrons

**Contenu de la partie :** pour chaque patron, le problème rencontré, la solution, son effet
sur la maintenabilité et sur la tenue en charge, son coût, et sa preuve. Ce sont les tableaux
du README (TP 2), complétés au TP 4.

| | Choix | Raison | Prix | Preuve |
|---|---|---|---|---|
| P-1 | **Stratégie** : `RegleCongestion`, avec `SeuilRelatif` et `SeuilRelatifAvecMinimum` | La règle simple voit un faux bouchon la nuit (un bus à 03:00), et signale deux fois le même bouchon (08:00 et 08:32) | Un fichier de 35 lignes ; un réglage `REGLE` à documenter ; un cas « pas de conclusion » | **T** `patronsTrafic.test.ts` ; **C** `9cc9bfa` |
| P-2 | **Décorateur, réessai borné** : 3 essais, pauses de 0,5 s puis 1 s ; ni un refus 4xx ni un circuit ouvert ne sont retentés | Une panne passagère ne doit pas faire perdre un signalement | Jusqu'à 7,5 s d'attente pour le capteur ; des doublons possibles | **T** `reessaiTrafic.test.ts` |
| P-3 | **Décorateur, coupe-circuit** : ouvert après 5 échecs, pendant 30 s, puis un appel d'essai | Une panne longue coûtait 7,5 s par relevé et assommait le service qui redémarrait | 58 lignes ; un état en mémoire, perdu au redémarrage ; jusqu'à 30 s de refus alors que le service est peut-être déjà revenu | **T** `coupeCircuit.test.ts` ; **M** 5 requêtes au lieu de 30 ; **C** `50a58ee` |
| P-4 | **Dépôt** : `DepotReleves`, `EtatsTroncons`, `Historique` | Ranger et relire comme une collection, sans SQL dans le centre | Un adaptateur par stockage, et son contrat | **T** tests de contrat (A-4) |
| P-5 | **Consommateur idempotent** : réserver l'identifiant `troncon:debut` en base, puis prévenir, et rendre la réservation en cas d'échec | Les envois simultanés passent tous les deux si l'on vérifie avant d'enregistrer | Le contrat du port `Historique` a changé ; il reste une **fenêtre « au plus une fois »** si le processus meurt au milieu | **T** « deux envois simultanés » ; **C** `e04d6e8` |

---

## 5. La communication

**Contenu de la partie :**
- les trois formes du cours : en processus, HTTP, journal. Celles qui ont été construites, et
  celle qui ne l'a pas été (la file) ;
- le tableau « ce que les traces montrent » : scénario normal, panne, rejeu, en HTTP et par
  Kafka ;
- le format des messages entre contextes.

| | Choix | Raison | Prix | Preuve |
|---|---|---|---|---|
| K-1 | **Entre deux hexagones, toujours un port** (`publier()`) ; le transport est un adaptateur | Le transport peut changer (en processus, HTTP, Kafka) sans toucher au centre | Une indirection de plus : 4 fichiers traversés pour un `publier()` | **M** `git diff --stat e04d6e8 646ba3a` vide sur les centres |
| K-2 | **HTTP** avec un délai de 2 s ; codes 202 (pris en compte, même pour un doublon), 422 (ne pas renvoyer), 500 (à retenter) | Jamais d'appel réseau sans délai ; le code de réponse dit à l'émetteur quoi faire | Pendant une panne, le capteur attend 7,54 s puis reçoit 500. Le signalement n'est rattrapé qu'au relevé suivant, avec un début faussé | **T** `publicationHttpTrafic.test.ts` ; **M** trace de l'étape 6 |
| K-3 | **Kafka** : topic `signalements` à 3 partitions, le **tronçon comme clé**, **un groupe par lecteur** (`notifications`, `audit`) | Trafic publie sans attendre son lecteur. Même tronçon, même partition, donc l'ordre est gardé. On peut rejouer un groupe sans toucher à l'autre | Un broker à exploiter ; une dépendance npm ; un arrêt propre à écrire pour pouvoir rejouer | **T** le partitionneur réel de `kafkajs` ; **M** 202 en 0,06 s pendant la panne ; rejeu sans notification de plus |
| K-4 | Un message Kafka **illisible est ignoré**, et seul un échec des opérateurs le fait relire | Le relire ne le rendra jamais lisible ; lever une erreur bloquerait la partition | **Perte silencieuse** si le format change (C7) | **T** `entreeKafkaNotifications.test.ts` |
| K-5 ⏳ | Un **topic d'erreurs** pour les messages illisibles (recommandation R2) | Corriger K-4 : le message reste visible, et rejouable une fois le lecteur corrigé | Un topic de plus à surveiller | à écrire |
| K-6 ⏳ | Un **contrat versionné** du signalement (un schéma JSON), testé côté Trafic et côté Notifications (recommandation R3) | Aujourd'hui, seul un test qui importe le code **des deux** services vérifie le format, et seulement en HTTP | Un schéma à maintenir ; une règle d'évolution (ajouter un champ oui, renommer seulement dans une nouvelle version) | à écrire ; point de départ : **T** `traficVersNotifications.test.ts` |

---

## 6. Le déploiement

**Contenu de la partie :**
- les images ;
- la pile locale (`docker compose`) et le scénario rejouable ;
- la stratégie Kubernetes de Trafic, et le signal pour en changer ;
- la configuration par environnement et la supervision (TP 3, étape 4, § 3).

| | Choix | Raison | Prix | Preuve |
|---|---|---|---|---|
| E-1 | **Une image par service** : `npm ci --omit=dev`, utilisateur `node` (pas root), dossier `/donnees` | Chaque service se livre seul ; une image sans outils de développement ni droits de root | 2 Dockerfiles ; un volume à rendre inscriptible (`chown`) | **F** `Dockerfile.trafic`, `Dockerfile.notifications` ; **M** pile construite à neuf, 5 conteneurs |
| E-2 | **`docker compose`** pour la pile locale (Kafka, Trafic en Kafka et en HTTP, Notifications, audit), avec un **scénario scripté** | Rejouer la panne et le rejeu à l'identique, sur n'importe quel poste | 180 lignes de déploiement ; Docker Desktop requis ; des pièges propres à Windows (`MSYS_NO_PATHCONV`) | **F** `compose.tp4.yaml`, `scenario-etape6.sh` ; **M** `trace-etape6.txt` |
| E-3 | **Kubernetes pour Trafic : 1 copie, stratégie `Recreate`** | SQLite est un seul fichier : deux copies en même temps casseraient la fenêtre de 15 min et les états | Environ 10 s de coupure à chaque livraison | **F** `k8s/trafic.yaml` ; **F** TP 3, étape 5 |
| E-4 | Passer à **2 copies et la mise à jour progressive**, mais **seulement après PostgreSQL** | Dupliquer avant de partager les données casserait la règle | Un adaptateur PostgreSQL, jugé par les tests de contrat existants | **F** TP 3, étapes 5 et 6 (signal n° 3) |
| E-5 | **Arrêt propre** sur `SIGTERM` (Notifications, audit) | Kafka refuse le rejeu tant que le groupe n'est pas vide | Quelques lignes dans la racine de composition. **Trafic ne le fait pas encore** : il compte sur `terminationGracePeriodSeconds: 5` | **M** 1ᵉʳ rejeu refusé (« Stable »), puis accepté (`Empty`) |
| E-6 ⏳ | **Appliquer le manifeste** sur un cluster local, et ajouter `GET /sante` pour les sondes | Le manifeste n'a jamais tourné ; la sonde de vie n'est qu'un test de port | Un cluster local (kind ou minikube) ; un point d'entrée de plus | à faire |

---

## 7. La sécurité

**Contenu de la partie :** ce que le code fait déjà, ce qu'il ne fait pas, et ce que coûterait
chaque correction. Aucun TP ne demandait la sécurité : cette partie est **ajoutée pour C5.1**.

| | Choix | Raison | Prix | Preuve |
|---|---|---|---|---|
| S-1 | **Valider les entrées dans le domaine** ; un message mal formé est refusé en 422, et rien n'est enregistré | Une donnée fausse ne doit ni entrer en base ni déclencher une notification | Une classe d'erreur par contexte (`ReleveInvalide`, `IncidentInvalide`) | **T** `entreeNotifications.test.ts` (Notifications). ⏳ côté Trafic, **aucun test** ne vérifie le 422 de `POST /releves` : à ajouter |
| S-2 | **Des requêtes SQL toujours préparées**, avec des paramètres `?` | Pas d'injection possible par un identifiant de tronçon | Aucun | **F** les 3 adaptateurs SQLite. ⏳ un test avec une entrée piégée |
| S-3 | **Une erreur 500 ne renvoie rien** ; le détail ne va qu'au journal | Ne pas montrer l'intérieur du service à un appelant | Il faut lire le journal pour diagnostiquer | **F** `entreeHttp.ts` |
| S-4 | **Une dépendance de production** ; conteneurs non root ; configuration montée en lecture seule ; mémoire plafonnée | Moins de code tiers, moins de surface d'attaque ; un conteneur compromis a peu de droits | Écrire soi-même ce qu'une bibliothèque aurait fait | **M** `npm audit` : 0 vulnérabilité ; **F** Dockerfiles, `k8s/trafic.yaml` |
| S-5 ⏳ | **Authentifier les appels entre services** : un jeton par émetteur, vérifié dans l'**adaptateur d'entrée**, et non dans le centre | Aujourd'hui, n'importe quel poste du réseau peut faire prévenir les opérateurs (`POST /signalements`) | Un secret à distribuer et à renouveler, par environnement | à écrire, avec un test « sans jeton : 401 » |
| S-6 ⏳ | **Limiter la taille des requêtes** (par exemple 16 Ko, sinon 413) | `lireCorps` lit sans limite : un envoi énorme épuise la mémoire | Une limite à choisir selon le plus gros message légitime | à écrire, avec un test « corps trop gros : 413 » |
| S-7 ⏳ | **Kafka chiffré et authentifié** (TLS et SASL), avec des droits par topic : Trafic écrit, Notifications lit | Aujourd'hui `PLAINTEXT` : n'importe qui sur le réseau peut écrire dans `signalements` | Des certificats à gérer ; une configuration du client `kafkajs` dans la racine de composition | à écrire ; **F** `compose.tp4.yaml` |

---

## 8. Les limites et les évolutions

**Contenu de la partie :** ce que le dossier **ne prouve pas**, écrit franchement, et les
évolutions classées par signal.

| Limite | Pourquoi elle reste | Ce qui la lèverait |
|---|---|---|
| Aucun test de charge | Le volume réel (3 tronçons) ne le demandait pas | un petit tir de charge sur `POST /releves`, qui mesure le 95ᵉ centile (signal n° 3) |
| La fenêtre « au plus une fois » de P-5 | La fermer demande des opérateurs eux-mêmes idempotents | un fournisseur de SMS qui accepte une clé de dédoublonnage |
| HTTP ne rattrape pas un signalement perdu (K-2) | Pas de boîte d'envoi | une boîte d'envoi dans la base de Trafic, ou Kafka (K-3) |
| Le manifeste jamais appliqué (E-6) | Pas de cluster sur le poste | kind ou minikube |
| Les manques de sécurité S-5 à S-7 | Hors du périmètre des TP | les choix S-5 à S-7, dans cet ordre |

---

## Annexes

### A. Les commandes à rejouer

Ce sont les commandes du README, vérifiées sur un poste propre : un clone neuf, `npm ci`,
`npm test`, les services, puis `docker compose`. Le résultat de cette vérification sera écrit ici
(question 6 du TP 5).

### B. La déclaration d'usage des assistants IA

Les outils, les usages, les demandes principales, ce qui a été gardé ou rejeté, et pourquoi.
Elle est obligatoire dans le README (question 6 du TP 5).

### C. L'index des preuves

| Commit | Ce qu'il prouve | Choix |
|---|---|---|
| `90487e3` | le service et sa règle | B-1 |
| `9cc9bfa` | Stratégie et Décorateur, racine de composition | P-1, P-2, A-3 |
| `197c622` | un adaptateur remplacé, 2 fichiers touchés | A-1, A-5 |
| `079855e` | la conclusion du TP 3 : monolithe hexagonal et signaux | D-2, D-3 |
| `f278619` | Trafic microservice, Notifications en hexagone | D-4 |
| `50a58ee` | réessai borné et coupe-circuit | P-2, P-3 |
| `e04d6e8` | le consommateur idempotent | B-3, P-5 |
| `646ba3a` | Kafka sans toucher aux centres | K-1, K-3, A-3 |
| `0996b1a` | `docker compose`, panne, rejeu | E-1, E-2, E-5 |

### D. La correspondance avec la grille

| Critère | Parties du dossier |
|---|---|
| C4.1, adéquation aux besoins et contraintes | 1, 3, 6, 8 |
| C5.1, performance | 4 (P-2, P-3), 5, 8 |
| C5.1, sécurité | 6 (E-1), 7 |
| C5.1, maintenabilité | 2, 4, 5 (K-1, K-6) |
