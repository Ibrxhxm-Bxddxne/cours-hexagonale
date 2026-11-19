# TP 4, étape 5 : l'adaptateur de publication pour Kafka

**Consigne :**
- écrire un adaptateur de publication pour Kafka, sans toucher au cas d'utilisation ;
- régler un topic de 3 partitions, le capteur comme clé, et deux groupes de consommateurs.

---

## 1. Le choix de la bibliothèque : `kafkajs`, notre première dépendance

Jusqu'ici, le dépôt n'utilisait que la bibliothèque standard de Node. Or Node n'a pas de client
Kafka.

| Option | Verdict |
|---|---|
| **`kafkajs` 2.2.4** | **retenu** : du JavaScript pur, sans module natif à compiler (il s'installe sur Windows sans outil de compilation), 4 paquets en tout, 0 vulnérabilité signalée par `npm audit`. C'est celui que cite le cours (slide 91) |
| `@confluentinc/kafka-javascript` | plus rapide, mais il repose sur librdkafka, un module natif : il faut des outils de compilation sur chaque poste |
| Écrire le protocole Kafka à la main | non : des milliers de lignes, sans rapport avec le TP |

```powershell
npm install    # installe kafkajs, inscrit dans package.json et package-lock.json
```

`node_modules/` est ignoré par git (`.gitignore`). `package-lock.json` fige la version exacte.

**La dépendance reste à l'extérieur de l'hexagone.**
- `kafkajs` n'est importé que dans les **racines de composition** : les deux `principal.ts`, et
  `audit.ts`.
- Les adaptateurs reçoivent un **petit port technique** (`Producteur`, `Consommateur`,
  `Administration`) : le morceau de kafkajs dont ils ont besoin. C'est ce qui permet de les tester
  sans broker.
- La **règle de dépendance** est renforcée dans les deux services : tout import **non relatif**
  (un paquet npm) est désormais interdit dans le centre. Avant, la règle ne visait que `node:`
  et les adaptateurs : `import kafkajs from "kafkajs"` dans `service.ts` serait passé. Vérifié :
  avec un fichier fautif, la règle échoue ; sans lui, elle passe.

---

## 2. Côté Trafic : publier dans le topic

### L'adaptateur : [`publicationKafka.ts`](../../urbanhub-trafic/src/adaptateurs/publicationKafka.ts)

```ts
async publier(s: Signalement) {
  await this.#producteur.send({ topic: "signalements",
    messages: [{ key: s.troncon, value: JSON.stringify(s) }] });
}
```

| Réglage demandé | Chez nous | Pourquoi |
|---|---|---|
| **le capteur comme clé** | **le tronçon** comme clé | chez Trafic, l'objet mesuré est le tronçon (comme la clé d'idempotence, étape 4). Même tronçon, même partition : ses signalements restent **dans l'ordre** (cours, slides 89 et 93) |
| **un topic de 3 partitions** | `signalements`, 3 partitions, créé par [`kafkaTopic.ts`](../../urbanhub-trafic/src/adaptateurs/kafkaTopic.ts) au démarrage, s'il n'existe pas | écrit dans **le dépôt**, plutôt que laissé à la création automatique du broker. Le réglage `KAFKA_NUM_PARTITIONS: 3` de `compose.yaml` ne vaut que pour **ce** broker-là |
| la valeur | le signalement en JSON, **identifiant compris** | Notifications s'en sert pour l'idempotence |

### « Sans toucher au cas d'utilisation »

Le transport se choisit dans la racine de composition,
[`principal.ts`](../../urbanhub-trafic/src/principal.ts), et **seulement** là :

| Variable | Transport |
|---|---|
| `KAFKA_BROKERS` absente | HTTP vers Notifications, comme aux étapes 2 à 4 |
| `KAFKA_BROKERS=kafka:19092` | le topic Kafka |

Les **deux Décorateurs de l'étape 3** (réessai et coupe-circuit) enveloppent **le transport
choisi**, quel qu'il soit : ils n'ont pas changé non plus.

Le client kafkajs est réglé avec :
- `requestTimeout: 2000` : le **même délai de 2 s** qu'en HTTP ;
- `retry: { retries: 0 }` : le réessai, c'est **notre** Décorateur. Sinon, kafkajs et lui
  empileraient leurs essais.

`git diff` sur `domaine.ts`, `ports.ts`, `regles.ts` et `service.ts` des deux services est **vide**.

---

## 3. Côté Notifications : lire le topic, dans deux groupes

### Groupe 1 : `notifications`, qui agit

[`entreeKafka.ts`](../../urbanhub-notifications/src/adaptateurs/entreeKafka.ts) est un adaptateur
**primaire**. Il fait du message lu un appel du **même** cas d'utilisation que l'entrée HTTP, avec
la **même** traduction. Celle-ci a été déplacée dans
[`traductionTrafic.ts`](../../urbanhub-notifications/src/adaptateurs/traductionTrafic.ts) pour
être partagée par les deux entrées.

Le service a donc **deux entrées**, HTTP et Kafka : « toutes les entrées se valent » (cours,
slide 12). Il lit Kafka si `KAFKA_BROKERS` est défini, dans le groupe `KAFKA_GROUPE`
(`notifications` par défaut).

| Situation | Ce que fait l'adaptateur | Pourquoi |
|---|---|---|
| Message valide | appelle le cas d'utilisation ; journalise `recu … (partition P offset O)` | |
| **Message relu** (rejeu, ou offset pas encore validé) | `doublon ignore …` | l'idempotence de l'étape 4 |
| **Message illisible** (pas du JSON, champs manquants) | journalisé et **ignoré** | le relire ne le rendra jamais lisible. Lever une erreur bloquerait toute la partition sur ce message, pour toujours |
| **Opérateurs injoignables** | l'erreur **remonte** | kafkajs ne valide pas l'offset et **relira** le message. Sans risque, puisque le cas d'utilisation est idempotent |

