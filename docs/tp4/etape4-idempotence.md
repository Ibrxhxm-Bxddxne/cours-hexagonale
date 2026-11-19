# TP 4, étape 4 : le consommateur idempotent

**Consigne :**
- rendre le consommateur idempotent (un message reçu deux fois n'agit qu'une fois), grâce à un
  identifiant tiré de la mesure (capteur, polluant, jour) ;
- le prouver par un test qui envoie deux fois le même message.

**Le consommateur :** le service **Notifications**.

**Pourquoi il reçoit des doublons :**
- le réessai de Trafic (étape 3) renvoie un signalement quand il n'a pas reçu de réponse à
  temps ;
- or Notifications a peut-être déjà traité le premier envoi, mais trop lentement ;
- à l'étape 5, Kafka livrera « au moins une fois », et le rejeu de l'étape 6 relira tout le topic.

---

## 1. L'identifiant, tiré de la mesure

La consigne parle de Qualité de l'air : un **capteur**, un **polluant**, un **jour**. Chez Trafic,
la mesure est le **relevé**, et l'identifiant d'un signalement est `troncon:debut`. Il est fabriqué
**dans le domaine de Trafic**
([`signalement()`](../../urbanhub-trafic/src/domaine.ts), depuis le TP 2) :

| Dans la consigne (Qualité de l'air) | Chez nous (Trafic) | Exemple |
|---|---|---|
| capteur | **tronçon** | `rue-de-rivoli-1` |
| polluant | — (un seul phénomène : la congestion) | |
| jour | **début de l'épisode** : l'horodatage du relevé qui l'a déclenché | `2026-11-19T08:10:00` |
| `capteur:polluant:jour` | **`troncon:debut`** | `rue-de-rivoli-1:2026-11-19T08:10:00` |

**Pourquoi le début, et pas le jour.** Un tronçon peut être bouché **deux fois** dans la même
journée : le matin, puis le soir. Ce sont deux incidents, qui doivent chacun prévenir les
opérateurs. Avec le jour comme clé, le bouchon du soir serait pris pour un doublon de celui du
matin, et **personne ne serait prévenu**. Le test « un épisode nouveau n'est pas un doublon » le
vérifie.

**Pourquoi la source fabrique l'identifiant.** Un renvoi transporte **le même** signalement, donc
le même identifiant. Si Notifications fabriquait sa propre clé (par exemple l'heure de
réception), deux envois du même incident auraient deux clés différentes.

---

## 2. Le code

### Le cas d'utilisation : [`service.ts`](../../urbanhub-notifications/src/service.ts)

```ts
async executer(incident: Incident): Promise<Issue> {
  if (!this.#historique.enregistrer(incident)) return "doublon";   // 1. réserver
  try {
    await this.#operateurs.prevenir(notification(incident));       // 2. prévenir
  } catch (erreur) {
    this.#historique.retirer(incident.identifiant);                 // 3. rendre, si échec
    throw erreur;
  }
  return "notifie";
}
```

| Choix | Raison |
|---|---|
| **Réserver d'abord**, en une opération indivisible (`enregistrer` rend `true` si nouveau, `false` si déjà là) | Vérifier d'abord, puis enregistrer après l'envoi, laisserait une fenêtre : pendant que les opérateurs sont prévenus, un renvoi du réessai arrive, ne trouve rien et prévient **une seconde fois**. Le test « deux envois simultanés » montre que la réservation ferme cette fenêtre |
| **Rendre la réservation** si les opérateurs sont injoignables | sinon le renvoi serait pris pour un doublon, et **personne ne serait jamais prévenu**. Le test « opérateurs en panne » donne : 500, puis 202 et une notification, puis 202 et un doublon |
| Le cas d'utilisation **dit ce qu'il a fait** (`"notifie"` ou `"doublon"`) | l'adaptateur peut journaliser `doublon ignore …`. C'est la métrique « doublons ignorés » que le TP 3 (étape 4) demandait pour la supervision |
| **202 dans les deux cas** | pour l'émetteur, le message est pris en compte. Répondre une erreur à un doublon le ferait renvoyer encore, pour rien |

C'est le même principe que `ReceptionAlertes` du cours (`dejaTraitees.add`, slide 81), avec deux
différences :
- l'ensemble des identifiants est **dans la base**, pas en mémoire ;
- la réservation est **rendue** en cas d'échec.

### Le port `Historique` change de contrat : [`ports.ts`](../../urbanhub-notifications/src/ports.ts)

| Avant (étape 1) | Maintenant |
|---|---|
| `enregistrer(incident): void` | `enregistrer(incident): boolean` : indivisible, `true` si nouveau |
| — | `retirer(identifiant): void` |

Les deux adaptateurs suivent ce nouveau contrat :
- [**SQLite**](../../urbanhub-notifications/src/adaptateurs/historiqueSqlite.ts) :
  `INSERT … ON CONFLICT DO NOTHING`, puis `changes === 1`. C'est la contrainte `UNIQUE` de la
  base qui tranche, pas un `SELECT` fait avant (qui laisserait de nouveau une fenêtre) ;
- [**mémoire**](../../urbanhub-notifications/src/adaptateurs/historiqueMemoire.ts) : `Map.has`
  puis `set`. C'est indivisible, car JavaScript n'interrompt pas un code synchrone.

Le **test de contrat** gagne deux cas, vérifiés sur les deux adaptateurs : `enregistrer` rend
`true` puis `false`, et `retirer` rend l'identifiant.

---

## 3. Les preuves : [`test/idempotenceNotifications.test.ts`](../../test/idempotenceNotifications.test.ts)

| Test | Résultat attendu, et obtenu |
|---|---|
| **Le test de la consigne** : le même message envoyé **deux fois** en HTTP | `202`, `202`, **1** notification ; journal : `recu`, `recu`, `doublon ignore` |
| Le cas d'utilisation, appelé deux fois | `"notifie"`, puis `"doublon"` |
| Deux envois **simultanés** (le renvoi arrive pendant le premier traitement) | 1 notification |
| Un épisode nouveau (même tronçon, autre début) | **2** notifications : ce n'est pas un doublon |
| Opérateurs en panne au premier envoi | `500`, puis `202` (prévenus), puis `202` (doublon) : 1 notification au total |
| **Redémarrage** de Notifications (historique SQLite) | après redémarrage, le même incident est un `"doublon"` |

**Les tests attrapent un récepteur qui n'est pas idempotent.** Nous avons remplacé la ligne de
réservation par un enregistrement qui ne regarde pas le résultat. Résultat : **aucun** des 6
tests ne passe (2 échecs, les autres annulés). Le fichier remis en état, les 6 passent.

### La trace, avec le vrai service (base `notifications.db` dans un dossier temporaire)

```
envoi 1 -> 202
envoi 2 -> 202
envoi 3 (apres redemarrage) -> 202

--- journal Notifications
recu rue-de-rivoli-1:2026-11-19T08:10:00
NOTIFICATION rue-de-rivoli-1:2026-11-19T08:10:00 [trafic] rue-de-rivoli-1 : circulation a 9 km/h pour 30 km/h autorises (depuis 08:10)
recu rue-de-rivoli-1:2026-11-19T08:10:00
doublon ignore rue-de-rivoli-1:2026-11-19T08:10:00
== redemarrage de Notifications
recu rue-de-rivoli-1:2026-11-19T08:10:00
doublon ignore rue-de-rivoli-1:2026-11-19T08:10:00
lignes dans incident : 1
```

Trois envois, dont un après redémarrage : **une** notification, **une** ligne en base.

Le service `Alertes` du cours, avec son `Set` en mémoire, aurait prévenu une seconde fois après le
redémarrage. C'est le défaut relevé au TP 1 (étape 4) et au TP 3 (étape 1).

---

## 4. La limite qui reste, et pourquoi nous l'acceptons

Il reste **une** fenêtre : le processus **meurt** (arrêt brutal, coupure de courant) **entre** la
réservation et l'envoi aux opérateurs. L'incident est alors marqué « reçu » sans que personne
ait été prévenu, et les renvois seront pris pour des doublons.

| Ordre | Si le processus meurt au milieu | Garantie |
|---|---|---|
| **Réserver, puis prévenir** (notre choix) | l'incident est **perdu** | **au plus une fois** pour cet incident ; mais sans doublon, même simultané |
| Prévenir, puis enregistrer (l'ordre de l'étape 1) | l'incident sera **notifié deux fois** au renvoi | au moins une fois ; mais les envois simultanés passent tous les deux |

**Pourquoi ce choix.**
- Les envois simultanés sont **fréquents** : à chaque délai dépassé, le réessai renvoie alors que
  le premier traitement est peut-être encore en cours.
- Une mort du processus dans les quelques millisecondes entre la réservation et la notification
  est **rare**.
- Pour fermer aussi cette fenêtre, il faudrait que la notification aux opérateurs soit elle-même
  idempotente : par exemple, un fournisseur de SMS qui accepte une clé de dédoublonnage. Nous
  l'écrivons comme une évolution, pas comme une promesse.

---

## 5. Résultats

```
npm test                      # tests 117, pass 117, fail 0   (107 avant cette étape, + 10)
npm run test:notifications    # tests 33, fail 0
```

| Fichier | Nouveau ou modifié |
|---|---|
| `urbanhub-notifications/src/service.ts` | modifié : réserver, prévenir, rendre si échec |
| `urbanhub-notifications/src/ports.ts` | modifié : `Issue`, `enregistrer(): boolean`, `retirer()` |
| `urbanhub-notifications/src/adaptateurs/historiqueSqlite.ts`, `historiqueMemoire.ts` | modifiés : le nouveau contrat |
| `urbanhub-notifications/src/adaptateurs/entreeHttp.ts` | modifié : journalise `doublon ignore` ; 202 dans les deux cas |
| `test/idempotenceNotifications.test.ts` | nouveau : 6 tests |
| `test/contratHistorique.test.ts` | modifié : + 2 cas × 2 adaptateurs |
| `package.json` | modifié : `test:notifications` inclut le nouveau fichier |

**Côté Trafic, rien ne change.** L'identifiant voyageait déjà avec le signalement depuis le TP 2.
L'idempotence est l'affaire **du récepteur** (cours, slide 85 : « celui qui reçoit »).
