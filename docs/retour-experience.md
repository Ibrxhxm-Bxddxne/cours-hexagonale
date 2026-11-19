# Retour d'expérience : UrbanHub en hexagones, des TP 2 à 4

**Module :** EADL BC01-FM03, architecture hexagonale (TP 5, travail individuel).

**Ce document :** un bilan de ce que j'ai construit aux TP 2 à 4. Ce que cela a apporté, ce que
cela a coûté, et ce que je recommande pour la suite. Chaque affirmation renvoie à une preuve du
dépôt : un test, un commit ou une trace.

| Partie | Contenu |
|---|---|
| 1 | Ce que j'ai construit : le besoin, le découpage, les patrons, la communication |

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
