# Rapport du TP 1 : trois avantages de l'hexagone, prouvés

**Module :** Architecture hexagonale, EADL. **Critère :** C4, concevoir l'architecture (avantages et
contraintes argumentés sur un cas réel).

- **Service étudié :** Qualité de l'air d'UrbanHub (`urbanhub-air/`).
- **Service comparé :** Alertes (`urbanhub-alertes/`).
- **Environnement :** Node.js 22.20, Windows 11. `npm test` passe 19 / 19 sur le code du cours, puis
  **25 / 25** après les trois expériences.

### Les commits

| Empreinte | Contenu |
|---|---|
| `90a2a35` | Code du cours |
| `36fbb2a` | Étape 2 : trois avantages et leurs preuves |
| `a3680f4` | Expérience 1 : test sans base |
| `5f1822b` | Expérience 2 : adaptateur remplacé |
| `a80b807` | Expérience 3 : entrée de plus |
| `5248c6c`, `fcd73d7` | Étape 3 : résultats des expériences |
| `fb2636a` | Étape 4 : comparaison avec le service Alertes |

### Les documents détaillés

- [Étape 2 : les trois avantages et leurs preuves](etape2-trois-avantages.md)
- [Étape 3 : les résultats des expériences](etape3-resultats-experiences.md)
- [Étape 4 : la comparaison avec Alertes](etape4-comparaison-backend.md)

---

## 1. La logique métier se teste seule

### L'extrait

`urbanhub-air/src/service.ts`, ligne 12 :

```ts
  constructor(depot: DepotMesures, alertes: PublicateurAlertes, regle: Regle) {
```

Le cas d'utilisation ne reçoit que des **ports**. Il ne crée ni base ni connexion réseau. Un test
peut donc lui donner un dépôt en mémoire et un faux publicateur.

### L'expérience (commit `a3680f4`)

Le fichier `test/experience1.test.ts` teste trois cas limites de la règle que le cours ne testait
pas, tous en mémoire :
- une moyenne égale à 50 ne déclenche rien ;
- le polluant NO2 est ignoré ;
- la veille ne compte pas dans la moyenne du jour.

| | `avant.test.ts` (sans hexagone) | `experience1.test.ts` |
|---|---|---|
| Durée | **91 à 145 ms** pour 1 test | **≈ 2,5 ms** pour 3 tests |
| Base SQLite sur disque | oui | non |
| Faux serveur HTTP | oui | non |
| Préparation | 6 étapes et 2 variables d'environnement | 3 lignes |

- **Ce qui a changé :** 1 fichier de test créé, 38 lignes.
- **Ce qui n'a pas bougé :** aucun fichier de `src/`.

### Le prix

- **Fichiers :** un adaptateur de test par port secondaire. Il existait déjà : `depotMemoire.ts`
  (15 lignes), et un faux publicateur d'une ligne.
- **Limite :** ce test ne prouve pas que la vraie base fonctionne. Cela reste le rôle du test de
  contrat et du test de bout en bout.
- **Lisibilité :** chaque test se lit sans connaître SQL ni HTTP.

### L'effet chez nous

**Alertes l'a déjà.** `urbanhub-alertes/src/service.ts`, ligne 14 :

```ts
  constructor(operateurs: Operateurs) {
```

Son test d'idempotence tourne en **1,5 à 1,9 ms**, sans réseau. Il n'y a rien à ajouter.

---

## 2. La technique se remplace

### L'extrait

`urbanhub-air/src/ports.ts`, lignes 14 à 17 :

```ts
export interface DepotMesures {
  enregistrer(mesure: Mesure): void;
  duJour(capteur: string, polluant: string, jour: string): Mesure[];
}
```

Le service ne connaît que ce contrat. Le même test, `contratDepot.test.ts`, écrit une fois, vérifie
chacun des adaptateurs.

### L'expérience (commit `5f1822b`)

Nous avons ajouté un troisième adaptateur, `depotFichierJson.ts` (26 lignes), qui range les mesures
dans un fichier JSON. Une seule ligne a suffi pour le soumettre au test de contrat existant :

```ts
  json: () => new DepotMesuresFichierJson(join(mkdtempSync(join(tmpdir(), "air-")), "m.json")),
```

| Adaptateur | Test de contrat | Durée |
|---|---|---|
| mémoire | ok | 1,5 à 1,9 ms |
| SQLite | ok | 44 à 54 ms |
| **JSON (nouveau)** | **ok** | 7 à 10 ms |

- **Ce qui a changé :** 1 fichier créé, 2 lignes ajoutées au test de contrat.
- **Ce qui n'a pas bougé :** `domaine.ts`, `ports.ts`, `regles.ts`, `service.ts`, avec 0 ligne
  modifiée. On le vérifie avec `git diff --stat 90a2a35 a80b807` sur ces fichiers, qui n'affiche
  rien.

### Le prix

- **Le port se conçoit avant de coder.** `duJour` rend des `Mesure[]` et laisse le calcul de la
  moyenne à la règle. S'il avait rendu une « moyenne du jour » calculée en SQL, comme le code
  d'avant, chaque nouvel adaptateur aurait dû la recalculer.
