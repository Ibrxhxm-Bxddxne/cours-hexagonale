# Retour d'expérience : UrbanHub en hexagones, des TP 2 à 4

**Module :** EADL BC01-FM03, architecture hexagonale (TP 5, travail individuel).

**Ce document :** un bilan de ce que j'ai construit aux TP 2 à 4. Ce que cela a apporté, ce que
cela a coûté, et ce que je recommande pour la suite. Chaque affirmation renvoie à une preuve du
dépôt : un test, un commit ou une trace.

| Partie | Contenu |
|---|---|
| 1 | Ce que j'ai construit : le besoin, le découpage, les patrons, la communication |
| 2 | Les bénéfices observés, avec leurs preuves ; les contraintes, avec leur coût |
| 3 | La comparaison avec Segment ; trois recommandations pour un futur projet UrbanHub |
| 4 | La grille EC01 : ce que mes TP prouvent déjà pour C4.1 et C5.1, où, et ce qui manque |

---

## 1. Ce que j'ai construit

### 1.1 Le besoin

UrbanHub surveille une ville avec des capteurs. Le dépôt du cours contenait deux services :
- **Qualité de l'air** (`urbanhub-air/`), qui reçoit des mesures ;
- **Alertes** (`urbanhub-alertes/`), qui prévient quand un seuil est dépassé.

J'ai ajouté le service **Trafic** au TP 2 ([choix du service](tp2-etape1-choix-du-service.md)),
avec cette règle métier :

> Un tronçon de route est déclaré **congestionné** quand la vitesse moyenne relevée par ses capteurs
> sur les 15 dernières minutes tombe sous 40 % de sa vitesse limite ; UrbanHub signale alors la
> congestion une seule fois, jusqu'à ce que le tronçon redevienne fluide.

Le service méritait un hexagone, selon les trois questions du cours (1.4) :
- **une vraie règle métier** : un seuil relatif à chaque tronçon, une fenêtre de 15 minutes, un
  seul signalement par épisode ;
- **plusieurs entrées et sorties** : les relevés en entrée ; les relevés stockés, l'état des
  tronçons et les signalements en sortie ;
- **des techniques qui allaient changer** : le stockage (mémoire, puis SQLite) et le canal de
  signalement (HTTP, puis Kafka). Les deux ont effectivement changé, au TP 2 puis au TP 4.

Au TP 4, il fallait que quelqu'un **reçoive** ces signalements et prévienne les opérateurs. J'ai
écrit pour cela un second service, **Notifications** ([découpage](tp4/etape1-decoupage.md)).

### 1.2 Le découpage

Le découpage a été construit en trois temps.

| TP | Forme | Ce qui a été fait |
|---|---|---|
| **TP 2** | **un hexagone** : Trafic | le centre (`domaine.ts`, `ports.ts`, `regles.ts`, `service.ts`), sans aucun import technique, et ses adaptateurs autour |
| **TP 3** | **une étude**, sans nouveau code de service | les contextes délimités et leurs données ; le monolithe hexagonal et les microservices dessinés puis mesurés. **Conclusion : un monolithe hexagonal aujourd'hui**, avec 5 signaux observables pour changer d'avis ([conclusion](tp3/etape6-conclusion.md)) |
| **TP 4** | **deux microservices** : Trafic et Notifications | chacun son processus, sa base (`releves.db`, `notifications.db`), son modèle, ses tests (`npm run test:trafic`, `npm run test:notifications`) et son image Docker |

**Le TP 4 contredit-il le TP 3 ?** Non. Le TP 4 a **exercé** le découpage que le premier signal
du TP 3 déclencherait. Il ne change pas la recommandation pour une ville de 3 tronçons. Je
reviens sur ce point dans le bilan.

**Les deux contextes délimités du TP 4 :**

| | Trafic | Notifications |
|---|---|---|
| Sa question | ce tronçon est-il bouché ? | qui faut-il prévenir, et l'a-t-on déjà fait ? |
| Son vocabulaire | tronçon, relevé, vitesse, épisode, **signalement** | **incident**, source, lieu, résumé, notification |
| Sa base | `releves.db` : relevés et état des tronçons | `notifications.db` : les incidents déjà notifiés |
| Taille du centre | 226 lignes | 155 lignes |
| Taille des adaptateurs | 326 lignes | 172 lignes |

Notifications ne réutilise pas le mot « signalement » : il le **traduit** en incident dans ses
adaptateurs d'entrée ([`traductionTrafic.ts`](../urbanhub-notifications/src/adaptateurs/traductionTrafic.ts)).
Aucun service n'importe le code de l'autre. La règle de dépendance le vérifie
([`regleDependanceNotifications.test.ts`](../test/regleDependanceNotifications.test.ts)).

### 1.3 Les patrons

