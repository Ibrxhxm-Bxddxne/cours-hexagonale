# TP 2, étape 6 : un adaptateur remplacé derrière le même port

**Consigne :** remplacer un adaptateur par un autre, derrière le même port. Un seul commit, qui ne
touche que l'adaptateur et la racine de composition : le citer dans le README.

**Le commit du remplacement :** `197c622`, « TP2 etape 6 : etats des troncons en SQLite ». Il ne
contient que 2 fichiers :

| Fichier | Dans le commit |
|---|---|
| `urbanhub-trafic/src/adaptateurs/etatsSqlite.ts` | **créé** (31 lignes) : le nouvel adaptateur |
| `urbanhub-trafic/src/principal.ts` | **modifié** (+4 / −3) : la racine de composition branche le nouvel adaptateur |

Pour le vérifier :

```bash
git show --stat 197c622
```

Le test de contrat et ce document sont dans le commit **suivant**. Ainsi, le commit du remplacement
reste limité à l'adaptateur et à la racine, comme le demande la consigne.

---

## 1. Ce qui a été remplacé, et pourquoi

| | Avant | Après |
|---|---|---|
| Port | `EtatsTroncons` | `EtatsTroncons` (**le même**) |
| Adaptateur | `EtatsTronconsEnMemoire` (une `Map`) | `EtatsTronconsSqlite` (une table `etat_troncon`) |
| Branché dans | `principal.ts` | `principal.ts` |

### Le problème, mesuré avant le remplacement

Le service a tourné avec l'adaptateur en mémoire :
1. deux relevés lents à 08:00 et 08:02 déclenchent le signalement du bouchon ;
2. on **redémarre** le service ;
3. on envoie un relevé lent de plus, à 08:04.

```
[etats en memoire] avant redemarrage : 1 signalement(s)
[etats en memoire] apres redemarrage : 2 signalement(s)
"debut":"2026-11-18T08:00:00"
"debut":"2026-11-18T08:04:00"
```

**Le même bouchon est signalé deux fois.** Les relevés survivent, puisqu'ils sont dans SQLite depuis
l'étape 4, et la fenêtre dit toujours « congestionné ». Mais l'état « déjà signalé » était dans la
mémoire du processus : au redémarrage, le service croit le tronçon « fluide » et signale de nouveau.

C'est exactement le défaut trouvé chez **Alertes** au TP 1 (étape 4), où un `Set` en mémoire perdait
les doublons au redémarrage. Chez Alertes, ce `Set` était écrit **dans le centre** : le corriger
obligeait à modifier le cas d'utilisation. Ici, l'état passe par un **port** depuis l'étape 2, donc le
corriger revient à changer d'adaptateur.

### Après le remplacement : le même essai

```
[etats en SQLite] avant redemarrage : 1 signalement(s)
[etats en SQLite] apres redemarrage : 1 signalement(s)
"debut":"2026-11-18T08:00:00"
```

**Un seul signalement, même après le redémarrage.** La règle « une seule fois par épisode » tient
désormais.

---

## 2. Le nouvel adaptateur (`etatsSqlite.ts`)

```ts
export class EtatsTronconsSqlite implements EtatsTroncons {
  etat(troncon: string): EtatTroncon {
    const ligne = this.#base.prepare("SELECT etat FROM etat_troncon WHERE troncon = ?").get(troncon);
    return ligne?.etat ?? "fluide";                    // un troncon jamais vu est fluide
  }
  changer(troncon: string, etat: EtatTroncon) {        // une ligne par troncon : on la remplace
    this.#base.prepare("INSERT INTO etat_troncon (troncon, etat) VALUES (?, ?)"
      + " ON CONFLICT (troncon) DO UPDATE SET etat = excluded.etat").run(troncon, etat);
  }
}
```

| Choix | Raison |
|---|---|
| `troncon TEXT PRIMARY KEY` | **une** ligne par tronçon : la table ne grossit pas avec le temps, contrairement aux relevés |
| `ON CONFLICT ... DO UPDATE` | créer ou mettre à jour en **une** requête |
| `CHECK (etat IN ('fluide', 'congestionne'))` | la base refuse tout état hors du vocabulaire du domaine (`EtatTroncon`) |
| `?? "fluide"` | même comportement que l'adaptateur en mémoire pour un tronçon jamais vu |
| Même fichier que les relevés (`BASE_RELEVES`) | une seule base à sauvegarder et à déployer ; deux tables indépendantes |

---

## 3. Le diff de la racine de composition

```diff
-import { EtatsTronconsEnMemoire } from "./adaptateurs/etatsMemoire.ts";
+import { EtatsTronconsSqlite } from "./adaptateurs/etatsSqlite.ts";
 ...
-const depot = new DepotRelevesSqlite(env.BASE_RELEVES ?? "releves.db");
+const base = env.BASE_RELEVES ?? "releves.db";
+const depot = new DepotRelevesSqlite(base);
 const referentiel = new ReferentielTronconsEnMemoire(troncons);
-const etats = new EtatsTronconsEnMemoire();
+const etats = new EtatsTronconsSqlite(base);          // etape 6 : remplace EtatsTronconsEnMemoire
```

### Ce qui n'a pas bougé

| Fichier | Modifié ? |
|---|---|
| `domaine.ts`, `ports.ts`, `regles.ts`, `service.ts` (le centre) | **non** |
| `etatsMemoire.ts` | **non** : il sert toujours aux tests rapides du cas d'utilisation |
| `entreeHttp.ts`, `publicationHttp.ts`, `reessai.ts`, `depotSqlite.ts` | **non** |
| Les 57 tests existants | **non**, et ils passent tous |

---

## 4. Le test de contrat des états (`test/contratEtatsTroncons.test.ts`, commit suivant)

Le contrat est le même pour les deux adaptateurs, comme celui du dépôt à l'étape 4 :

| Vérification | Mémoire | SQLite |
|---|---|---|
| Un tronçon jamais vu est fluide | ✅ | ✅ |
| L'état change, puis revient | ✅ | ✅ |
| Changer deux fois le même état ne pose pas de problème | ✅ | ✅ |
| Les tronçons sont indépendants | ✅ | ✅ |
| **SQLite seulement** : l'état « déjà signalé » survit à un redémarrage | — | ✅ |
| **SQLite seulement** : la base refuse un état hors du vocabulaire (`CHECK`) | — | ✅ |

**Résultat :** `npm test` passe **67 / 67** (57, plus ces 10 tests).

Puisque l'adaptateur SQLite passe le même contrat que celui en mémoire, les tests rapides du cas
d'utilisation (étape 3), qui tournent sur la mémoire, restent valables pour la production.

---

## Ce que cette étape prouve

- **La technique se remplace en changeant un adaptateur et une racine**, sans toucher au centre. Le
  commit `197c622` le montre : 2 fichiers, 0 ligne du centre.
- **Le port conçu à l'étape 2 a payé.** Chez Alertes, la même correction aurait demandé de modifier
  le cas d'utilisation.
- **Le prix :**
  - un adaptateur de 31 lignes et un contrat de 61 lignes ;
  - une requête SQL de plus à chaque relevé (`etat()`) ;
  - une table de plus à sauvegarder.
