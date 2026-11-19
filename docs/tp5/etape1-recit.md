# TP 5, étape 1 : raconter ce que j'ai construit aux TP 2 à 4

**Consigne :** racontez ce que vous avez construit aux TP 2 à 4 : le besoin, le découpage, les
patrons, la communication (HTTP, file ou journal).

**Livrable touché :** [`docs/retour-experience.md`](../retour-experience.md), partie 1.

---

## Ce qui a été fait

| Point de la consigne | Où, dans le retour d'expérience | Sources relues |
|---|---|---|
| Le besoin | § 1.1 : la règle de congestion, les trois questions du cours (1.4), puis le besoin de Notifications | [TP 2, étape 1](../tp2-etape1-choix-du-service.md), [TP 4, étape 1](../tp4/etape1-decoupage.md) |
| Le découpage | § 1.2 : un hexagone (TP 2), une étude (TP 3), deux microservices (TP 4) ; les deux contextes délimités | [TP 3, étape 6](../tp3/etape6-conclusion.md), [TP 4, étape 1](../tp4/etape1-decoupage.md) |
| Les patrons | § 1.3 : 8 patrons, chacun avec le problème qu'il règle et son fichier | README, sections TP 2 et TP 4 |
| La communication | § 1.4 : HTTP et journal (Kafka) construits, la file non utilisée, l'appel en processus seulement dessiné | [TP 4, étapes 2, 5 et 6](../tp4/README.md) |

## Les choix d'écriture

- **À la première personne du singulier.** Le TP 5 est individuel (« seul, sur vos TP 2 à 4 »).
- **Les chiffres sont mesurés sur le dépôt**, pas recopiés de mémoire :
  - la taille des centres et des adaptateurs, par `wc -l` : Trafic 226 et 326 lignes,
    Notifications 155 et 172 ;
  - le nombre de commits par TP, par `git log --oneline`.
- **J'ai signalé l'écart entre les TP 3 et 4** : le TP 3 conclut au monolithe, le TP 4 construit
  des microservices. C'était un exercice, et le bilan (étapes suivantes) devra en tenir compte.
- **J'ai dit ce que je n'ai pas fait** : pas de file de messages comme RabbitMQ.

## Vérifications

```
npm test     # tests 127, pass 127, fail 0
```

Tous les liens relatifs de `docs/retour-experience.md` et de cette fiche pointent vers des
fichiers existants.
