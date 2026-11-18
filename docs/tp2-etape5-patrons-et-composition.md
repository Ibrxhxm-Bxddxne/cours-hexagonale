# TP 2, étape 5 : deux patrons et la racine de composition

**Consigne :** appliquer deux patrons (Stratégie, Décorateur ou Dépôt), chacun à un vrai problème, puis
assembler le tout dans une racine de composition, le seul fichier qui crée les objets et les branche.

**Les deux patrons choisis :**
- **Stratégie**, pour la règle de congestion ;
- **Décorateur**, pour le réessai autour du publicateur.

Le patron **Dépôt** est déjà présent depuis les étapes 2 et 4 : `DepotReleves` range et relit les
relevés comme une collection, en mémoire ou dans SQLite. Nous ne le comptons pas parmi les deux
patrons de l'étape, parce qu'il n'a rien demandé de nouveau.

**Résultat :** `npm test` passe **57 / 57** (48 avant l'étape, plus 8 tests des patrons, plus 1 test
de dépendance ajouté automatiquement pour `regles.ts`). Le service a aussi été lancé en vrai (voir la
partie 4).

| Fichier | Statut | Rôle |
|---|---|---|
| `urbanhub-trafic/src/regles.ts` | créé (35 l.) | **Stratégie** : `RegleCongestion`, `SeuilRelatif`, `SeuilRelatifAvecMinimum` |
| `urbanhub-trafic/src/adaptateurs/reessai.ts` | créé (31 l.) | **Décorateur** : `PublicateurAvecReessai` |
| `urbanhub-trafic/src/adaptateurs/publicationHttp.ts` | créé (22 l.) | publicateur réel : `POST` JSON, délai de 2 s |
| `urbanhub-trafic/src/adaptateurs/entreeHttp.ts` | créé (29 l.) | entrée réelle : `POST /releves` vers le port `RecevoirReleve` |
| `urbanhub-trafic/src/principal.ts` | créé (30 l.) | **la racine de composition** |
| `urbanhub-trafic/troncons.json` | créé | les tronçons et leur vitesse limite |
| `test/patronsTrafic.test.ts` | créé (96 l.) | 8 tests : le problème, puis la solution, pour chaque patron |
| `urbanhub-trafic/src/domaine.ts` | modifié (−6 l.) | `etatSelon` et `PART_DE_LA_LIMITE` partent dans `regles.ts` |
| `urbanhub-trafic/src/service.ts` | modifié | reçoit une `RegleCongestion` en 5e paramètre |
| `test/trafic.test.ts` | modifié (+2 l.) | passe `new SeuilRelatif(0.4)` ; les 7 tests passent **sans autre changement** |
| `package.json` | modifié (+1 l.) | script `npm run trafic` |

---

## 1. Patron Stratégie : la règle de congestion

### Le vrai problème

La règle de l'étape 1, une moyenne sous 40 % de la limite, a un défaut **la nuit**. Avec peu de
véhicules, un seul relevé lent suffit : un bus à l'arrêt, ou une livraison. Le test le montre :

```
strategie, le probleme : la nuit, UN bus a l'arret (5 km/h) declenche un faux bouchon   → 1 signalement
```

Il y a un deuxième défaut. Pendant un bouchon, si un seul véhicule rapide passe seul dans la
fenêtre, le tronçon redevient « fluide ». Au relevé lent suivant, le **même** bouchon est signalé
une **deuxième fois**. Nous l'avons vérifié avec la règle simple : signalements à 08:00 **et** à 08:32.

Faut-il garder la règle simple ou ajouter un minimum de relevés ? C'est une **décision du métier**,
qui peut changer selon la ville ou le tronçon. Le cas d'utilisation ne devrait pas avoir à changer
pour autant.

### La solution

```ts
export interface RegleCongestion {
  etat(fenetre: Releve[], troncon: Troncon): EtatTroncon | undefined;   // undefined : on ne conclut pas
}
export class SeuilRelatif implements RegleCongestion { ... }             // la regle du README
export class SeuilRelatifAvecMinimum implements RegleCongestion { ... }  // au moins 3 releves
```

Le service reçoit **une** règle et ne sait pas laquelle :

```ts
    const nouvel = this.#regle.etat(fenetre, troncon);
    if (!nouvel || nouvel === this.#etats.etat(releve.troncon)) return;
```

