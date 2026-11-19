# TP 5, étape 5 : le plan du dossier d'architecture

**Consigne :** rédigez le plan du dossier : besoin, architecture, découpage, patrons,
communication, déploiement ; pour chaque choix, la raison et le prix, avec une preuve (un test,
un commit, une trace).

**Livrable créé :** [`docs/plan-dossier-ec01.md`](../plan-dossier-ec01.md).

---

## Ce qui a été fait

**Les six parties demandées, plus deux.**
- La **sécurité** (partie 7) : la grille EC01 la note dans C5.1, et l'étape 4 a montré que c'est
  le point le plus faible.
- Les **limites et évolutions** (partie 8) : ce que le dossier ne prouve pas.

**Les annexes** préparent la question 6 (commandes à rejouer, déclaration d'usage de l'IA).
Elles donnent aussi l'index des preuves par commit, et la correspondance avec la grille.

| Partie | Choix | Dont ⏳ (pas encore fait) |
|---|---|---|
| 1. Le besoin | 4 | 1 : les besoins non fonctionnels chiffrés |
| 2. L'architecture | 5 | — |
| 3. Le découpage | 4 | — |
| 4. Les patrons | 5 | — |
| 5. La communication | 6 | 2 : le topic d'erreurs (R2), le contrat versionné (R3) |
| 6. Le déploiement | 6 | 1 : appliquer le manifeste, `GET /sante` |
| 7. La sécurité | 7 | 3 : l'authentification, la limite de taille, Kafka chiffré |
| **Total** | **37** | **7** |

## Les règles suivies

- **Chaque choix a ses quatre colonnes remplies** : choix, raison, prix, preuve. C'est ce que le
  camarade vérifiera à la question 7 : une case « raison » vide se voit tout de suite.
- **Chaque preuve est typée** : **T** (test), **C** (commit), **M** (mesure ou trace) ou **F**
  (fichier).
- **Un choix pas encore fait est marqué ⏳.** Il est présenté comme une décision à prendre, avec
  son prix, jamais comme acquis.
- **Le découpage est présenté sans contradiction.** D-2 donne la décision d'aujourd'hui, le
  monolithe hexagonal. D-4 présente le TP 4 comme un découpage **exercé** pour prouver les
  coutures.

## Les erreurs trouvées en vérifiant les preuves

- **S-1 citait une preuve qui ne prouvait rien pour Trafic.** `boutEnBout.test.ts` vérifie le 422
  de **Qualité de l'air**. J'ai cherché un test qui envoie un relevé invalide à Trafic, par `grep`
  de `422` et de `ReleveInvalide` dans `test/` : il n'y en a **aucun**.
  - Le plan le marque ⏳ (« à ajouter »).
  - La partie 4 du [retour d'expérience](../retour-experience.md) est corrigée dans le même sens.
- **E-5 : Trafic ne gère pas `SIGTERM`.** Seuls `principal.ts` et `audit.ts` de Notifications le
  font (`grep SIGTERM`). Le plan l'écrit dans la colonne du prix.

## Vérifications

```
npm test     # tests 127, pass 127, fail 0
```

Tous les liens relatifs du plan, du retour d'expérience et de cette fiche pointent vers des
fichiers existants.
