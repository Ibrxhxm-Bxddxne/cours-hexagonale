# TP 4, étape 7 : le rendu

**Consigne :**
- pousser (`git push`) dans le dépôt UrbanHub du binôme, ouvert à Mekouar-Ayoub ;
- ajouter au README le lien, l'empreinte du commit et le chemin du livrable.

Comme pour les TP 1 à 3, le rendu se fait dans **le seul** dépôt du binôme.

## Le rendu

| | |
|---|---|
| **Lien du dépôt** | https://github.com/Ibrxhxm-Bxddxne/cours-hexagonale |
| **Empreinte du commit** | `0996b1a` (TP4 étape 6) |
| **Chemin du livrable** | le README, section « Trafic et Notifications en microservices (TP 4) » ; le détail dans [`docs/tp4/README.md`](README.md) |

**Pourquoi `0996b1a`.** C'est le commit de l'étape 6. Il contient tout le **code** et toutes les
**traces** du TP :
- les deux services et leurs tests verts ;
- les deux adaptateurs de publication ;
- la trace du scénario, de la panne et du rejeu.

Le commit de cette étape 7 ajoute la **section du README** : le schéma, les livrables, ce que
montrent les traces, et le tableau des défis et de leurs solutions. Il ajoute aussi le sommaire
`docs/tp4/README.md` et ce document. Comme aux TP 1 à 3, un commit ne peut pas citer sa propre
empreinte. Pour lire la section du README, il suffit d'ouvrir le dépôt à son dernier commit.

## Ce que demandent les livrables, et où ils sont

| Livrable demandé | Où |
|---|---|
| Les deux services et leurs tests verts | `urbanhub-trafic/`, `urbanhub-notifications/` ; `npm test` : 127 / 127 |
| Les deux adaptateurs de publication | `urbanhub-trafic/src/adaptateurs/publicationHttp.ts` et `publicationKafka.ts` |
| Les traces du scénario, de la panne et du rejeu | `docs/tp4/trace-etape6.txt` |
| Les défis et leurs solutions **dans le README** | README, « Les défis rencontrés et leurs solutions » (9 défis) |

## Vérifications

| Vérification | Résultat |
|---|---|
| `origin/main` avant cette étape | `0996b1a` : les étapes 1 à 6 sont sur GitHub |
| `npm test` | 127 / 127 |
| Les liens du README et de `docs/tp4/` | ils pointent tous vers des fichiers qui existent |

## Ce qui reste à faire à la main

1. Commiter et pousser cette étape.
2. Sur GitHub, ouvrir le README et vérifier que :
   - le schéma Mermaid du TP 4 est dessiné ;
   - les liens fonctionnent.
3. Arrêter la pile Docker si elle tourne encore :
   `docker compose -f compose.tp4.yaml down -v`.
