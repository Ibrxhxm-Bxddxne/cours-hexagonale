# TP 1, étape 3 : résultats des trois expériences

Pour chaque expérience : ce qui a changé, ce qui n'a pas bougé, et le prix payé (fichiers, temps,
lisibilité).

## Conditions de mesure

- Node.js 22.20, sous Windows 11.
- Les durées sont les `duration_ms` affichées par `node --test`. Chaque fichier a été lancé 3 fois
  et les tableaux donnent la fourchette des trois mesures.
- Les fichiers modifiés viennent de `git diff --stat 90a2a35 ce7483b`, entre le premier commit et le
  commit du TP.

**Suite complète :**

| | Tests | Réussis | Échecs |
|---|---|---|---|
| Avant le TP (code du cours) | 19 | 19 | 0 |
| Après les 3 expériences | **25** | **25** | **0** |

**Le centre n'a pas bougé.** La commande suivante n'affiche aucune différence :

```bash
git diff --stat 90a2a35 ce7483b -- urbanhub-air/src/domaine.ts urbanhub-air/src/ports.ts \
  urbanhub-air/src/regles.ts urbanhub-air/src/service.ts urbanhub-air/src/principal.ts
```

Elle ne renvoie rien : 0 ligne modifiée dans le centre et dans la racine de composition.

---

## Expérience 1 : un test qui tourne sans base

**Avantage testé :** la logique métier se teste seule.
**Fichier :** `test/experience1.test.ts`, qui contient 3 cas limites de la règle que le cours ne
testait pas.

### Résultats

| Test | Résultat | Durée |
|---|---|---|
| Une moyenne égale au seuil (50) ne déclenche rien | ok | 1,1 à 1,5 ms |
| Un autre polluant (NO2 à 90) ne déclenche pas la règle PM10 | ok | 0,16 à 0,26 ms |
| La veille ne compte pas dans la moyenne du jour | ok | 0,85 à 0,98 ms |

### Comparaison avec le code d'avant l'hexagone

| | `avant.test.ts` | `surveillance.test.ts` | `experience1.test.ts` |
|---|---|---|---|
| Durée | **91 à 145 ms** (1 test) | 1,6 à 2,7 ms (1 test) | **≈ 2,5 ms** (3 tests) |
| Base SQLite sur disque | oui | non | non |
| Faux serveur HTTP sur un port réseau | oui | non | non |
| Variables d'environnement à fixer avant l'`import` | 2 | 0 | 0 |
| Préparation | 6 étapes numérotées | 3 lignes | 3 lignes (fonction `assembler`) |

Le test en mémoire est environ **50 fois plus rapide**, et il n'a besoin de rien d'autre que Node.

### Ce qui a changé
- 1 fichier créé : `test/experience1.test.ts` (38 lignes).

### Ce qui n'a pas bougé
- Aucun fichier de `urbanhub-air/src/`.
- Le test réutilise l'adaptateur de test qui existait déjà (`depotMemoire.ts`).

### Le prix payé
- **Fichiers :** il faut un adaptateur de test par port secondaire. Ici, ils existaient déjà :
  `depotMemoire.ts` (15 lignes), et un faux publicateur d'une ligne.
- **Temps :** environ 10 minutes pour écrire les 3 cas.
- **Lisibilité :** chaque test se lit sans connaître SQL ni HTTP.
- **Limite :** ce test ne prouve pas que la vraie base fonctionne. C'est le rôle de
  `contratDepot.test.ts` et de `boutEnBout.test.ts`.
- **Ce que le code d'avant empêche :** `avant/enregistrerMesure.ts` ouvre sa base au chargement du
  module, à la ligne 5. Ses tests partageraient donc la même base, et le cas « la veille ne compte
  pas » serait faussé par les mesures des autres tests.

---

## Expérience 2 : un adaptateur remplacé

**Avantage testé :** la technique se remplace.
**Fichier créé :** `urbanhub-air/src/adaptateurs/depotFichierJson.ts`, qui range les mesures dans
un fichier JSON au lieu de SQLite.

### Résultats

`test/contratDepot.test.ts` est un seul test, écrit une fois par le cours. Les trois adaptateurs
le passent :

| Adaptateur | Résultat | Durée |
|---|---|---|
| `memoire` | ok | 1,5 à 1,9 ms |
| `sqlite` | ok | 44 à 54 ms |
| `json` (nouveau) | **ok** | 7 à 10 ms |