| Test | Résultat |
|---|---|
| Avec `SeuilRelatifAvecMinimum(3)`, le bus seul à 03:00 ne déclenche rien | ✅ 0 signalement |
| Avec 3 relevés lents, le vrai bouchon est signalé | ✅ 1 signalement à 08:02 |
| Un relevé rapide isolé ne termine pas l'épisode : pas de 2e signalement | ✅ 1 signalement (contre 2 avec la règle simple) |

La règle se choisit **dans la racine de composition**, par la variable d'environnement `REGLE`. Par
défaut, c'est la règle du README. Avec `REGLE=avec-minimum`, c'est la règle avec un minimum de 3
relevés.

### Ce qu'il améliore

- **Maintenabilité (modifier) :**
  - une nouvelle règle, par exemple un seuil plus strict aux heures de pointe, est une **nouvelle
    classe**, et `service.ts` ne bouge pas ;
  - chaque règle se teste seule ;
  - la règle est sortie du domaine : `domaine.ts` ne garde que le vocabulaire (relevé, fenêtre,
    moyenne).
- **Scalabilité (tenir la charge) :** peu d'effet direct. La règle avec minimum évite cependant des
  signalements inutiles, donc du travail en aval (le service qui reçoit, les opérateurs).

### Ce qu'il coûte

- **Une interface et un fichier de plus** (35 lignes), et un 5e paramètre au constructeur du service.
- **Un `undefined` à gérer** : le service doit comprendre « pas de conclusion ». C'est une ligne,
  mais c'est un concept de plus dans le contrat.
- **Un choix de configuration** : il faut documenter quelle règle tourne en production (`REGLE`).

---

## 2. Patron Décorateur : le réessai autour du publicateur

### Le vrai problème

À l'étape 3, nous avons choisi de changer l'état **après** la publication. Une panne ne perd donc pas
le signalement : il est retenté **au relevé suivant**. Mais le relevé suivant peut arriver plusieurs
minutes plus tard, ou **jamais** la nuit, si plus aucun véhicule ne passe. Le test le montre :

```
decorateur, le probleme : sans reessai, une panne passagere retarde le signalement au releve suivant
→ personne n'est prévenu à 08:00
```

On pourrait écrire le réessai **dans** `publicationHttp.ts` ou **dans** `service.ts`. Mais il
faudrait alors le réécrire pour chaque publicateur (HTTP, demain Kafka), ou mélanger une technique
(les pauses, le réseau) avec la règle métier.

### La solution

`PublicateurAvecReessai` implémente le **même port** que le publicateur qu'il enveloppe :

```ts
export class PublicateurAvecReessai implements PublicateurSignalements {
  async publier(s: Signalement) {
    for (let essai = 1; ; essai += 1) {
      try { return await this.#interne.publier(s); }
      catch (erreur) {
        if (essai >= this.#essais) throw erreur;     // on n'avale pas l'erreur
        await this.#attendre(this.#pauseMs * essai); // 500 ms, puis 1000 ms
      }
    }
  }
}
```

Il s'assemble dans la racine de composition, autour du publicateur HTTP :

```ts
const publicateur = new PublicateurAvecReessai(new PublicateurSignalementsHttp(url));
```

| Test | Résultat |
|---|---|
| Une panne passagère (2 échecs) est absorbée : le signalement part **à 08:00** | ✅ 3 appels, 1 reçu |
| Une panne durable remonte après 3 essais, au lieu d'être avalée | ✅ erreur levée |
| Les pauses grandissent (500 ms, puis 1000 ms) | ✅ `[500, 1000]` |

Les pauses sont **injectées** (paramètre `attendre`). Les tests passent une pause nulle et tournent
donc en moins d'une milliseconde, sans vraie attente.

### Ce qu'il améliore

- **Maintenabilité :**
  - le réessai est écrit **une fois** et s'applique à tout publicateur (HTTP aujourd'hui, Kafka
    demain) ;
  - ni `service.ts` ni `publicationHttp.ts` n'ont été modifiés pour l'ajouter ;
  - on l'enlève, ou on change le nombre d'essais, en une ligne dans `principal.ts`.
- **Scalabilité :**
  - les pannes courtes, fréquentes quand le destinataire est chargé, ne font plus échouer la requête
    du capteur ;
  - les pauses **grandissantes** laissent au destinataire le temps de se remettre, au lieu de
    l'assommer de nouvelles tentatives.

