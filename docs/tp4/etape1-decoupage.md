# TP 4, étape 1 : le découpage. Trafic devient un microservice, et Notifications naît

**Consigne :**
- notre service devient un microservice, avec sa propre base ;
- nous écrivons ensuite un second service (alertes, notifications ou historique), lui aussi en
  hexagone, avec son propre contexte délimité.

**Notre service :** Trafic, écrit au TP 2.

**Le second service :** **Notifications** ([`urbanhub-notifications/`](../../urbanhub-notifications/)).

**Le lien avec le TP 3 :** au TP 3, nous avons conclu « un monolithe hexagonal aujourd'hui ». Ce
TP **exerce** le découpage que le premier signal déclencherait ([TP 3, étape 6](../tp3/etape6-conclusion.md)).
C'est un exercice, pas un changement d'avis.

---

## 1. Trafic est déjà un microservice : la preuve, critère par critère

Le cours (slide 57) demande trois choses : un processus par service, une capacité métier par
service, un déploiement indépendant. Et la slide 61 ajoute : sa base à lui.

| Critère | Ce qui le prouve chez Trafic | Depuis |
|---|---|---|
| Un processus à lui | [`principal.ts`](../../urbanhub-trafic/src/principal.ts) démarre son propre serveur HTTP, sur le port 8003 | TP 2 |
| **Sa propre base** | `releves.db` (variable `BASE_RELEVES`) : tables `releve` et `etat_troncon`. Aucun autre service ne l'ouvre | TP 2, étapes 4 et 6 |
| Une capacité métier | la congestion des tronçons, et rien d'autre | TP 2, étape 1 |
| Aucun lien de code avec un autre service | `grep` ne trouve **aucun** import de `urbanhub-air`, `urbanhub-alertes` ou `urbanhub-notifications` dans `urbanhub-trafic/` | vérifié à cette étape |
| Livrable seul | [`Dockerfile.trafic`](../../Dockerfile.trafic) et [`k8s/trafic.yaml`](../../k8s/trafic.yaml) | TP 3, étape 5 |
| **Testable seul** | nouveau script `npm run test:trafic` : **42 tests**, sans ceux des autres services | **cette étape** |

Le seul ajout de cette étape pour Trafic est donc le script `test:trafic`, dans
[`package.json`](../../package.json). Le TP 3 (étape 4, § 3.3) avait noté qu'il manquait pour
livrer chaque service seul. Le code de Trafic ne change pas.

---

## 2. Le second service : pourquoi Notifications, et pas Alertes

Le dépôt contient déjà un service `urbanhub-alertes`, mais il appartient au **contexte de la
qualité de l'air** :
- il lit une `moyenne` (des µg/m³) ;
- son identifiant est `capteur:polluant:jour`.

Le TP 3 l'avait montré (étape 1, § 4) : un signalement de Trafic porte `vitesseMoyenne`, et
Alertes afficherait « moyenne undefined ».

Nous aurions pu modifier Alertes pour qu'il comprenne aussi le trafic. Mais il aurait alors deux
vocabulaires dans un seul modèle : c'est exactement ce qu'un contexte délimité interdit (cours,
slide 71). Nous écrivons donc un **nouveau** service, avec **son** vocabulaire.

### Son contexte délimité : prévenir les opérateurs d'un incident

**Règle de gestion :** tout incident reçu d'un service d'UrbanHub est rédigé en une notification
lisible et transmis aux opérateurs, puis gardé dans l'historique. À l'étape 4, nous ajouterons :
un incident déjà reçu n'est pas notifié une seconde fois.

| Mot | Dans Trafic | Dans Notifications |
|---|---|---|
| ce qui arrive | un **signalement** de congestion | un **incident**, quelle que soit sa source |
| où | un **tronçon** (`rue-de-rivoli-1`) | un **lieu** : du texte, dans les mots de la source |
| quoi | `vitesseMoyenne`, `vitesseLimite` (des km/h) | un **résumé** : une phrase déjà lisible |
| quand | `debut` | `survenu` |
| ce qu'on produit | — | une **notification** : `[trafic] rue-de-rivoli-1 : … (depuis 08:10)` |

**Notifications ne connaît ni tronçon, ni vitesse, ni polluant.** C'est l'**adaptateur d'entrée**
(étape 2) qui traduira un signalement de Trafic en `Incident`. Si demain Qualité de l'air envoie
ses alertes ici, on ajoute une traduction, pas un champ dans le domaine.

La règle de dépendance le vérifie : le centre de Notifications n'importe **aucun autre service**.

---

## 3. L'hexagone de Notifications

