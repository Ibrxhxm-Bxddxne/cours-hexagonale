# TP 2, étape 7 : les deux patrons justifiés dans le README

**Consigne :** dans le README, pour chaque patron, donner le problème, ce qu'il améliore
(maintenabilité : modifier ; scalabilité : tenir la charge) et ce qu'il coûte.

**Ce qui a été fait :** la section « Service Trafic (TP 2) » du [README](../README.md) contient
maintenant les trois éléments que demandent les livrables :

| Livrable demandé | Où dans le README |
|---|---|
| La règle de gestion | « Règle de gestion », en une phrase (étape 1) |
| **Le schéma** | « Schéma » : un diagramme Mermaid, affiché directement par GitHub |
| **Les deux patrons justifiés** | « Les deux patrons » : un tableau par patron |

Le README cite aussi le commit du remplacement de l'adaptateur (étape 6), et la commande
`npm run trafic` a été ajoutée à la liste des commandes.

---

## 1. Le schéma

Le diagramme montre :

- **Le centre**, sans aucun import technique :
  - le port primaire `RecevoirReleve` ;
  - le cas d'utilisation `SurveillanceTrafic` ;
  - la Stratégie `RegleCongestion` ;
  - le domaine ;
  - les 4 ports secondaires.
- **L'adaptateur primaire** `entreeHttp.ts` (`POST /releves`), qui appelle le port primaire.
- **Les adaptateurs secondaires**, tels que la racine de composition les branche après l'étape 6 :
  - `DepotRelevesSqlite` ;
  - `ReferentielTronconsEnMemoire` ;
  - `EtatsTronconsSqlite` ;
  - le Décorateur `PublicateurAvecReessai`, autour de `PublicateurSignalementsHttp`.
- **Le sens des dépendances** : les flèches pleines vont vers le centre ; les flèches pointillées
  (« implémente ») partent des adaptateurs vers les ports.

Le schéma a été vérifié contre `principal.ts`. Chaque boîte du diagramme correspond à un objet créé
dans la racine de composition, et inversement.

---

## 2. La grille utilisée pour chaque patron

Les deux patrons sont décrits dans le même ordre, pour qu'on puisse les comparer :

1. **Le problème**, concret et mesuré :
   - pour la Stratégie, un faux bouchon à 03:00, et un double signalement à 08:00 et 08:32 ;
   - pour le Décorateur, personne n'est prévenu à 08:00 après une panne passagère.
2. **La solution**, en une phrase, et l'endroit où on la choisit (`principal.ts`).
3. **La maintenabilité** : ce qu'on peut modifier sans toucher au reste.
4. **La scalabilité** : l'effet sous charge, **y compris quand il est faible ou négatif**.
5. **Le coût** : fichiers, paramètres, temps de réponse, concepts en plus.
6. **La preuve** : le test qui montre le problème, puis la solution.

### Le bilan des deux patrons

| | Stratégie | Décorateur |
|---|---|---|
| Problème | une règle qui se trompe la nuit et qui doit pouvoir changer | une panne réseau passagère qui retarde le signalement |
| Maintenabilité | ✅ forte : une règle = une classe, le service ne bouge pas | ✅ forte : écrit une fois, pour tout publicateur |
| Scalabilité | ➖ faible : moins de faux signalements à traiter en aval | ✅ positive, ⚠️ mais les requêtes restent ouvertes jusqu'à environ 7,5 s en cas de panne |
| Coût principal | un concept « pas de conclusion » et un réglage à documenter | du temps de réponse et des doublons possibles |

### Pourquoi nous disons aussi ce qui ne va pas

Le critère d'évaluation demande des « choix techniques **argumentés** ». Un patron sans coût n'est
pas argumenté.

- **La Stratégie** n'apporte presque rien à la scalabilité, et nous le disons.
- **Le Décorateur** améliore la tenue face aux pannes courtes, mais il **aggrave** une panne longue :
  les connexions des capteurs s'accumulent pendant les essais. Cette limite annonce le coupe-circuit
  du TP 4. C'est d'ailleurs pour lui que `CircuitOuvert` existe déjà dans Qualité de l'air.

---

## 3. Vérifications

- `npm test` : **67 / 67**.
- Chaque lien du README pointe vers un fichier qui existe.
- Les chiffres cités dans le README viennent des essais des étapes 5 et 6 : 03:00, 08:00 et 08:32,
  `[500, 1000]`, 1 signalement contre 2.