| Patron | Où | Le problème qu'il règle | TP |
|---|---|---|---|
| **Ports et adaptateurs** | les deux services | le centre ne connaît ni HTTP, ni SQLite, ni Kafka : il ne voit que des ports | 2, 4 |
| **Racine de composition** | les `principal.ts`, et `audit.ts` | un seul fichier par programme crée et branche les objets ; il choisit la base, la règle et le transport | 2, 4 |
| **Dépôt** | `DepotReleves`, `EtatsTroncons`, `Historique` | ranger et relire comme une collection, en mémoire ou en SQLite, sans SQL dans le centre | 2, 4 |
| **Stratégie** | `RegleCongestion` ([`regles.ts`](../urbanhub-trafic/src/regles.ts)) | la règle de congestion change selon la ville ou l'heure ; la règle simple voyait un faux bouchon la nuit | 2 |
| **Décorateur : réessai borné** | [`reessai.ts`](../urbanhub-trafic/src/adaptateurs/reessai.ts) | une panne passagère faisait perdre un signalement ; 3 essais, pauses de 0,5 s puis 1 s | 2, puis 4 |
| **Décorateur : coupe-circuit** | [`coupeCircuit.ts`](../urbanhub-trafic/src/adaptateurs/coupeCircuit.ts) | une panne longue coûtait 7,5 s par relevé ; ouvert après 5 échecs, pendant 30 s | 4 |
| **Consommateur idempotent** | [`service.ts`](../urbanhub-notifications/src/service.ts) de Notifications | le réessai et Kafka livrent des doublons ; l'identifiant `troncon:debut` est réservé en base avant de prévenir | 4 |
| **Traduction entre contextes** | [`traductionTrafic.ts`](../urbanhub-notifications/src/adaptateurs/traductionTrafic.ts) | deux vocabulaires ; la traduction reste à la frontière, la même pour HTTP et Kafka | 4 |

Les deux Décorateurs s'empilent dans la racine de composition de Trafic, sans que le cas
d'utilisation le sache :

```ts
new PublicateurAvecReessai(new PublicateurAvecCoupeCircuit(transport, 5, 30_000))
```

Le `transport` est HTTP ou Kafka.

### 1.4 La communication

J'ai construit et mesuré deux des trois formes du cours. Je n'ai pas utilisé de file de messages
(RabbitMQ, par exemple).

