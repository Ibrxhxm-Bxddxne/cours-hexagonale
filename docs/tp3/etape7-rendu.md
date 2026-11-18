# TP 3, étape 7 : le rendu

**Consigne :** pousser (`git push`), puis noter au README le lien, l'empreinte du commit et le
chemin du livrable, pour le mail du module.

**La consigne de l'enseignant :** l'énoncé (et la slide 5) parlait d'un dépôt de groupe créé pour
ce TP. L'enseignant a précisé qu'il faut **un seul dépôt**. Le TP 3 se rend donc, comme les TP 1
et 2, dans le dépôt UrbanHub du binôme.

## Le rendu

| | |
|---|---|
| **Lien du dépôt** | https://github.com/Ibrxhxm-Bxddxne/cours-hexagonale |
| **Empreinte du commit** | `079855e` (TP3 étape 6 : conclusion) |
| **Chemin du livrable** | [`docs/tp3/README.md`](README.md) (le sommaire), avec [`k8s/trafic.yaml`](../../k8s/trafic.yaml) et [`Dockerfile.trafic`](../../Dockerfile.trafic) |

**Pourquoi `079855e`.** C'est le commit de l'étape 6. Il contient **tous** les livrables : les deux
schémas, le comparatif, la vue d'ensemble, la gestion des services, le manifeste et la conclusion.

Les commits suivants n'ajoutent que la tenue du rendu :
- le sommaire `docs/tp3/README.md` ;
- ce document ;
- la section « Rendus » du README.

Comme aux TP 1 et 2, un commit ne peut pas citer sa propre empreinte.

## Ce qui s'est passé avec le dépôt `urbanhub-tp3`

Avant la précision de l'enseignant, un dépôt de groupe avait été créé et poussé :
https://github.com/Ibrxhxm-Bxddxne/urbanhub-tp3 (commits `7bf1980` et `a8c9190`).

Il contenait une **copie** des documents de `docs/tp3/`, du manifeste et du Dockerfile. Il
n'apporte donc rien que ce dépôt-ci n'ait déjà, et il **n'est plus le rendu**. Le commit `0d3af76`
de ce dépôt, qui pointait vers lui, est corrigé par le commit suivant. Nous ne réécrivons pas
l'historique, qui est déjà poussé.

Le dépôt `urbanhub-tp3` peut être supprimé sur GitHub : **Settings → Danger Zone → Delete this
repository**. Ainsi, l'enseignant ne trouvera pas deux versions du TP 3.

## Vérifications

| Vérification | Résultat |
|---|---|
| Les livrables sont dans ce dépôt, au commit `079855e` | oui : `docs/tp3/etape1…6`, `k8s/trafic.yaml`, `Dockerfile.trafic` |
| Les liens du sommaire et de la section « Rendus » | ils pointent tous vers des fichiers qui existent |
| `npm test` | 67 / 67 |