### Ce qui a changé
- 1 fichier créé : `depotFichierJson.ts` (26 lignes).
- 1 fichier modifié : `test/contratDepot.test.ts`, +2 lignes (l'import et la ligne `json:`).

### Ce qui n'a pas bougé
- `domaine.ts`, `ports.ts`, `regles.ts`, `service.ts` : 0 ligne modifiée.
- Le contenu du test de contrat : aucune vérification ajoutée, celles qui existaient suffisent.
- Les autres adaptateurs et les autres tests.

### Le prix payé
- **Fichiers :** 1 fichier de 26 lignes, plus 2 lignes de test.
- **Temps :**
  - environ 15 minutes pour écrire l'adaptateur ;
  - le vrai coût a été payé avant, par le cours, en concevant le port `DepotMesures`. Ce port rend
    des `Mesure[]` et laisse le calcul de la moyenne à la règle. S'il avait exposé une « moyenne du
    jour » calculée en SQL, comme le faisait le code d'avant, le nouvel adaptateur aurait dû la
    recalculer.
- **Lisibilité :**
  - il faut traduire à chaque frontière : texte JSON ↔ objet du domaine (`.map(mesure)`) ;
  - c'est la même traduction que `depotSqlite.ts` fait pour une ligne SQL.
- **Limite :**
  - l'adaptateur JSON relit tout le fichier à chaque appel : il est correct mais lent sur de gros
    volumes ;
  - le test de contrat vérifie le comportement, pas la performance.

---

## Expérience 3 : une entrée de plus

**Avantage testé :** toutes les entrées se valent.
**Fichiers créés :** `urbanhub-air/src/adaptateurs/entreeLigneDeCommande.ts` et
`test/experience3.test.ts`.

La ligne de commande lit `capteur polluant valeur horodatage` et appelle le même port
`EnregistrerMesure` que HTTP et CSV.

### Résultats

| Test | Résultat | Durée |
|---|---|---|
| Les mesures 40 puis 70 donnent l'alerte de moyenne 55 | ok | 2,1 à 3,1 ms |
| Des arguments incomplets sont refusés (code 2) | ok | 0,34 à 0,56 ms |

### Comparaison des trois entrées

Les trois entrées reçoivent les mêmes mesures et donnent la même alerte :

| Entrée | Test | Alerte obtenue | Mesure invalide |
|---|---|---|---|
| HTTP (`entreeHttp.ts`) | `boutEnBout.test.ts` | moyenne 55 | réponse 422 |
| CSV (`entreeCsv.ts`) | `entreeCsv.test.ts` | moyenne 55 | exception |
| Ligne de commande (nouvelle) | `experience3.test.ts` | **moyenne 55** | code de sortie 2 |

### Ce qui a changé
- 2 fichiers créés :
  - l'adaptateur `entreeLigneDeCommande.ts` (18 lignes) ;
  - son test `experience3.test.ts` (30 lignes).

### Ce qui n'a pas bougé
- **Aucun fichier existant modifié.**
- La validation de la mesure n'a pas été réécrite : elle reste dans `mesure()`, dans `domaine.ts`.
  L'adaptateur ne fait que traduire l'erreur `MesureInvalide` en code de sortie.

### Le prix payé
- **Fichiers :** 1 adaptateur et 1 test par nouvelle entrée.
- **Temps :** environ 10 minutes, en suivant le modèle de `entreeCsv.ts` (13 lignes).
- **Lisibilité :**
  - pour suivre une mesure, il faut ouvrir 3 fichiers : l'entrée, le port (`ports.ts`) et le
    service (`service.ts`), au lieu d'une seule fonction ;
  - la traduction des erreurs est refaite dans chaque entrée (422 en HTTP, code 2 en ligne de
    commande).

---

## Bilan

| Expérience | Créé | Modifié | Centre touché | Tests ajoutés | Durée des nouveaux tests |
|---|---|---|---|---|---|
| 1. Test sans base | 1 fichier (38 l.) | — | non | 3 | ≈ 2,5 ms (contre 91 à 145 ms avant) |
| 2. Adaptateur remplacé | 1 fichier (26 l.) | 1 fichier (+2 l.) | non | 1 | 7 à 10 ms |
| 3. Entrée de plus | 2 fichiers (48 l.) | — | non | 2 | ≈ 3 ms |
| **Total** | **4 fichiers** | **1 fichier** | **0 ligne** | **6** | |

Les trois expériences n'ont touché que la périphérie : les tests et les adaptateurs. Le centre est
resté identique. C'est la règle de dépendance du cours : les dépendances pointent vers le centre,
donc ce qui change autour ne le touche pas.