| Forme | Où | Comment | Ce qu'elle garantit |
|---|---|---|---|
| **HTTP synchrone** | Trafic → Notifications, `POST /signalements` ([`publicationHttp.ts`](../urbanhub-trafic/src/adaptateurs/publicationHttp.ts)) | délai de 2 s, réessai, coupe-circuit. Notifications répond 202 (pris en compte, même pour un doublon), 422 (illisible : ne pas renvoyer) ou 500 (à retenter) | Trafic **sait** si le signalement est arrivé, mais il **attend**, et il échoue si Notifications est absent |
| **Journal : Kafka** | Trafic → topic `signalements` → Notifications ([`publicationKafka.ts`](../urbanhub-trafic/src/adaptateurs/publicationKafka.ts), [`entreeKafka.ts`](../urbanhub-notifications/src/adaptateurs/entreeKafka.ts)) | 3 partitions, le tronçon comme clé. Deux groupes : `notifications` agit, `audit` journalise | Trafic publie **sans attendre** Notifications. Le message reste dans le journal : il est lu au redémarrage, et on peut le **rejouer** |
| **En processus** | aucune (elle n'existe que dans la conclusion du TP 3) | un appel de fonction à travers un port, dans le monolithe | ni réseau ni panne partielle |

**Le choix se fait dans la racine de composition.** Avec `KAFKA_BROKERS`, Trafic publie dans
Kafka ; sans, en HTTP. Le cas d'utilisation, le domaine et les ports n'ont pas changé quand Kafka
est arrivé : le `git diff` de l'[étape 5 du TP 4](tp4/etape5-adaptateur-kafka.md) est vide sur ces
fichiers.

**Le tout tourne avec `docker compose`** ([`compose.tp4.yaml`](../compose.tp4.yaml)) : 5 conteneurs
(Kafka, Trafic en Kafka, Trafic en HTTP, Notifications, audit). Les traces du scénario, de la panne
et du rejeu sont dans [`tp4/trace-etape6.txt`](tp4/trace-etape6.txt).

### 1.5 En chiffres

| | |
|---|---|
| Services écrits | 2 (Trafic, Notifications), à côté des 2 du cours |
| Tests | **127**, tous verts (`npm test`) ; 65 pour Trafic, 38 pour Notifications |
| Commits | 9 au TP 2, 8 au TP 3, 7 au TP 4 ; chaque étape a sa fiche dans `docs/` |
| Dépendances npm | **1** : `kafkajs`, importée seulement dans les racines de composition |

---

## 2. Bénéfices et contraintes

**La règle de cette partie.** Je ne garde un bénéfice que s'il a été **observé** : par un test, un
commit ou une trace. Je ne garde une contrainte qu'avec **ce qu'elle a coûté** : des lignes, des
fichiers, des millisecondes, ou un défaut. Les chiffres viennent du dépôt
(`git diff --stat`, `wc -l`, `npm test`) ou des fiches d'étape.

### 2.1 Les bénéfices observés

| # | Bénéfice | Preuve |
|---|---|---|
| B1 | **Le métier se teste sans base ni réseau, et vite.** | Au TP 1, le test en mémoire prend environ 2,5 ms, contre 91 à 145 ms pour le test du code d'avant, qui ouvrait une vraie base et un faux serveur : environ **50 fois plus rapide** ([TP 1, étape 3](etape3-resultats-experiences.md)). Aujourd'hui, les **127 tests** passent en environ **2,2 s**. Les 10 tests des adaptateurs Kafka tournent **sans broker** ([TP 4, étape 5](tp4/etape5-adaptateur-kafka.md)) |
| B2 | **Remplacer un adaptateur ne touche que l'adaptateur et la racine de composition.** | Commit `197c622` : `etatsSqlite.ts` créé (31 lignes) et `principal.ts` (7 lignes modifiées), **rien d'autre**. Il corrige un vrai défaut : un redémarrage faisait signaler deux fois le même bouchon ([TP 2, étape 6](tp2-etape6-remplacement-adaptateur.md)) |
| B3 | **Changer de transport (HTTP vers Kafka) ne touche pas le centre.** | `git diff --stat e04d6e8 646ba3a` sur `domaine.ts`, `ports.ts`, `regles.ts` et `service.ts` des deux services : **vide** ([TP 4, étape 5](tp4/etape5-adaptateur-kafka.md)) |
| B4 | **Un Décorateur écrit une fois sert pour un transport qui n'existait pas encore.** | Le réessai a été écrit au TP 2 pour HTTP. Au TP 4, il enveloppe Kafka : le même `git diff` est **vide** sur `reessai.ts` et `coupeCircuit.ts`. Le test « broker injoignable » montre ses 3 essais sur Kafka ([`publicationKafkaTrafic.test.ts`](../test/publicationKafkaTrafic.test.ts)) |
| B5 | **La frontière du centre est vérifiée par une machine, pas par la relecture.** | Un fichier `faute.ts` qui importe `kafkajs` dans le centre de Notifications fait échouer la règle de dépendance (1 échec). Sans lui, tout repasse ([TP 4, étape 5](tp4/etape5-adaptateur-kafka.md)) |
| B6 | **Découper a été peu coûteux, parce que l'hexagone avait préparé les coutures.** | Au TP 4, Trafic était déjà un microservice selon les critères du cours. Le seul ajout a été le script `npm run test:trafic` ([TP 4, étape 1](tp4/etape1-decoupage.md)) |
| B7 | **Une panne de Notifications ne fige plus Trafic.** | Avec le coupe-circuit, 10 relevés face à un service figé envoient **5** requêtes au lieu de **30**, et chaque relevé passe d'environ 800 ms dans le test (**7,5 s** à l'échelle réelle) à **0 ms** ([TP 4, étape 3](tp4/etape3-reessai-et-coupe-circuit.md)). Avec Kafka, le capteur reçoit **202 en 0,06 s** pendant la panne, et Notifications rattrape le message dès son redémarrage ([trace](tp4/trace-etape6.txt)) |
| B8 | **Les doublons ne préviennent pas deux fois les opérateurs.** | Le même message envoyé deux fois donne 1 notification, et le résultat tient après un redémarrage. Le **rejeu** de tout le topic donne 3 doublons ignorés et **0** notification de plus. Le groupe `audit` n'a pas bougé ([TP 4, étapes 4 et 6](tp4/etape6-scenario-panne-rejeu.md)) |
| B9 | **Une règle métier se change sans toucher au cas d'utilisation.** | La Stratégie `SeuilRelatifAvecMinimum` supprime le faux bouchon de nuit (un bus à l'arrêt à 03:00) et le double signalement de 08:00 et 08:32. `service.ts` n'a pas changé ([`patronsTrafic.test.ts`](../test/patronsTrafic.test.ts)) |

### 2.2 Les contraintes, et ce qu'elles ont coûté