- **Une traduction à chaque frontière :** texte JSON ↔ objet du domaine (`.map(mesure)`).
- **Le contrat vérifie le comportement, pas la performance.** Notre adaptateur relit tout le fichier
  à chaque appel : il est correct mais lent sur de gros volumes.

### L'effet chez nous

**C'est l'avantage qui manque le plus à Alertes.** `urbanhub-alertes/src/service.ts`, ligne 12 :

```ts
  #dejaTraitees = new Set<string>();       // en production : une table
```

La mémoire des alertes déjà traitées est une technique écrite **dans le centre**, sans port.

**Essai :** deux instances reçoivent la même alerte, comme après un redémarrage ou avec deux copies
du service. Résultat : **les opérateurs sont prévenus 2 fois**. La seule règle du service,
l'idempotence, ne tient que tant que le processus reste en vie et seul.

**Le mérite-t-il ? Oui, en priorité.** Il faudrait :
- un port `JournalAlertes { marquerSiNouvelle(id): boolean }` ;
- deux adaptateurs, en mémoire et en SQLite ;
- un test de contrat.

Cela fait environ 3 fichiers et 40 lignes. Le port doit vérifier et marquer **en une seule
opération** : sinon, deux copies du service peuvent toutes les deux répondre « pas encore vue ».

---

## 3. Toutes les entrées se valent

### L'extrait

`urbanhub-air/src/ports.ts`, lignes 9 à 11 : le port primaire.

```ts
export interface EnregistrerMesure {
  executer(mesure: Mesure): Promise<void>;
}
```

HTTP (`entreeHttp.ts`, ligne 15) et CSV (`entreeCsv.ts`, ligne 10) traduisent leur format, puis
appellent tous les deux `executer(mesure(...))`.

### L'expérience (commit `a80b807`)

Nous avons ajouté une troisième entrée, `entreeLigneDeCommande.ts` (18 lignes), et son test
`experience3.test.ts`.

| Entrée | Mêmes mesures (40 puis 70) | Mesure invalide |
|---|---|---|
| HTTP | alerte de moyenne 55 | réponse 422 |
| CSV | alerte de moyenne 55 | exception |
| **Ligne de commande (nouvelle)** | **alerte de moyenne 55** | code de sortie 2 |

- **Ce qui a changé :** 2 fichiers créés, 48 lignes.
- **Ce qui n'a pas bougé :** **aucun fichier existant**. La validation n'a pas été réécrite : elle
  reste dans `mesure()`, dans le domaine.

### Le prix

- **Fichiers :** un adaptateur et un test par entrée.
- **Lisibilité :** pour suivre une mesure, il faut ouvrir l'entrée, puis le port, puis le service, au
  lieu d'une seule fonction.
- **Duplication :** chaque entrée traduit les erreurs dans sa langue (422, code 2).

### L'effet chez nous

**Alertes ne l'a pas.** `urbanhub-alertes/src/entreeHttp.ts`, lignes 2 et 9 :

```ts
import type { ReceptionAlertes } from "./service.ts";
    const alerte = JSON.parse(corps);
```

L'entrée dépend de la **classe**, pas d'un port primaire, et elle ne valide rien.

**Essai :** un `POST /alertes` avec le corps `pas du json` **arrête tout le service** (code de
sortie 1). Les alertes suivantes sont alors perdues.

**Le mérite-t-il ?**
- **Le port primaire : plus tard.** Avec une seule entrée, une interface de plus serait un détour
  sans bénéfice. Il deviendra utile quand Kafka arrivera comme deuxième entrée (TP 4).
- **La validation dans le domaine : tout de suite.** C'est un défaut, pas une question
  d'architecture. Il faut une fonction `alerteRecue()` comme `mesure()`, et une réponse 422.

---

## Conclusion

| Avantage | Preuve (Qualité de l'air) | Expérience | Prix | Chez Alertes |
|---|---|---|---|---|
| Logique testée seule | `service.ts` l. 12 | ≈ 2,5 ms contre 91 à 145 ms | un adaptateur de test par port | ✅ déjà là |
| Technique remplaçable | `ports.ts` l. 14-17 | dépôt JSON : 0 ligne du centre touchée | un port à concevoir avant | ❌ **à ajouter en priorité** |
| Entrées équivalentes | `ports.ts` l. 9-11 | ligne de commande : 0 fichier existant modifié | plus de fichiers, des détours | ❌ port plus tard ; validation tout de suite |

Les trois expériences n'ont touché que la périphérie : les tests et les adaptateurs. Le centre est
resté identique. C'est la règle de dépendance : les dépendances pointent vers le centre, donc ce qui
change autour ne le touche pas.

Le cours le dit : « l'hexagone protège une règle métier. Sans règle, il n'a rien à protéger. »
Alertes n'a que 3 fichiers, mais il a une vraie règle, l'idempotence. Et c'est précisément cette
règle qui casse, parce que sa technique (un `Set` en mémoire) est restée dans le centre.
L'hexagone ne se mesure pas au nombre de fichiers, mais à ce qu'il protège.
