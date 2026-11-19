# TP 5, étape 3 : la comparaison avec Segment, et trois recommandations

**Consigne :** comparez avec l'un des deux cas du 5.1, Segment (l'envoi d'événements) ou
Prime Video (la supervision vidéo), puis donnez trois recommandations pour un futur projet
UrbanHub.

**Livrable touché :** [`docs/retour-experience.md`](../retour-experience.md), partie 3.

**Source :** le tableau du cours, 5.1 « Deux équipes revenues des microservices » (A. Noonan,
Segment, 10/07/2018 ; R. Gancarz, InfoQ, 03/05/2023).

---

## Ce qui a été fait

| Partie | Contenu |
|---|---|
| § 3.1 | **Le choix de Segment.** Même problème que le mien : des événements envoyés vers des destinations. Prime Video est écarté : ses coûts venaient d'un orchestrateur et d'un volume vidéo que je n'ai pas |
| § 3.2 | **Les 5 lignes du tableau du cours**, en face de ce que mes TP montrent : le système, le découpage, ce qui a coincé, la décision, ce qu'ils ont perdu. Puis 4 enseignements |
| § 3.3 | **Trois recommandations**, chacune avec la raison, le prix et la preuve, au format qu'attend le plan du dossier (question 5) |

| Recommandation | En une ligne | S'appuie sur |
|---|---|---|
| R1 | monolithe hexagonal dans un seul dépôt ; découper sur un signal mesuré | B3, B6, C3, C6, C8, C9 ; la décision de Segment ; TP 3 |
| R2 | un journal, un groupe par lecteur, des lecteurs idempotents, un topic d'erreurs | B7, B8, C5, C7 ; le découpage d'origine de Segment (une file par destination) |
| R3 | un contrat versionné entre contextes, testé des deux côtés | C7 ; les versions divergentes de Segment |

## Ce que la comparaison a fait ressortir

- **Une des difficultés de Segment ne m'a pas touché pour une raison précise.** Les versions de
  bibliothèques ne divergent pas chez moi, parce qu'il y a un seul `package.json` pour tout le
  dépôt. C'est déjà la forme vers laquelle Segment est revenu.
- **Ce que Segment a perdu, le découpage me l'a apporté :** l'isolement des pannes (B7). La
  recommandation R1 a donc un prix honnête. Les Décorateurs autour des ports l'atténuent, sans le
  supprimer.
- **Une contrainte de la partie 2 était mal formulée.** C7 disait que le test de bout en bout
  n'attraperait un changement de format « que si on le lance ». En fait, il tourne dans `npm test`
  (`node --test "test/**/*.test.ts"`). Mais il **importe le code des deux services** : il n'existe
  que parce qu'ils partagent un dépôt, et il ne couvre que HTTP. J'ai vérifié par `grep` qu'aucun
  test n'enchaîne `publicationKafka.ts` et `entreeKafka.ts`. C7 est corrigée en ce sens. C'est ce
  qui fonde R3.

## Vérifications

```
npm test     # tests 127, pass 127, fail 0
```

Tous les liens relatifs du retour d'expérience et de cette fiche pointent vers des fichiers
existants.
