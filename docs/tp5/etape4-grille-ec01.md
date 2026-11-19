# TP 5, étape 4 : la grille EC01, pour C4.1 et C5.1

**Consigne :** reprenez la grille EC01 : pour C4.1 et C5.1, écrivez ce que vos TP prouvent déjà,
et où.

**Livrable touché :** [`docs/retour-experience.md`](../retour-experience.md), partie 4.

**Source :** les pages du cours sur l'EC01.
- **C4.1** : « Adéquation aux besoins et contraintes projet ».
- **C5.1** : « Argumentation technique (performance, sécurité, maintenabilité) ».
- 11 critères notés 0, 2, 3 ou 5. L'épreuve dure 3 heures, seul, et part du dépôt. Elle rend une
  archive ZIP qui contient le dépôt, le dossier d'architecture, le README et la déclaration
  d'usage de l'IA.
- Les règles de rédaction : un choix, une raison ; une preuve par affirmation ; le coût à côté ;
  l'IA déclarée ; relire en exécutant.

---

## Ce qui a été fait

| Partie | Contenu |
|---|---|
| § 4.1, C4.1 | 7 attentes. Pour chacune : ce que les TP prouvent, où, et ce qui manque |
| § 4.2, C5.1 | Trois tableaux : **performance** (5 lignes), **sécurité** (5 preuves et 3 manques), **maintenabilité** (6 preuves et 2 manques) |
| § 4.3 | Le bilan par critère : ce qui est solide, et ce qu'il faut ajouter ou écrire comme limite |

## Ce qui a été vérifié dans le code à cette étape

La sécurité n'avait été traitée dans aucune fiche. J'ai donc relu le code au lieu de citer les
TP :

| Vérification | Résultat |
|---|---|
| `grep prepare\|exec(` dans les adaptateurs SQLite | toutes les requêtes sont préparées avec `?` ; `exec` ne sert qu'au schéma, qui est constant |
| `grep USER\|chown\|omit` dans les Dockerfiles | `USER node`, `npm ci --omit=dev` dans les deux images |
| `k8s/trafic.yaml` | configuration en `readOnly`, `limits: { memory: 256Mi }`, sondes |
| `entreeHttp.ts` de Trafic | un 500 répond un corps vide ; mais `lireCorps` lit **sans limite de taille** |
| recherche de `authorization`, `token`, `secret` dans `src/` | **rien** : aucune authentification |
| `compose.tp4.yaml` | Kafka en `PLAINTEXT` |
| `npm audit --omit=dev` | `found 0 vulnerabilities` |
| `depotSqlite.ts` | index `releve_par_troncon_et_heure` sur `(troncon, horodatage)` |

## Ce qui en ressort

- **La maintenabilité est le point fort** : chaque affirmation a son commit ou son test.
- **La sécurité est le point faible** : aucun TP ne la demandait. Il manque l'authentification,
  une limite de taille des requêtes, et le chiffrement de Kafka. Ces manques sont écrits tels
  quels, pour être traités dans le plan du dossier (question 5).
- **La performance est mesurée mais pas testée en charge.** Le signal n° 3 du TP 3 (200 ms au
  95ᵉ centile) n'a encore jamais été mesuré.
- **Une phrase a été retirée** à la relecture. J'avais attribué au cours une idée que je ne
  pouvais pas sourcer (« un service sans règle métier ne mérite pas d'hexagone »).

## Vérifications

```
npm test     # tests 127, pass 127, fail 0
```

Tous les liens relatifs du retour d'expérience et de cette fiche pointent vers des fichiers
existants.
