# TP 4, étape 2 : l'adaptateur qui publie en HTTP avec un délai, et l'adaptateur qui reçoit

**Consigne :** écrire l'adaptateur qui publie l'alerte en HTTP avec un délai, et l'adaptateur
primaire qui la reçoit.

**Chez nous :**
- l'« alerte » est le **signalement** de congestion de Trafic ;
- elle part de Trafic (adaptateur **secondaire**) ;
- elle arrive chez Notifications (adaptateur **primaire**).

---

## 1. Le côté qui publie : Trafic

**L'adaptateur existait déjà.**
[`publicationHttp.ts`](../../urbanhub-trafic/src/adaptateurs/publicationHttp.ts) a été écrit au
TP 2 (étape 5), pour le patron Décorateur.

Ce qui lui **manquait** : un test à lui. Le délai, en particulier, n'avait jamais été vérifié. Nous
l'avons donc testé contre un **vrai** serveur HTTP local.

| Ce que fait l'adaptateur | La ligne | Prouvé par |
|---|---|---|
| `POST` du signalement en JSON, **identifiant compris** | `body: JSON.stringify(s)` | test 1 : le serveur reçoit exactement le signalement |
| **Le délai** : jamais d'appel réseau sans délai (2 s par défaut) | `signal: AbortSignal.timeout(this.#delaiMs)` | test 3 : face à un serveur qui ne répond jamais, l'appel est abandonné au bout du délai (réglé à 200 ms), avec une `TimeoutError` |
| Un refus n'est pas avalé | `if (!reponse.ok) throw …` | test 2 : réponse 500, erreur levée |
| Personne n'écoute | l'erreur réseau de `fetch` remonte | test 4 |

Fichier : [`test/publicationHttpTrafic.test.ts`](../../test/publicationHttpTrafic.test.ts) (4 tests).

### Pourquoi le délai compte

Sans délai, un Notifications figé figerait Trafic : sa requête resterait ouverte indéfiniment, et
chaque relevé suivant ouvrirait une connexion de plus. Le TP 3 (étape 3) a mesuré la même chose
sur Qualité de l'air : avec le délai, une panne coûte 7,5 s au pire ; sans lui, il n'y a pas de
limite.

### L'adresse

Le défaut de `URL_SIGNALEMENTS`, `http://localhost:8004/signalements`, visait **un service qui
n'existait pas** (TP 3, étape 1). C'est maintenant l'adresse de Notifications : rien à changer
dans la configuration de Trafic.

---

## 2. Le côté qui reçoit : Notifications

**Nouveau fichier :** [`entreeHttp.ts`](../../urbanhub-notifications/src/adaptateurs/entreeHttp.ts).

### La traduction à la frontière du contexte

`incidentDepuisSignalement()` transforme un signalement de Trafic en `Incident` :

| Signalement (vocabulaire de Trafic) | Incident (vocabulaire de Notifications) |
|---|---|
| `identifiant` (`troncon:debut`) | `identifiant`, gardé tel quel : il servira à l'idempotence (étape 4) |
| — | `source: "trafic"` |
| `troncon` | `lieu` |
| `vitesseMoyenne`, `vitesseLimite` | `resume` : `circulation a 9 km/h pour 30 km/h autorises` |
| `debut` | `survenu` |

Les km/h s'arrêtent dans l'adaptateur : **le centre de Notifications ne voit jamais un tronçon ni
une vitesse**. La règle de dépendance de l'étape 1 le garantit. C'est exactement ce que dit le
cours sur le contexte délimité : « la traduction se fait à la frontière, dans un adaptateur »
(slide 71).

### Les réponses : ce que l'émetteur doit en faire

| Situation | Code | Pourquoi ce code |
|---|---|---|
| Signalement valide, opérateurs prévenus | **202** | accepté : l'émetteur n'a rien à refaire |
| JSON cassé, champ manquant, vitesse qui n'est pas un nombre, date fausse | **422** | une donnée fausse ne s'arrangera pas en la renvoyant : le réessai (étape 3) ne doit pas insister |
| Opérateurs injoignables | **500**, erreur journalisée | un problème passager : un nouvel envoi peut réussir, et l'incident n'a **pas** été historisé |
| Autre méthode ou autre route | **404** | |

