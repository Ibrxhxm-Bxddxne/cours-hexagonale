# TP 1, étape 2 : trois avantages et la ligne qui prouve chacun

Service étudié : **Qualité de l'air** (`urbanhub-air/`). Les avantages viennent du tableau de la
section 1.4, « Ce qu'on gagne, ce qu'on paie ».

| Avantage (1.4) | Fichier | Ligne | Prix annoncé par le cours |
|---|---|---|---|
| Logique métier testée seule | `urbanhub-air/src/service.ts` | 12 | Un adaptateur de test à écrire par port secondaire |
| La technique se remplace | `urbanhub-air/src/ports.ts` | 14 à 17 | Un port à concevoir avant de coder |
| Toutes les entrées se valent | `urbanhub-air/src/ports.ts` | 9 à 11 | Plus de fichiers, plus de détours par des interfaces |

---

## 1. La logique métier se teste seule

`urbanhub-air/src/service.ts`, ligne 12 :

```ts
  constructor(depot: DepotMesures, alertes: PublicateurAlertes, regle: Regle) {
```

**Pourquoi cette ligne le prouve.** Le cas d'utilisation `SurveillanceQualiteAir` ne reçoit que
des **ports** (des interfaces). Il ne crée ni base de données, ni connexion réseau. Un test peut
donc lui passer un dépôt en mémoire et un faux publicateur, comme le fait
`test/surveillance.test.ts` à la ligne 15 :

```ts
  const service = new SurveillanceQualiteAir(new DepotMesuresEnMemoire(),
    alertesEspionnes, new SeuilMoyenneJournaliere("PM10", 50));
```

**Le contre-exemple.** `urbanhub-air/avant/enregistrerMesure.ts`, ligne 5, ouvre la base au
chargement du module :

```ts
const base = new DatabaseSync(process.env.BASE_MESURES ?? "mesures.db");
```

Pour tester la même règle, `test/avant.test.ts` doit créer une base sur disque et démarrer un faux
serveur HTTP.

---

## 2. La technique se remplace

`urbanhub-air/src/ports.ts`, lignes 14 à 17 :

```ts
export interface DepotMesures {
  enregistrer(mesure: Mesure): void;
  duJour(capteur: string, polluant: string, jour: string): Mesure[];
}
```

**Pourquoi ces lignes le prouvent.** Le service ne connaît que ce contrat. Deux adaptateurs
l'implémentent :

- `depotMemoire.ts`, ligne 4 : `class DepotMesuresEnMemoire implements DepotMesures`
- `depotSqlite.ts`, ligne 9 : `class DepotMesuresSqlite implements DepotMesures`

Le même test les vérifie tous les deux. Il est écrit une fois, dans `test/contratDepot.test.ts`,
lignes 12 à 15 :

```ts
const adaptateurs: Record<string, () => DepotMesures> = {
  memoire: () => new DepotMesuresEnMemoire(),
  sqlite: () => new DepotMesuresSqlite(join(mkdtempSync(join(tmpdir(), "air-")), "m.db")),
};
```

Le choix de la technique est fait à un seul endroit, la racine de composition
(`urbanhub-air/src/principal.ts`, ligne 12) :

```ts
const depot = new DepotMesuresSqlite(env.BASE_MESURES ?? "mesures.db");
```

---

## 3. Toutes les entrées se valent

`urbanhub-air/src/ports.ts`, lignes 9 à 11 : le port **primaire**.

```ts
export interface EnregistrerMesure {
  executer(mesure: Mesure): Promise<void>;
}
```

**Pourquoi ces lignes le prouvent.** Deux adaptateurs d'entrée appellent le même cas
d'utilisation, de la même façon. Chacun traduit d'abord son format en `Mesure` :

- HTTP, `adaptateurs/entreeHttp.ts`, ligne 15 :
  ```ts
  await cas.executer(mesure(JSON.parse(await lireCorps(requete))));
  ```
- CSV, `adaptateurs/entreeCsv.ts`, lignes 10 et 11 :
  ```ts
  await enregistrerMesure.executer(mesure({ capteur, polluant,
    valeur: Number(valeur), horodatage }));
  ```

Les tests le confirment. `test/boutEnBout.test.ts` (par HTTP) et `test/entreeCsv.test.ts` (par
fichier) obtiennent la même alerte, de moyenne 55, pour les mêmes mesures 40 et 70.

---

## Ce qui rend les trois possibles

La règle de dépendance : le centre (`domaine.ts`, `ports.ts`, `regles.ts`, `service.ts`)
n'importe aucune technique. `test/regleDependance.test.ts` le vérifie, lignes 6 et 7 :

```ts
const CENTRE = ["domaine.ts", "ports.ts", "regles.ts", "service.ts"];
const INTERDIT = /from\s+["'](node:(sqlite|http|net)|\.\/adaptateurs\/)|\bfetch\(/;
```