| Anneau | Fichier | Contenu |
|---|---|---|
| Domaine | [`domaine.ts`](../../urbanhub-notifications/src/domaine.ts) (38 lignes) | `Incident`, `Notification`, `IncidentInvalide` ; `incident()` valide, `notification()` rédige |
| Ports | [`ports.ts`](../../urbanhub-notifications/src/ports.ts) (23 lignes) | **primaire** : `RecevoirIncident` ; **secondaires** : `Operateurs` (prévenir) et `Historique` (enregistrer, tous) |
| Cas d'utilisation | [`service.ts`](../../urbanhub-notifications/src/service.ts) (21 lignes) | `ReceptionIncidents` : prévenir les opérateurs, **puis** historiser |
| Adaptateurs | [`historiqueMemoire.ts`](../../urbanhub-notifications/src/adaptateurs/historiqueMemoire.ts), [`historiqueSqlite.ts`](../../urbanhub-notifications/src/adaptateurs/historiqueSqlite.ts), [`operateursJournal.ts`](../../urbanhub-notifications/src/adaptateurs/operateursJournal.ts) | la mémoire pour les tests ; **`notifications.db`**, la base propre au service ; une ligne de journal pour les opérateurs |

### Les choix, et leur raison

| Choix | Raison |
|---|---|
| **Sa propre base**, `notifications.db` | La slide 61 : personne d'autre ne l'ouvre. Trafic ne lit pas l'historique, et Notifications ne lit pas les relevés |
| Prévenir **puis** historiser | Si les opérateurs sont injoignables, l'incident n'est pas marqué « traité », et un nouvel envoi de Trafic (son réessai) le retentera. C'est le même ordre que Trafic, qui change l'état **après** avoir publié |
| `identifiant UNIQUE` et `ON CONFLICT DO NOTHING` dans la base | L'historique ne garde jamais deux fois le même incident. **Ce n'est pas encore l'idempotence** : à ce stade, un doublon prévient encore deux fois les opérateurs. Le cas d'utilisation sera rendu idempotent à l'étape 4 |
| L'`identifiant` vient de la source | Trafic l'a déjà : `troncon:debut`. C'est lui qui permettra de reconnaître un doublon |
| Une colonne `rang` | Pour relire l'historique dans l'ordre d'arrivée, et pas dans l'ordre alphabétique des identifiants |

Ce qui manque encore, et viendra aux étapes suivantes :
- l'adaptateur HTTP d'entrée et la racine de composition (étape 2) ;
- le réessai et le coupe-circuit côté Trafic (étape 3) ;
- l'idempotence (étape 4) ;
- Kafka (étapes 5 et 6).

---

## 4. Les tests

| Fichier | Tests | Ce qu'il prouve |
|---|---|---|
| [`test/notifications.test.ts`](../../test/notifications.test.ts) | 5 | **Le centre, sans base ni réseau** : un incident prévient puis est historisé ; si les opérateurs échouent, rien n'est historisé ; le domaine refuse un incident incomplet ; la notification ne parle que le vocabulaire du contexte |
| [`test/contratHistorique.test.ts`](../../test/contratHistorique.test.ts) | 7 | **Le contrat** du port `Historique`, le même pour la mémoire et pour SQLite : vide au départ, ordre gardé, un identifiant en double ne fait qu'une ligne ; et, pour SQLite, l'historique survit à un redémarrage |
| [`test/regleDependanceNotifications.test.ts`](../../test/regleDependanceNotifications.test.ts) | 5 | **La règle de dépendance** : aucune technique dans le centre, et **aucun import d'un autre service** |

### Résultats

```
npm test                      # tests 84, pass 84, fail 0   (67 avant cette étape, + 17)
npm run test:notifications    # tests 17, pass 17, fail 0
npm run test:trafic           # tests 42, pass 42, fail 0
```

**La règle de dépendance attrape une vraie faute.** Nous avons ajouté un fichier temporaire
`urbanhub-notifications/src/faute.ts`, qui importe le domaine de Trafic. Résultat :
`not ok 3 - notifications/faute.ts n'importe aucune technique, ni un autre service`, soit 1 échec.
Une fois le fichier supprimé, tout repasse.

---

## Fichiers de cette étape

| Fichier | Nouveau ou modifié |
|---|---|
| `urbanhub-notifications/src/` : `domaine.ts`, `ports.ts`, `service.ts` | nouveau |
| `urbanhub-notifications/src/adaptateurs/` : `historiqueMemoire.ts`, `historiqueSqlite.ts`, `operateursJournal.ts` | nouveau |
| `test/notifications.test.ts`, `test/contratHistorique.test.ts`, `test/regleDependanceNotifications.test.ts` | nouveau |
| `package.json` : scripts `test:trafic` et `test:notifications` | modifié |
| `tsconfig.json` : inclut `urbanhub-notifications` | modifié |
| `docs/tp4/etape1-decoupage.md` | nouveau |