C'est le pendant, côté Kafka, des codes HTTP de l'étape 2 :
- 422 (ne pas renvoyer) devient « ignoré » ;
- 500 (à retenter) devient « l'erreur remonte ».

### Groupe 2 : `audit`, qui lit tout et n'agit sur rien

[`audit.ts`](../../urbanhub-notifications/src/audit.ts) (`npm run audit`) lit **tous** les
messages du topic dans le groupe `audit`. Il écrit chacun avec sa partition, son offset et sa clé.

C'est le rôle du service Historique dans le cours (slide 89) : **un groupe par lecteur**. Chaque
groupe a ses propres offsets, et l'un ne retire rien à l'autre. À l'étape 6, il servira à
**montrer** les partitions et les clés dans les traces, et à rejouer un groupe sans toucher à
l'autre.

| Groupe | Programme | Agit ? | Offsets |
|---|---|---|---|
| `notifications` | `urbanhub-notifications/src/principal.ts` | oui : il prévient les opérateurs | les siens |
| `audit` | `urbanhub-notifications/src/audit.ts` | non : il journalise seulement | les siens |

---

## 4. Les tests, sans broker

### [`test/publicationKafkaTrafic.test.ts`](../../test/publicationKafkaTrafic.test.ts) (5 tests)

| Test | Ce qu'il prouve |
|---|---|
| l'envoi | topic `signalements`, clé `rue-de-rivoli-1`, valeur = le JSON avec l'identifiant |
| **la clé, avec le vrai partitionneur de kafkajs** | sur 3 partitions, chaque tronçon tombe **toujours** dans la même : `boulevard-voltaire-3` en partition 1 ; `rue-de-rivoli-1` et `peripherique-porte-maillot` en partition 0 |
| le topic | `createTopics` avec 3 partitions et une réplication de 1 (un seul broker en local) |
| broker injoignable | l'erreur remonte : le réessai fait ses 3 essais, et le coupe-circuit compte |
| **sans toucher au cas d'utilisation** | le **même** `SurveillanceTrafic` publie dans Kafka : un message par épisode, comme en HTTP |

**Remarque sur la répartition.** Avec 3 tronçons et 3 partitions, la partition 2 reste vide et la
partition 0 reçoit deux tronçons. Une clé choisit sa partition par un hachage, pas par une
répartition équitable. Avec des centaines de tronçons, l'écart se lisse.

### [`test/entreeKafkaNotifications.test.ts`](../../test/entreeKafkaNotifications.test.ts) (5 tests)

| Test | Ce qu'il prouve |
|---|---|
| message valide | une notification, le même texte qu'en HTTP, et un journal qui donne la partition et l'offset |
| le même message relu | `doublon`, pas de seconde notification |
| messages illisibles | `ignore`, sans exception : la partition n'est pas bloquée |
| opérateurs injoignables | l'erreur remonte, donc l'offset n'est pas validé |
| `consommer` | abonné à `signalements` depuis le début (`fromBeginning: true`), et chaque message branché |

### Les autres vérifications

| Vérification | Résultat |
|---|---|
| Règle de dépendance renforcée, avec un `faute.ts` qui importe `kafkajs` dans le centre de Notifications | `not ok 3 - notifications/faute.ts …`, soit 1 échec ; tout repasse sans le fichier |
| Les deux services, **sans** `KAFKA_BROKERS` | relevé → 202, puis `NOTIFICATION … [trafic] rue-de-rivoli-1 …` : le mode HTTP n'a pas changé |
| Trafic **avec** un broker injoignable (`KAFKA_BROKERS=localhost:9`) | il **refuse de démarrer** (code de sortie 1, `KafkaJSConnectionError`) |

Le refus de démarrer est voulu : un Trafic qui ne peut pas publier ne doit pas faire croire qu'il
fonctionne. Kubernetes le relancera (TP 3, étape 5), jusqu'à ce que le broker réponde.

```
npm test                      # tests 127, pass 127, fail 0   (117 avant cette étape, + 10)
npm run test:trafic           # tests 65, fail 0
npm run test:notifications    # tests 38, fail 0
```

**Ce qui reste pour l'étape 6.** Ces tests n'ont pas vu de vrai broker : le moteur Docker n'était
pas démarré sur ce poste. Faire tourner les deux services et Kafka avec `docker compose up` est
précisément l'objet de l'étape 6.

---

## Fichiers de cette étape

| Fichier | Nouveau ou modifié |
|---|---|
| `urbanhub-trafic/src/adaptateurs/publicationKafka.ts`, `kafkaTopic.ts` | nouveaux |
| `urbanhub-trafic/src/principal.ts` | modifié : choix du transport (HTTP ou Kafka) |
| `urbanhub-notifications/src/adaptateurs/entreeKafka.ts`, `traductionTrafic.ts` | nouveaux |
| `urbanhub-notifications/src/adaptateurs/entreeHttp.ts` | modifié : la traduction déplacée dans `traductionTrafic.ts` |
| `urbanhub-notifications/src/principal.ts` | modifié : seconde entrée, Kafka |
| `urbanhub-notifications/src/audit.ts` | nouveau : le second groupe |
| `test/publicationKafkaTrafic.test.ts`, `test/entreeKafkaNotifications.test.ts` | nouveaux |
| `test/regleDependanceTrafic.test.ts`, `test/regleDependanceNotifications.test.ts` | modifiés : interdit les paquets npm dans le centre |
| `package.json`, `package-lock.json` | dépendance `kafkajs` ; scripts `audit`, `test:trafic`, `test:notifications` |
