# TP 2, étape 8 : le rendu

**Consigne :** pousser (`git push`) dans le dépôt UrbanHub du binôme, celui du TP 1, partagé avec
Mekouar-Ayoub. Noter dans le README le lien, l'empreinte du commit (son identifiant) et le chemin du
livrable : le mail final du module (ayoubmekouar@gmail.com) les reprendra.

## Ce qui a été fait

| Élément demandé | Valeur | Où |
|---|---|---|
| Dépôt | celui du TP 1 : https://github.com/Ibrxhxm-Bxddxne/cours-hexagonale | README, « Rendus », TP 2 |
| Empreinte du commit | `9ddb939` | README, « Rendus », TP 2 |
| Chemin du livrable | le README (section « Service Trafic (TP 2) ») et le code `urbanhub-trafic/` | README, « Rendus », TP 2 |
| Commit du remplacement de l'adaptateur | `197c622` | README, « Rendus » et « Remplacement d'un adaptateur » |

### Pourquoi l'empreinte citée est `9ddb939`, et pas celle du dernier commit

Un commit ne peut pas contenir sa propre empreinte : elle est calculée à partir de son contenu.
Changer le README pour y écrire l'empreinte change donc l'empreinte. Nous citons `9ddb939`, le commit
de l'étape 7, qui contient **tout le livrable** : le code, les tests, le README avec la règle, le
schéma et les patrons.

Le commit de cette étape 8 n'ajoute que la section « Rendus » du README et ce document.

## Vérifications faites avant le rendu

| Vérification | Résultat |
|---|---|
| `npm test` | **67 / 67** |
| `git status` | rien à commiter, en dehors de `mesures.db` (une base locale, qu'on ne commite pas) |
| `origin/main` avant cette étape | `9ddb939` : les étapes 1 à 7 sont sur GitHub |
| `git show --stat 197c622` | 2 fichiers : `etatsSqlite.ts` et `principal.ts` |
| Liens du README | ils pointent tous vers des fichiers qui existent |

## Ce qui reste à faire à la main

1. Commiter et pousser cette étape (voir les commandes ci-dessous).
2. Vérifier sur GitHub, dans **Settings → Collaborators**, que **Mekouar-Ayoub** a toujours accès
   au dépôt. Il a été invité au TP 1 ; s'il n'a pas encore accepté l'invitation, elle reste en
   attente.
3. Ouvrir la page du dépôt sur GitHub et vérifier que :
   - le README s'affiche ;
   - le schéma Mermaid est dessiné ;
   - les liens fonctionnent.

```powershell
git add README.md docs/tp2-etape8-rendu.md
git commit -m "TP2 etape 8 : rendu (lien, empreinte et chemin du livrable)"
git push origin main
```