### La racine de composition

[`principal.ts`](../../urbanhub-notifications/src/principal.ts) branche :
- `HistoriqueSqlite` sur **sa** base `notifications.db` (variable `BASE_NOTIFICATIONS`) ;
- `OperateursParJournal` ;
- le serveur HTTP, sur le **port 8004**.

Nouveau script : `npm run notifications`.

Fichier de test : [`test/entreeNotifications.test.ts`](../../test/entreeNotifications.test.ts)
(5 tests), qui couvre la traduction, le 202, quatre cas de 422, le 500 sans historisation et le 404.

---

## 3. Les deux ensemble, par le réseau

[`test/traficVersNotifications.test.ts`](../../test/traficVersNotifications.test.ts) relie le
**vrai** cas d'utilisation de Trafic, avec son **vrai** publicateur HTTP, à la **vraie** entrée
HTTP de Notifications. Seuls les stockages sont en mémoire.

Le scénario : trois relevés lents sur Rivoli, ce qui donne **une seule** notification.

### La trace, avec les deux vrais services lancés dans deux processus

Les deux bases (`releves.db` et `notifications.db`) étaient dans un dossier temporaire.

```
$ npm run notifications      # port 8004, BASE_NOTIFICATIONS=…/notifications.db
$ npm run trafic             # port 8003, BASE_RELEVES=…/releves.db

releve 10 km/h a 08:00 -> 202
releve 8 km/h a 08:05 -> 202
releve 9 km/h a 08:10 -> 202
signalement casse direct -> signalement de trafic sans vitesseMoyenne ni vitesseLimite 422

--- journal Notifications
recu rue-de-rivoli-1:2026-11-19T08:00:00
NOTIFICATION rue-de-rivoli-1:2026-11-19T08:00:00 [trafic] rue-de-rivoli-1 : circulation a 10 km/h pour 30 km/h autorises (depuis 08:00)
--- journal Trafic
(vide : aucune erreur)
--- historique (table incident de notifications.db)
[('rue-de-rivoli-1:2026-11-19T08:00:00', 'trafic', 'rue-de-rivoli-1', 'circulation a 10 km/h pour 30 km/h autorises')]
```

**Ce qu'on lit dans cette trace :**
- **Une seule notification pour trois relevés lents.** Trafic ne signale qu'au **passage** de
  fluide à congestionné. Le tronçon reste ensuite congestionné, donc pas de second signalement.
- **Le signalement part dès 08:00.** Sans variable `REGLE`, Trafic utilise la règle simple : un
  seul relevé lent suffit. C'est le faux bouchon que la Stratégie `avec-minimum` évite (TP 2,
  étape 5). Le manifeste Kubernetes du TP 3 fixe `REGLE=avec-minimum`.
- **Chaque service a sa base**, et aucun n'ouvre celle de l'autre.

---

## 4. Résultats

```
npm test                      # tests 94, pass 94, fail 0   (84 avant cette étape, + 10)
npm run test:trafic           # tests 47, pass 47, fail 0   (+ 4 : le publicateur, + 1 : le bout en bout)
npm run test:notifications    # tests 23, pass 23, fail 0   (+ 6 : l'entree et le bout en bout)
```

Le test de bout en bout fait partie des **deux** chaînes de livraison. Il vérifie le **contrat**
entre les deux services (le format du message et le code 202) : si l'un des deux le change, les
deux chaînes doivent échouer. C'est la même règle que le TP 3 (étape 4, § 3.3) avait posée pour
`boutEnBout`.


## Fichiers de cette étape

| Fichier | Nouveau ou modifié |
|---|---|
| `urbanhub-notifications/src/adaptateurs/entreeHttp.ts` | nouveau |
| `urbanhub-notifications/src/principal.ts` | nouveau |
| `test/publicationHttpTrafic.test.ts`, `test/entreeNotifications.test.ts`, `test/traficVersNotifications.test.ts` | nouveau |
| `package.json` : script `notifications` ; tests ajoutés à `test:trafic` et `test:notifications` (le bout en bout dans les deux) | modifié |
| `docs/tp4/etape2-publication-et-reception-http.md` | nouveau |