### Ce qu'il coûte

- **Du temps de réponse en cas de panne.** Une requête de capteur peut attendre jusqu'à environ 1,5 s
  de pauses, plus 3 délais de 2 s, avant d'échouer. Le capteur attend pendant ce temps.
- **Des doublons possibles.** Si le destinataire a reçu le message mais que sa réponse s'est perdue,
  le réessai l'envoie une deuxième fois. C'est pour cela que le signalement porte un `identifiant` :
  le destinataire peut ignorer le doublon.
- **Une couche de plus à suivre** quand on lit le code : `principal.ts`, puis le réessai, puis HTTP.
- **Une limite.** Si la panne dure plus que les 3 essais, il faut un mécanisme plus solide : une boîte
  d'envoi, ou un coupe-circuit (voir le TP 4).

---

## 3. La racine de composition (`principal.ts`)

C'est le **seul** fichier qui connaît toutes les classes concrètes. Il les crée et les branche :

```
                      principal.ts (racine de composition)
                                   │ crée et branche
  POST /releves                    ▼
  ──────────────► entreeHttp ──► SurveillanceTrafic ──► DepotRelevesSqlite      (releves.db)
   (capteurs)    (adaptateur      (cas d'utilisation)──► ReferentielTronconsEnMemoire (troncons.json)
                  primaire)            │      │      ──► EtatsTronconsEnMemoire
                                       │      │      ──► PublicateurAvecReessai ──► PublicateurSignalementsHttp ──► POST /signalements
                                       │      │            (Décorateur)
                                       │      └────────► SeuilRelatif | SeuilRelatifAvecMinimum
                                       │                   (Stratégie)
                                       ▼
                             domaine.ts, ports.ts, regles.ts (le centre : aucun import technique)
```

| Variable d'environnement | Par défaut | Rôle |
|---|---|---|
| `PORT` | `8003` | le port HTTP du service |
| `BASE_RELEVES` | `releves.db` | le fichier SQLite des relevés |
| `TRONCONS` | `urbanhub-trafic/troncons.json` | la liste des tronçons |
| `URL_SIGNALEMENTS` | `http://localhost:8004/signalements` | où envoyer les signalements |
| `REGLE` | (règle du README) | `avec-minimum` pour la Stratégie avec un minimum de 3 relevés |

**Les règles respectées :**
- les tests n'importent **pas** `principal.ts` : ils assemblent leurs propres adaptateurs ;
- `principal.ts` est le seul fichier hors du centre autorisé à tout connaître. Le test de la règle de
  dépendance l'exclut explicitement (`HORS_CENTRE = ["principal.ts"]`).

---

## 4. L'essai en vrai : le service lancé de bout en bout

Nous avons lancé un faux destinataire sur le port 8004, puis le service avec
`BASE_RELEVES=<dossier temporaire> PORT=8003 node urbanhub-trafic/src/principal.ts`, et envoyé des
relevés avec `curl` :

| Requête `POST /releves` | Réponse |
|---|---|
| 08:00, 30 km/h | 202 |
| 08:05, 15 km/h | 202 |
| 08:10, 10 km/h | 202 |
| 08:15, 12 km/h | 202 |
| `pas du json` | **422** |
| tronçon `rue-inconnue` | **404** |
| vitesse −4 | **422** |
| un relevé valide, juste après | **202** : le service est toujours en vie |

**Reçu par le destinataire** : un seul signalement, celui de l'exemple de l'étape 1.

```json
{"troncon":"boulevard-voltaire-3","vitesseMoyenne":18.333333333333332,"vitesseLimite":50,
 "debut":"2026-11-18T08:10:00","identifiant":"boulevard-voltaire-3:2026-11-18T08:10:00"}
```

**Dans `releves.db`** : 5 lignes, les 4 relevés de Voltaire et celui de Rivoli. Les relevés refusés
n'ont pas été rangés.

**La leçon du TP 1 appliquée.** Chez Alertes, un JSON invalide **arrêtait tout le service**. Ici,
`entreeHttp.ts` répond 422 et le service continue. Aucune exception ne sort du gestionnaire.

Pour le relancer vous-même :

```powershell
npm run trafic
```
