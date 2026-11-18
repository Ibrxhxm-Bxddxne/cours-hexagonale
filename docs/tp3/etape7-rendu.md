# TP 3, étape 7 : le rendu dans le dépôt du groupe

**Consigne :** pousser (`git push`) dans un dépôt du groupe, créé pour ce TP et ouvert à
Mekouar-Ayoub. Ajouter au README le lien, l'empreinte du commit et le chemin du livrable, pour le
mail du module.

**La différence avec les TP 1 et 2 :** ils se rendaient dans le dépôt du binôme. Le TP 3, lui,
se rend dans un **nouveau** dépôt, celui du groupe (slide 5 : « TP 3 : celui du groupe »).

**Le résultat :**

| | |
|---|---|
| **Dépôt du groupe** | https://github.com/Ibrxhxm-Bxddxne/urbanhub-tp3 |
| **Commit des livrables** | `7bf1980` (9 fichiers : README, six documents, manifeste, Dockerfile) |
| **Chemin du livrable** | le README du dépôt du groupe ; `docs/`, `k8s/trafic.yaml` |

---

## 1. Ce qui a été préparé

Un dossier prêt à devenir le dépôt du groupe : `c:\Users\pc\Desktop\Hexagonale\urbanhub-tp3\`. Il
est à côté de `node/`, et ce n'est **pas encore** un dépôt git.

| Fichier | Contenu |
|---|---|
| `README.md` | la question, notre réponse, les livrables, les chiffres clés, et la section **Rendu** à compléter |
| `docs/etape1…6-*.md` | les six documents de `docs/tp3/` |
| `k8s/trafic.yaml` | le manifeste Kubernetes (étape 5) |
| `Dockerfile.trafic` | l'image du service Trafic (étape 5) |

### Les liens vers le code

Le dépôt du groupe ne contient pas le code. Les liens relatifs vers le code (`../../urbanhub-…`)
ont donc été remplacés par des liens vers le dépôt du binôme, **figés sur le commit `079855e`**.
Quand le code évoluera aux TP 4 et 5, ce que lit l'enseignant restera ce que nous avons étudié.

Les liens vers `k8s/trafic.yaml` et `Dockerfile.trafic` restent relatifs : ces fichiers sont
copiés dans le dépôt du groupe.

### Dans le dépôt du binôme (ce dépôt)

- La section « Rendus » du [README](../../README.md) a maintenant une partie **TP 3**. Elle donne :
  - le lien du dépôt du groupe ;
  - l'empreinte du commit ;
  - le chemin du livrable ;
  - les commits des étapes 1 à 6 faits ici.
- Le mail final reprendra les trois lignes **de chaque TP** : ce README les rassemble toutes.

---

## 2. Ce qui reste à faire à la main

### a. Créer le dépôt sur GitHub et y pousser les livrables

1. Sur GitHub, cliquez sur **New repository**.
   - Donnez-lui un nom, par exemple `urbanhub-tp3`.
   - Laissez-le **vide** : ni README, ni `.gitignore`.
2. Dans `urbanhub-tp3/README.md`, remplacez `<noms des membres du groupe>` par vos noms.
3. Puis, dans PowerShell :

```powershell
cd C:\Users\pc\Desktop\Hexagonale\urbanhub-tp3
git init -b main
git add README.md docs k8s Dockerfile.trafic
git commit -m "TP3 : livrables (schemas, comparatif, vue d'ensemble, manifeste, conclusion)"
git remote add origin <URL du dépôt du groupe>
git push -u origin main
git log --oneline -1
```

La dernière commande affiche l'empreinte du commit des livrables : ce sont les 7 caractères au
début de la ligne.

### b. Noter le lien et l'empreinte dans les deux README

Dans **deux** fichiers, remplacez `<URL du dépôt du groupe>` et `<empreinte>` :
- `urbanhub-tp3/README.md`, section **Rendu** ;
- `node/README.md`, section **Rendus → TP 3**.

Comme aux TP 1 et 2, l'empreinte citée est celle du commit **qui contient les livrables**. Un
commit ne peut pas contenir sa propre empreinte, d'où ce second commit :

```powershell
# dans urbanhub-tp3
git add README.md
git commit -m "TP3 : rendu (lien, empreinte et chemin du livrable)"
git push

# dans node (le depot du binome)
cd C:\Users\pc\Desktop\Hexagonale\node
git add README.md docs/tp3/etape7-rendu.md
git commit -m "TP3 etape 7 : rendu dans le depot du groupe"
git push origin main
```

### c. Ouvrir le dépôt à l'enseignant

Sur GitHub, dans le dépôt du groupe : **Settings → Collaborators → Add people → Mekouar-Ayoub**.

Ajoutez aussi les autres membres du groupe, s'ils ne sont pas encore collaborateurs.

### d. Vérifier sur GitHub

- Le README s'affiche, et ses liens ouvrent les bons documents.
- Les schémas Mermaid des étapes 2 et 4 sont dessinés.
- Les liens vers le code ouvrent les fichiers du dépôt du binôme au commit `079855e`.
