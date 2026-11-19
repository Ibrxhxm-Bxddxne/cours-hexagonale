# TP 4, étape 6 : les deux services et Kafka, en vrai. Le scénario, la panne, le rejeu

**Consigne :**
- lancer les deux services et Kafka (`docker compose up`) ;
- jouer un scénario complet, de la mesure à l'alerte reçue ;
- couper le second service et noter ce qui se passe en HTTP et par Kafka ;
- rejouer un groupe depuis le début du topic, et montrer que l'idempotence tient (aucune alerte en
  double).

**Comment rejouer :**

```bash
docker compose -f compose.tp4.yaml up -d --build      # Docker Desktop doit être démarré
bash docs/tp4/scenario-etape6.sh                      # depuis Git Bash, à la racine du dépôt
docker compose -f compose.tp4.yaml down -v            # pour repartir de zéro (-v : efface les bases)
```

La trace complète est dans [`trace-etape6.txt`](trace-etape6.txt). Elle a été produite sur une
pile **neuve** (`down -v`, puis `up --build`). Les extraits ci-dessous en viennent tels quels.

---

## 1. La pile : [`compose.tp4.yaml`](../../compose.tp4.yaml)

`compose.yaml` reste celui du cours (Qualité de l'air et Alertes). Le nôtre est à côté.

| Service | Image | Rôle | Sa base |
|---|---|---|---|
| `kafka` | `apache/kafka:4.0.0` | un broker, KRaft (sans ZooKeeper), comme le cours. Un *healthcheck* fait attendre les autres services | — |
| `trafic` | [`Dockerfile.trafic`](../../Dockerfile.trafic) | Trafic qui publie **par Kafka** (`KAFKA_BROKERS`), port 8003 | volume `releves-kafka` |
| `trafic-http` | la même image | **le même** Trafic, publié **en HTTP** vers Notifications, port 8013, pour comparer les pannes | volume `releves-http` |
| `notifications` | [`Dockerfile.notifications`](../../Dockerfile.notifications) | groupe Kafka `notifications`, **et** entrée HTTP `/signalements`, port 8004 | volume `notifications` |
| `audit` | la même image, `audit.ts` | le second groupe Kafka, `audit` | — |

**Ce qu'il a fallu changer pour que la pile tourne :**

| Fichier | Changement | Pourquoi |
|---|---|---|
| `Dockerfile.trafic` (TP 3) | `COPY package-lock.json` et `RUN npm ci --omit=dev` | depuis l'étape 5, Trafic a besoin de `kafkajs`. L'image du TP 3 ne l'avait pas |
| les deux Dockerfiles | `RUN mkdir /donnees && chown node:node /donnees` | le processus tourne en `USER node`. Un volume créé par Docker appartiendrait à root, et SQLite ne pourrait pas y écrire |
| [`.dockerignore`](../../.dockerignore) | nouveau | `node_modules` (installé pour Windows), `.git`, les `*.db` locaux, `docs` et `test` n'entrent pas dans les images |

### Le topic et les groupes, vus par Kafka

```
Topic: signalements   PartitionCount: 3   ReplicationFactor: 1
  groupe : audit
  groupe : notifications
```

Les réglages demandés à l'étape 5 sont bien en place : **3 partitions**, **deux groupes**.

---

## 2. Le scénario complet, de la mesure à l'alerte reçue (par Kafka)

Trafic utilise la règle `avec-minimum` : il faut **3 relevés lents en 15 min**. On envoie 3 relevés
sur Rivoli et 3 sur Voltaire :

```
  rue-de-rivoli-1 10 km/h a 08:00 -> 202 en 0.061718 s
  rue-de-rivoli-1 8 km/h a 08:05 -> 202 en 0.036261 s
  rue-de-rivoli-1 9 km/h a 08:10 -> 202 en 0.120845 s
  boulevard-voltaire-3 15 km/h a 08:00 -> 202 en 0.035192 s
  boulevard-voltaire-3 12 km/h a 08:05 -> 202 en 0.034366 s
  boulevard-voltaire-3 10 km/h a 08:10 -> 202 en 0.073895 s
  -- journal de Notifications (groupe notifications)
  recu rue-de-rivoli-1:2026-11-19T08:10:00 (partition 0 offset 0)
  NOTIFICATION rue-de-rivoli-1:2026-11-19T08:10:00 [trafic] rue-de-rivoli-1 : circulation a 9 km/h pour 30 km/h autorises (depuis 08:10)
  recu boulevard-voltaire-3:2026-11-19T08:10:00 (partition 1 offset 0)
  NOTIFICATION boulevard-voltaire-3:2026-11-19T08:10:00 [trafic] boulevard-voltaire-3 : circulation a 12 km/h pour 50 km/h autorises (depuis 08:10)
  -- journal d'audit (groupe audit : partition, offset, cle)
  [audit] partition 0 offset 0 cle rue-de-rivoli-1 : {"troncon":"rue-de-rivoli-1","vitesseMoyenne":9,...
  [audit] partition 1 offset 0 cle boulevard-voltaire-3 : {"troncon":"boulevard-voltaire-3",...
  lignes dans incident : 2
```

**Ce qu'on lit :**
- **Le trajet complet :** relevé HTTP → règle (la 3ᵉ mesure lente déclenche) → topic → groupe
  `notifications` → opérateurs → base `notifications.db`.
- **Les partitions sont celles prédites à l'étape 5** par le partitionneur de kafkajs : Rivoli en
  partition **0**, Voltaire en partition **1**. La clé (le tronçon) choisit la partition.
- **Les deux groupes lisent chacun tous les messages**, avec leurs propres offsets : après le
  scénario, `CURRENT-OFFSET` vaut 1 sur les partitions 0 et 1, dans les deux groupes.
- Trafic répond en **moins de 0,13 s**, même quand il publie : l'envoi à Kafka n'attend que
  l'accusé du broker, pas Notifications.

---

## 3. La panne : Notifications coupé

`docker compose stop notifications`, puis des relevés lents sur le périphérique, envoyés aux deux
Trafic.

### En HTTP (`trafic-http`)

```
  peripherique-porte-maillot 20 km/h a 09:00 -> 202 en 0.048398 s
  peripherique-porte-maillot 20 km/h a 09:01 -> 202 en 0.040754 s
  peripherique-porte-maillot 20 km/h a 09:02 -> 500 en 7.539036 s
  peripherique-porte-maillot 20 km/h a 09:03 -> 500 en 5.532129 s
```

| Relevé | Ce qui se passe | Durée |
|---|---|---|
| 09:00 et 09:01 | moins de 3 relevés lents : pas de conclusion, rien à publier | 0,05 s |
| **09:02** | 3ᵉ relevé lent : il faut publier. Dans le réseau Docker, un conteneur arrêté ne **refuse** pas la connexion, il ne **répond pas**. Donc 3 essais × **délai 2 s** + pauses 0,5 et 1 s | **7,54 s**, puis **500** |
| **09:03** | essais 4 et 5 (2 × 2 s, plus 0,5 et 1 s de pause) : le **coupe-circuit s'ouvre** au 5ᵉ échec, et le 3ᵉ essai reçoit `CircuitOuvert` | **5,53 s**, puis **500** |

On voit les deux Décorateurs de l'étape 3, en vrai. Le journal de `trafic-http` contient une
`TimeoutError` (le délai) et un `CircuitOuvert`.

**Le signalement n'est pas parti.** Le tronçon reste « fluide » côté Trafic, qui retentera au
relevé suivant.

### Par Kafka (`trafic`)

```
  peripherique-porte-maillot 20 km/h a 09:00 -> 202 en 0.030870 s
  peripherique-porte-maillot 20 km/h a 09:01 -> 202 en 0.027242 s
  peripherique-porte-maillot 20 km/h a 09:02 -> 202 en 0.060305 s
  -- le message attend dans le topic (LAG du groupe notifications)
  notifications signalements 0 1 2 1
```

Trafic **ne voit pas la panne** : 202 en 0,06 s. Le signalement est dans le topic, et le groupe
`notifications` a un **retard (LAG) de 1** sur la partition 0.

### Notifications revient

```
  -- on relance Notifications
  recu peripherique-porte-maillot:2026-11-19T09:02:00 (partition 0 offset 1)
  NOTIFICATION peripherique-porte-maillot:2026-11-19T09:02:00 [...] (depuis 09:02)
  -- en HTTP, le signalement n'est pas parti ; il repartira au prochain releve, circuit referme (> 30 s)
  peripherique-porte-maillot 20 km/h a 09:04 -> 202 en 0.206367 s
  recu peripherique-porte-maillot:2026-11-19T09:04:00
  NOTIFICATION peripherique-porte-maillot:2026-11-19T09:04:00 [...] (depuis 09:04)
```

### Le bilan de la panne

| | HTTP | Kafka |
|---|---|---|
| Ce que voit le capteur pendant la panne | **500**, après 7,5 s puis 5,5 s ; ensuite des refus immédiats (circuit ouvert) | **202** en moins de 0,1 s |
| Où est le signalement pendant la panne | **nulle part** : il n'existe que si un nouveau relevé le recalcule | **dans le topic**, gardé (LAG = 1) |
| Quand les opérateurs sont prévenus | au premier relevé **après** la fermeture du circuit (plus de 30 s plus tard), **et seulement si** un relevé arrive | **dès** le redémarrage de Notifications, sans relevé de plus |
| L'heure de début annoncée | **09:04** : l'épisode a commencé à 09:02, mais le signalement a été recalculé à 09:04 | **09:02** : l'heure juste |
| Ce qu'il a fallu pour tenir | délai, réessai, coupe-circuit (étape 3) | un broker de plus à faire tourner |

**C'est le tableau du cours (slide 93), vérifié sur notre code** : en HTTP, « l'appel échoue :
réessai, coupe-circuit » ; avec un journal, « le message reste, et le lecteur reprend là où il en
était ». Nous ajoutons ce que le tableau ne disait pas : en HTTP, l'**heure** de l'incident est
faussée de 2 minutes.

---

## 4. Le rejeu : le groupe `notifications` relit le topic depuis le début

```
  etat du groupe notifications apres l'arret : Empty (Kafka n'accepte le rejeu que si le groupe est vide)
  GROUP          TOPIC          PARTITION  NEW-OFFSET
  notifications  signalements   1          0
  notifications  signalements   0          0
  notifications  signalements   2          0
  -- journal de Notifications apres le rejeu
  doublon ignore boulevard-voltaire-3:2026-11-19T08:10:00 (partition 1 offset 0)
  doublon ignore rue-de-rivoli-1:2026-11-19T08:10:00 (partition 0 offset 0)
  doublon ignore peripherique-porte-maillot:2026-11-19T09:02:00 (partition 0 offset 1)
  -- lignes NOTIFICATION dans le journal : 4 avant le rejeu, 4 apres
  -- le groupe audit n'a pas bouge
  audit signalements 0 2 2 0
  lignes dans incident : 4
```

**L'idempotence tient.**
- Les **3** messages du topic sont relus, et **tous** sont reconnus comme des doublons.
- **Aucune** notification de plus : 4 avant, 4 après.
- **Aucune** ligne de plus en base : 4.

La reconnaissance vient de l'historique **en base** (étape 4). Le conteneur `notifications` a été
arrêté et relancé deux fois pendant le scénario : un ensemble gardé en mémoire aurait tout oublié.

**Le rejeu d'un groupe ne touche pas l'autre** : les offsets du groupe `audit` n'ont pas bougé.

**4 incidents en base pour 3 messages dans le topic.** Le 4ᵉ est celui du périphérique arrivé
**en HTTP** à 09:04. Il n'est jamais passé par Kafka : le rejeu ne peut donc pas le revoir.

---

## 5. Les défis rencontrés, et leurs solutions

C'est ce que le TP demande d'écrire dans le README (étape 7).

| # | Défi | Ce qui s'est passé | Solution | Où |
|---|---|---|---|---|
| 1 | **Rejouer un groupe** que l'on vient d'arrêter | 1ᵉʳ essai : `Error: Assignments can only be reset if the group 'notifications' is inactive, but the current state is Stable`. Le processus avait été **tué** sans quitter son groupe : Kafka le croyait vivant jusqu'à la fin de sa session | **arrêt propre** : sur `SIGTERM`, le consommateur appelle `disconnect()` et **quitte le groupe**. Le groupe passe aussitôt à `Empty`, et le rejeu est accepté (2ᵉ essai, ci-dessus) | [`principal.ts`](../../urbanhub-notifications/src/principal.ts), [`audit.ts`](../../urbanhub-notifications/src/audit.ts) |
| 2 | Un service ne trouve pas Kafka au démarrage | Trafic **refuse de démarrer** sans broker (étape 5) | `healthcheck` sur Kafka, `depends_on: service_healthy`, et `restart: on-failure` | `compose.tp4.yaml` |
| 3 | L'image ne contient pas `kafkajs` | l'image du TP 3 ne copiait que le code | `npm ci --omit=dev` depuis `package-lock.json` : la version exacte, sans les outils de développement | `Dockerfile.trafic`, `Dockerfile.notifications` |
| 4 | SQLite ne peut pas écrire dans le volume | `USER node`, mais un volume Docker appartient à root | `mkdir /donnees && chown node:node /donnees` avant `VOLUME` | les deux Dockerfiles |
| 5 | En HTTP, un service **arrêté** coûte 7,5 s par relevé | dans le réseau Docker, la connexion ne reçoit pas de refus : elle attend | le **délai** de 2 s, puis le **coupe-circuit** : 7,5 s, 5,5 s, puis des refus immédiats | étapes 2 et 3 |
| 6 | En HTTP, l'incident est **retardé et mal daté** après une panne | annoncé à 09:04 au lieu de 09:02 | **Kafka** : le signalement attend dans le topic, avec sa vraie heure | étape 5 |
| 7 | Un message relu (rejeu, offset pas validé) ne doit pas prévenir deux fois | 3 messages rejoués | **consommateur idempotent**, historique en base, clé `troncon:debut` | étape 4 |
| 8 | Un message illisible bloquerait sa partition | (prévenu, pas rencontré) | journalisé puis **ignoré**, jamais relevé comme erreur | étape 5 |
| 9 | Git Bash réécrit `/opt/kafka/bin/…` en `C:/Program Files/Git/opt/…` | `exec failed: … no such file or directory` | `export MSYS_NO_PATHCONV=1` en tête du script | `scenario-etape6.sh` |

**Un avertissement sans conséquence.** Les journaux de kafkajs contiennent des
`TimeoutNegativeWarning` : kafkajs 2.2.4 passe un délai négatif à `setTimeout`, et Node 24 le
signale. Node le remplace par 1 ms, et le comportement est correct (toute la trace le montre).
Le script les filtre.

---

## 6. Vérifications

| Vérification | Résultat |
|---|---|
| `npm test` après les changements de cette étape | **127 / 127** (l'arrêt propre ne touche que les racines de composition) |
| La pile, construite **à neuf** (`down -v`, puis `up --build`) | 5 conteneurs ; `kafka` *healthy* |
| Le scénario complet, de bout en bout | 2 notifications, partitions 0 et 1, deux groupes |
| La panne | HTTP : 7,54 s puis 5,53 s (500), circuit ouvert. Kafka : 202, LAG 1, notifié au retour |
| Le rejeu | 3 messages relus, 3 doublons, 0 notification de plus, groupe `audit` intact |

## Fichiers de cette étape

| Fichier | Nouveau ou modifié |
|---|---|
| `compose.tp4.yaml` | nouveau |
| `Dockerfile.notifications`, `.dockerignore` | nouveaux |
| `Dockerfile.trafic` | modifié : `npm ci`, dossier du volume |
| `urbanhub-notifications/src/principal.ts`, `audit.ts` | modifiés : arrêt propre sur `SIGTERM` |
| `docs/tp4/scenario-etape6.sh`, `docs/tp4/trace-etape6.txt`, ce document | nouveaux |