| # | Contrainte | Ce qu'elle a coûté |
|---|---|---|
| C1 | **Il y a plus de code autour du centre que dans le centre.** | Trafic : **326** lignes d'adaptateurs pour 226 de centre. Notifications : 172 pour 155. Il faut un adaptateur en mémoire **par port** pour les tests, et un test de contrat par port réel : **61** lignes de contrat pour un adaptateur de 31 ([TP 2, étape 6](tp2-etape6-remplacement-adaptateur.md)) |
| C2 | **Le chemin d'un appel est plus long à lire.** | Un signalement traverse le port, le réessai, le coupe-circuit, puis l'adaptateur : **4 fichiers** pour un seul `publier()`. Les trois racines de composition font 109 lignes et lisent **7 variables d'environnement** (`PORT`, `REGLE`, `BASE_RELEVES`, `BASE_NOTIFICATIONS`, `URL_SIGNALEMENTS`, `KAFKA_BROKERS`, `KAFKA_GROUPE`). Il faut toutes les documenter, sinon personne ne sait ce qui tourne en production |
| C3 | **Un appel par le réseau est lent, et il peut échouer à moitié.** | Un appel de fonction prend environ 1 µs, un appel HTTP local environ 1 ms : **plus de 1 000 fois plus lent** ([TP 3, étape 3](tp3/etape3-tableau-comparatif.md)). Notifications coupé, le capteur attend **7,54 s** puis reçoit 500, alors que son relevé est déjà en base ([trace](tp4/trace-etape6.txt)) |
| C4 | **Le réessai et Kafka obligent à l'idempotence, et elle a touché le centre.** | Le contrat du port `Historique` a changé (`enregistrer(): boolean`, `retirer()`), avec 30 lignes ajoutées dans `ports.ts` et `service.ts` (commit `e04d6e8`). **Une fenêtre reste ouverte** : si le processus meurt entre la réservation et l'envoi, l'incident est perdu (« au plus une fois ») ([TP 4, étape 4](tp4/etape4-idempotence.md), § 4) |
| C5 | **En HTTP, un signalement perdu pendant la panne n'est pas rattrapé.** | Il n'est renvoyé qu'au relevé suivant, plus de 30 s après, et avec un début **faussé** : 09:04 au lieu de 09:02 ([TP 4, étape 6](tp4/etape6-scenario-panne-rejeu.md)). Il faudrait une boîte d'envoi, que je n'ai pas écrite |
| C6 | **Kafka ajoute une infrastructure à faire tourner.** | Une dépendance npm (`kafkajs`) ; 5 conteneurs ; **180** lignes de fichiers de déploiement et un script de scénario de 71 lignes. Il faut aussi des gestes d'exploitation : un rejeu n'est accepté que si le groupe est vide, ce qui m'a obligé à écrire un **arrêt propre** après un premier refus ([TP 4, étape 6](tp4/etape6-scenario-panne-rejeu.md)) |
| C7 | **Le contrat entre les deux services est implicite.** | Le signalement voyage en JSON, sans schéma versionné. Si Trafic renomme `vitesseMoyenne`, Notifications répond 422 en HTTP. Par Kafka, il **journalise et ignore** le message : l'incident est perdu **sans erreur visible chez Trafic**. Seul le test de bout en bout [`traficVersNotifications.test.ts`](../test/traficVersNotifications.test.ts) l'attraperait. Il tourne dans `npm test`, mais **seulement parce que les deux services sont dans le même dépôt** : il importe le code des deux. Et il ne couvre que HTTP : aucun test n'enchaîne la publication Kafka de Trafic et l'entrée Kafka de Notifications |
| C8 | **Le découpage pèse lourd pour transporter un message.** | Le TP 4, hors documentation et `package-lock.json`, c'est **1 344 lignes ajoutées dans 36 fichiers** (`git diff --shortstat bbca6ce 0996b1a`). Le besoin métier tient pourtant en une phrase : prévenir les opérateurs d'un bouchon |
| C9 | **L'environnement coûte du temps, hors de tout code métier.** | Docker Desktop arrêté ; chemins `/opt/kafka` réécrits par Git Bash (`MSYS_NO_PATHCONV=1`) ; images sans `kafkajs` (`npm ci --omit=dev`) ; volume non inscriptible (`chown`). Ce sont **4 problèmes** à l'étape 6, et aucun ne concernait la règle de congestion ([défis du TP 4](../README.md#les-défis-rencontrés-et-leurs-solutions)) |

### 2.3 Ce que je retiens

- **L'hexagone a rapporté là où la technique changeait** : la base au TP 2 (B2), le transport au
  TP 4 (B3, B4). À chaque fois, le changement est resté dans les adaptateurs et la racine.
- **Le centre a changé quand le besoin a changé** : l'idempotence (C4) est une règle de
  Notifications, pas une technique. L'hexagone ne protège pas de cela, et ce n'est pas son rôle.
- **Les coûts les plus lourds viennent du découpage en services, pas de l'hexagone** (C3, C5 à
  C9). Cela confirme la conclusion du TP 3 : un monolithe hexagonal tant qu'aucun signal ne
  justifie de payer ce prix.

---

## 3. Comparaison avec Segment, et trois recommandations

### 3.1 Pourquoi Segment, et pas Prime Video

Le cours (5.1) présente deux équipes revenues des microservices. Je compare avec **Segment**
(A. Noonan, 10/07/2018), parce que son système fait **la même chose que le mien** : il envoie des
événements vers des destinations. Trafic envoie des signalements à Notifications.

**Prime Video** (R. Gancarz, InfoQ, 03/05/2023) résout un autre problème. Ses deux coûts venaient
de son outillage et de son volume :
- l'orchestrateur, AWS Step Functions, coûtait à chaque transition ;
- le stockage intermédiaire des images vidéo coûtait à chaque passage.

Je n'ai ni orchestrateur, ni fonctions sans serveur, ni gros volume de données (3 tronçons). La
comparaison n'aurait rien appris.

### 3.2 Segment et UrbanHub, ligne à ligne

| | Segment (2018) | UrbanHub (TP 2 à 4) |
|---|---|---|
| **Le système** | des événements (clic, achat) envoyés à plus d'une centaine de destinations partenaires | des signalements de congestion envoyés à **une** destination (Notifications). Un second lecteur, `audit`, lit tout sans agir |
| **Le découpage d'origine** | un service et **une file par destination** : plus de 140 services | un service par contexte (Trafic, Notifications), et **un seul journal** (le topic `signalements`) avec **un groupe par lecteur** (`notifications`, `audit`). Ajouter une destination, c'est ajouter un groupe, **pas** une file ni un service de transport |
| **Ce qui a coincé : les bibliothèques en versions différentes** | chaque service avait sa version des bibliothèques communes | **pas rencontré**, mais pour une raison précise : un seul `package.json`, un seul `package-lock.json`, donc une seule version de `kafkajs` pour les deux services. C'est **déjà** la forme vers laquelle Segment est revenu : un seul dépôt |
| **Ce qui a coincé : une charge propre à chaque service** | chaque service avait son profil de charge, à régler un par un | **non mesuré** : 3 tronçons. La seule charge observée est celle d'une **panne** : sans coupe-circuit, 30 requêtes contre un service figé (B7) |
| **Ce qui a coincé : l'exploitation** | **trois ingénieurs** absorbés par la seule exploitation | à mon échelle, le même phénomène : **4 problèmes d'environnement** à l'étape 6, aucun lié au métier (C9) ; 5 conteneurs, 180 lignes de déploiement (C6) ; 1 344 lignes pour transporter un message (C8). Et ce, pour **2** services. Segment en avait plus de 140 |
| **La décision** | un seul service, un seul dépôt | au TP 3, **la même** : un monolithe hexagonal, un seul dépôt ; découper seulement à un signal mesuré. Le TP 4 a exercé ce découpage sans changer cette conclusion |
| **Ce qu'ils ont perdu** | **l'isolement des pannes** : un défaut touche toutes les destinations | c'est exactement ce que le découpage m'a **apporté** (B7) : Notifications coupé, Trafic répond en 0,06 s avec Kafka et ne s'acharne plus en HTTP. Dans un monolithe, je le perdrais à mon tour |

**Ce que la comparaison m'apprend.**
1. **Le coût de Segment est un coût par service**, multiplié par 140. Mon coût par service est déjà
   visible avec 2 services (C6, C8, C9). Il n'y a aucune raison qu'il soit plus petit ailleurs.
2. **Le journal partagé évite le piège d'origine de Segment**, une file et un service **par
   destination**. Avec Kafka, une destination de plus est un groupe de plus. Ses offsets sont les
   siens, et son rejeu ne touche pas les autres (B8).
3. **L'isolement des pannes ne demande pas forcément des services séparés.** Mes deux Décorateurs
   (réessai borné, coupe-circuit) enveloppent un port. Ils protégeraient tout aussi bien un
   adaptateur **à l'intérieur** d'un monolithe, par exemple l'appel au fournisseur de SMS. Cela
   réduit ce que Segment a perdu en revenant au monolithe. Cela ne supprime pas la panne qui
   emporte tout le processus.
4. **Les deux équipes disent qu'il faut mesurer** ce que rapporte le découpage. C'est ce que font
   les 5 signaux observables du [TP 3](tp3/etape6-conclusion.md).

### 3.3 Trois recommandations pour un futur projet UrbanHub

#### R1. Commencer en monolithe hexagonal, dans un seul dépôt, et découper sur un signal mesuré

| | |
|---|---|
| **La recommandation** | Un processus, un dépôt, un hexagone par contexte délimité. Entre deux hexagones, toujours un **port**, jamais un appel direct. On sort un service seulement quand l'un des signaux du TP 3 est atteint : une panne d'un hexagone en arrête un autre, une équipe bloquée, une charge différente, une disponibilité différente ou une autre technologie |
| **La raison** | Les coûts du découpage arrivent dès le 2ᵉ service (C3, C6, C8, C9). Segment les a payés 140 fois avant de revenir. L'hexagone rend le découpage **peu coûteux le jour venu** : Trafic était déjà prêt à sortir (B6), et un changement de transport ne touche pas le centre (B3) |
| **Le prix** | L'isolement des pannes (ce que Segment a perdu). Une exception non rattrapée dans un hexagone arrête tous les autres. On l'atténue avec les Décorateurs autour des ports risqués (3.2, point 3) et par le signal n° 1 du TP 3, qui déclenche la sortie au premier incident |
| **Preuve** | B3, B6 ; [TP 3, étape 6](tp3/etape6-conclusion.md) ; `git diff --stat e04d6e8 646ba3a` vide sur les centres |

#### R2. Pour envoyer des événements : un journal, un groupe par lecteur, des lecteurs idempotents, et un topic d'erreurs

| | |
|---|---|
| **La recommandation** | Quand un événement a plusieurs destinations, on publie **une fois** dans un journal (Kafka), avec un groupe par lecteur, et **pas** une file ni un service par destination comme Segment au départ. Chaque lecteur est idempotent, avec un identifiant **tiré du fait métier**, comme `troncon:debut`. Un message illisible part dans un **topic d'erreurs** (une « lettre morte »), au lieu d'être seulement journalisé |
| **La raison** | Trafic publie sans attendre son lecteur, et le message survit à la panne (B7 ; à comparer avec C5 en HTTP). L'idempotence rend le rejeu sans danger (B8). Le topic d'erreurs corrige C7 : aujourd'hui, un message illisible est **ignoré**, donc l'incident est perdu sans bruit. Avec le topic d'erreurs, il resterait visible et rejouable une fois le lecteur corrigé |
| **Le prix** | Un broker à exploiter (C6) ; l'idempotence dans chaque lecteur, et sa fenêtre résiduelle (C4) ; un topic de plus, avec quelqu'un qui le surveille. **Dans le monolithe de R1**, on commence sans Kafka : le port `PublicateurSignalements` a un adaptateur en processus, et l'adaptateur Kafka existe déjà pour le jour du découpage |
| **Preuve** | [trace de l'étape 6](tp4/trace-etape6.txt) : 202 en 0,06 s pendant la panne, rejeu sans notification de plus ; [`entreeKafkaNotifications.test.ts`](../test/entreeKafkaNotifications.test.ts) pour le message illisible ignoré |

#### R3. Rendre explicite le contrat entre contextes, et le tester des deux côtés

| | |
|---|---|
| **La recommandation** | Le format du signalement devient un **fichier de contrat versionné** (un schéma JSON, avec un champ `version`). Deux tests le vérifient : côté Trafic, « ce que je publie respecte le schéma » ; côté Notifications, « je sais traduire tout message conforme au schéma ». Ces tests remplacent la dépendance au test de bout en bout, qui importe le code des deux services |
| **La raison** | C7 : aujourd'hui, le contrat n'est vérifié que parce que les deux services partagent un dépôt, et seulement en HTTP. Le jour où Notifications a son propre dépôt, ou une autre équipe, ce filet disparaît. Segment rappelle l'autre face du même problème : des versions qui divergent entre services. Un contrat versionné dit **quelle** version chaque côté parle |
| **Le prix** | Un fichier de schéma à maintenir ; deux tests de plus par paire de contextes ; une règle d'évolution à respecter : ajouter un champ est permis, renommer ou supprimer demande une nouvelle version, et l'ancienne reste lue pendant la transition |
| **Preuve** | C7 ; [`traficVersNotifications.test.ts`](../test/traficVersNotifications.test.ts), qui importe `urbanhub-trafic/` **et** `urbanhub-notifications/` ; aucun test n'enchaîne `publicationKafka.ts` et `entreeKafka.ts` |

**Les trois tiennent ensemble.**
- R1 dit **quand** découper.
- R2 dit **comment** les services se parlent une fois découpés.
- R3 dit **ce qui** protège le contrat quand ils ne partagent plus de dépôt.

---

## 4. La grille EC01 : ce que mes TP prouvent déjà pour C4.1 et C5.1

**L'épreuve.** L'EC01, « Conception et modélisation d'architecture logicielle », valide le bloc
BC01.
- C'est une mise en situation écrite et orale, individuelle : 3 heures, seul, surveillé.
- Rien n'est fourni : je pars de **mon dépôt UrbanHub**.
- La grille compte 11 critères, notés 0, 2, 3 ou 5. Ce module y apporte deux critères :
  - **C4.1** « Adéquation aux besoins et contraintes projet » ;
  - **C5.1** « Argumentation technique (performance, sécurité, maintenabilité) ».

**Ce qui compte : la justification.** Un choix sans raison écrite ne rapporte pas de point. J'ai
donc lu chaque ligne ci-dessous avec les règles du cours :
- un choix, une raison ;
- une preuve par affirmation ;
- le coût écrit à côté.

La dernière colonne dit ce que mes TP **ne prouvent pas encore**. C'est ce que le dossier de
l'EC01 devra écrire ou ajouter.

### 4.1 C4.1 : adéquation aux besoins et contraintes projet

| Ce qu'on attend | Ce que mes TP prouvent déjà | Où | Ce qui manque |
|---|---|---|---|
| **Le besoin est écrit, et vérifiable** | La règle de congestion tient en une phrase, avec un exemple chiffré : 08:00 à 08:30 sur `boulevard-voltaire-3`. Cet exemple est **devenu un test** | [TP 2, étape 1](tp2-etape1-choix-du-service.md) ; [`trafic.test.ts`](../test/trafic.test.ts) : « l'exemple de l'étape 1 : un seul signalement, à 08:10, moyenne 18,33 » | Un besoin **non fonctionnel chiffré**, venu d'un client : délai maximal pour prévenir un opérateur, disponibilité attendue. Je les ai déduits, personne ne les a demandés |
| **Le besoin « une seule fois » est tenu, même dans les cas difficiles** | Un seul signalement par épisode, même après un **redémarrage**. Un seul message aux opérateurs, même en cas de **doublon**, d'envoi **simultané** ou de **rejeu** | [`contratEtatsTroncons.test.ts`](../test/contratEtatsTroncons.test.ts) (redémarrage) ; commit `197c622` ; [`idempotenceNotifications.test.ts`](../test/idempotenceNotifications.test.ts) ; [trace du rejeu](tp4/trace-etape6.txt) | La perte possible si le processus meurt entre la réservation et l'envoi (C4) : elle est écrite et acceptée, mais **non testée** |
| **L'architecture est choisie d'après le besoin**, pas par habitude | Le service passe les trois questions du cours (1.4) **avant** d'être écrit en hexagone. | [TP 2, étape 1](tp2-etape1-choix-du-service.md), « Pourquoi ce service mérite un hexagone » | — |
| **Le découpage est choisi d'après les contraintes du projet** | Le monolithe hexagonal est retenu pour 3 tronçons, un groupe de 3 ou 4 personnes et SQLite. C'est mesuré, pas affirmé : 1 µs contre 1 ms par appel, et les pannes partielles mesurées | [TP 3, étapes 3 et 6](tp3/etape6-conclusion.md) | — |
| **On sait quand le choix cessera d'être adapté** | **5 signaux observables**, chacun avec son seuil et ce qu'on ferait. Plus un signal inverse : quand regrouper | [TP 3, étape 6](tp3/etape6-conclusion.md), § 2 | Les métriques de ces signaux (95ᵉ centile, incidents) ne sont **pas encore produites** par le code |
| **Les contraintes techniques du projet sont respectées** | Même langage que l'existant (TypeScript sous Node.js). Aucune dépendance, sauf `kafkajs`, choisi parce qu'il s'installe sans outil de compilation sur les postes Windows. Un seul dépôt, comme l'a demandé l'enseignant | [TP 4, étape 5](tp4/etape5-adaptateur-kafka.md), § 1 ; [`package.json`](../package.json) | — |
| **Le déploiement est adapté aux contraintes** | La stratégie par **recréation** est choisie **à cause** de SQLite : un seul fichier, donc une seule copie. Son prix est écrit : environ 10 s de coupure | [TP 3, étape 5](tp3/etape5-deploiement-et-manifeste.md) ; [`k8s/trafic.yaml`](../k8s/trafic.yaml) | Le manifeste n'a **pas été appliqué** sur un vrai cluster. Seul `docker compose` a tourné (TP 4, étape 6) |

### 4.2 C5.1 : argumentation technique

#### Performance

| Ce que mes TP prouvent déjà | Où | Ce qui manque |
|---|---|---|
| Le coût du réseau, **mesuré** : un appel de fonction prend environ 1 µs, un appel HTTP local environ 1 ms | [TP 3, étape 3](tp3/etape3-tableau-comparatif.md), [`experience-etape3.ts`](tp3/experience-etape3.ts) | — |
| Le pire cas en HTTP : **7,54 s** puis 500 pour le capteur quand Notifications est coupé. Le coupe-circuit le ramène à 0 ms, avec 5 requêtes au lieu de 30 | [trace](tp4/trace-etape6.txt) ; [TP 4, étape 3](tp4/etape3-reessai-et-coupe-circuit.md) | — |
| Kafka découple le temps de réponse du capteur de la santé du lecteur : **202 en 0,06 s** pendant la panne | [TP 4, étape 6](tp4/etape6-scenario-panne-rejeu.md) | — |
| La base est indexée pour la requête de la fenêtre, avec l'index `releve (troncon, horodatage)` | [`depotSqlite.ts`](../urbanhub-trafic/src/adaptateurs/depotSqlite.ts) | Un index **affirmé**, pas mesuré |
| La limite est identifiée : **SQLite** bloque la montée en charge, dans les deux dessins | [TP 3, étape 3](tp3/etape3-tableau-comparatif.md), § 3 | **Aucun test de charge** : ni débit maximal, ni 95ᵉ centile. Le signal n° 3 du TP 3 repose pourtant sur un seuil de 200 ms au 95ᵉ centile |

#### Sécurité

| Ce que mes TP prouvent déjà | Où | Ce qui manque |
|---|---|---|
| **Les entrées sont validées dans le domaine** : un relevé ou un signalement mal formé est refusé en 422, et rien n'est enregistré | [`domaine.ts`](../urbanhub-trafic/src/domaine.ts) (`ReleveInvalide`) ; [`entreeNotifications.test.ts`](../test/entreeNotifications.test.ts) | — |
| **Pas d'injection SQL** : toutes les requêtes sont préparées, avec des paramètres `?`. Aucune n'est construite par concaténation | les 3 adaptateurs SQLite | Pas de test qui le **prouve** (une entrée piégée, par exemple) |
| **Une erreur 500 ne divulgue rien** : la réponse est vide, et le détail ne va qu'au journal | [`entreeHttp.ts`](../urbanhub-trafic/src/adaptateurs/entreeHttp.ts) | — |
| **Les conteneurs ne tournent pas en root** (`USER node`). L'image ne contient pas les dépendances de développement (`npm ci --omit=dev`). La configuration est montée en lecture seule dans Kubernetes, et la mémoire est plafonnée (256 Mi) | [`Dockerfile.trafic`](../Dockerfile.trafic), [`Dockerfile.notifications`](../Dockerfile.notifications), [`k8s/trafic.yaml`](../k8s/trafic.yaml) | — |
| **La surface des dépendances est minimale** : 1 paquet en production, et `npm audit` ne signale aucune vulnérabilité | [`package.json`](../package.json) | — |
| — | — | **Aucune authentification** sur `POST /releves` ni sur `POST /signalements`. N'importe quel poste du réseau peut faire prévenir les opérateurs |
| — | — | **Le corps des requêtes est lu sans limite de taille** (`lireCorps`) : un envoi énorme peut épuiser la mémoire |
| — | — | **Kafka en clair** (`PLAINTEXT`), sans TLS ni droits par topic : n'importe qui peut écrire dans `signalements` |

#### Maintenabilité

| Ce que mes TP prouvent déjà | Où | Ce qui manque |
|---|---|---|
| Remplacer un adaptateur ne touche que **2 fichiers** | commit `197c622` | — |
| Passer de HTTP à Kafka ne touche **aucun** centre, et les Décorateurs servent tels quels | `git diff --stat e04d6e8 646ba3a` (partie 2, B3 et B4) | — |
| La règle de dépendance est **vérifiée par un test**, et elle attrape une faute volontaire | [`regleDependanceTrafic.test.ts`](../test/regleDependanceTrafic.test.ts), [`regleDependanceNotifications.test.ts`](../test/regleDependanceNotifications.test.ts) | — |
| Les adaptateurs réels sont jugés par des **tests de contrat**, sur les mêmes cas que leur version en mémoire | [`contratDepotReleves.test.ts`](../test/contratDepotReleves.test.ts), [`contratEtatsTroncons.test.ts`](../test/contratEtatsTroncons.test.ts), [`contratHistorique.test.ts`](../test/contratHistorique.test.ts) | — |
| Une règle métier se change par une **nouvelle classe** (Stratégie) | [`patronsTrafic.test.ts`](../test/patronsTrafic.test.ts) | — |
| Chaque étape a son commit et sa fiche ; 127 tests en environ 2,2 s | `git log` ; `docs/` | — |
| — | — | **Le contrat entre services** n'est ni écrit ni versionné (C7, recommandation R3) |
| — | — | Les 7 variables d'environnement ne sont **documentées nulle part** en un seul endroit (C2) |

### 4.3 Le bilan pour l'EC01

| Critère | Ce qui est solide | Ce qu'il faut ajouter avant l'épreuve, ou au moins écrire comme limite |
|---|---|---|
| **C4.1** | le besoin devenu test ; un découpage et un déploiement choisis d'après les contraintes ; des signaux pour changer d'avis | les besoins non fonctionnels chiffrés ; le manifeste jamais appliqué |
| **C5.1, performance** | des mesures, pas des impressions | un test de charge, même petit |
| **C5.1, sécurité** | la validation, les requêtes préparées, le non-root, une seule dépendance | **le point le plus faible** : pas d'authentification, pas de limite de taille, Kafka en clair |
| **C5.1, maintenabilité** | **le point le plus fort** : chaque affirmation a son commit ou son test | le contrat entre services ; la liste des variables d'environnement |

**La sécurité n'a été demandée par aucun des TP 2 à 4.** Elle n'apparaît donc que par effet de
bord. Le plan du dossier (question 5) devra la traiter comme une partie à part entière, avec ses
manques écrits et leur prix.
