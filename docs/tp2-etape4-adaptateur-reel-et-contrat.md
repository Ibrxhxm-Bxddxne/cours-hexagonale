# TP 2, étape 4 : un adaptateur réel et son test de contrat

**Consigne :** écrire un adaptateur réel pour un port secondaire, puis le test de contrat : le même
test passe sur cet adaptateur et sur celui en mémoire.

| Fichier | Contenu | Lignes |
|---|---|---|
| `urbanhub-trafic/src/adaptateurs/depotSqlite.ts` | `DepotRelevesSqlite`, l'adaptateur réel du port `DepotReleves` | 35 |
| `test/contratDepotReleves.test.ts` | le test de contrat : 5 vérifications × 2 adaptateurs, plus 1 test propre à SQLite | 89 |

**Résultat :** `npm test` passe **48 / 48** (37 avant cette étape, plus 11 nouveaux tests). Aucun
fichier existant n'a été modifié.

---

## 1. Le choix : quel port, quelle technique ?

| Port | Adaptateur réel ? | Pourquoi |
|---|---|---|
| **`DepotReleves`** | **oui, SQLite** | c'est la donnée qui grossit : un relevé par capteur toutes les quelques secondes. Si le service redémarre, il ne doit pas oublier les 15 dernières minutes |
| `ReferentielTroncons` | pas maintenant | la liste des tronçons vient de la ville et change rarement ; la mémoire suffit au prototype |
| `EtatsTroncons` | pas maintenant | il méritera aussi une base (c'était le défaut d'Alertes au TP 1) ; l'étape 6 pourra le remplacer |
| `PublicateurSignalements` | pas maintenant | il dépend du service qui recevra les signalements |

**SQLite (`node:sqlite`) :**
- il est intégré à Node.js depuis la version 22.13, donc il n'y a **aucune dépendance à installer** ;
- c'est la technique déjà utilisée par Qualité de l'air ;
- la base est un simple fichier.

---

## 2. L'adaptateur (`depotSqlite.ts`)

```ts
export class DepotRelevesSqlite implements DepotReleves {
  enregistrer(r: Releve) {           // des parametres ?, jamais de concatenation
    this.#base.prepare("INSERT INTO releve (troncon, vitesse, horodatage) VALUES (?, ?, ?)")
      .run(r.troncon, r.vitesse, r.horodatage);
  }
  entre(troncon: string, debut: string, fin: string) {
    return this.#base.prepare("SELECT troncon, vitesse, horodatage FROM releve"
      + " WHERE troncon = ? AND horodatage BETWEEN ? AND ?")
      .all(troncon, debut, fin)
      .map((ligne) => releve(ligne as Releve));   // traduction : ligne -> objet du domaine
  }
```

| Choix | Raison |
|---|---|
| `implements DepotReleves` | il se branche sur le **même port** que l'adaptateur en mémoire ; le service ne voit pas la différence |
| Paramètres `?` | **jamais** de valeur collée dans le SQL : cela protège contre l'injection SQL |
| `BETWEEN ? AND ?` | les deux bornes sont **incluses**, comme le dit le port ; le format unique d'horodatage (étape 2) permet de comparer du texte |
| Index `(troncon, horodatage)` | chaque relevé reçu relit sa fenêtre ; sans index, SQLite relirait **toute** la table à chaque fois, et le service ralentirait à mesure que la table grossit |
| `.map((ligne) => releve(...))` | la **traduction** à la frontière : une ligne SQL devient un `Releve` du domaine, validé et figé |
| `fermer()` | ferme proprement le fichier de la base (sert au test du redémarrage) |

La technique reste **hors du centre**. L'adaptateur est dans `adaptateurs/`, et c'est lui qui importe
`node:sqlite` et le domaine, jamais l'inverse. Le test de la règle de dépendance (étape 3) passe
toujours.

---

## 3. Le test de contrat (`contratDepotReleves.test.ts`)

Le contrat est écrit **une fois**. Une boucle le fait passer sur chaque adaptateur :

```ts
const adaptateurs: Record<string, () => DepotReleves> = {
  memoire: () => new DepotRelevesEnMemoire(),
  sqlite: () => new DepotRelevesSqlite(fichierNeuf()),
};
for (const [nom, creer] of Object.entries(adaptateurs)) { /* les 5 tests */ }
```

| Vérification du contrat | Mémoire | SQLite |
|---|---|---|
| La fenêtre rend les relevés du tronçon entre début et fin, **bornes incluses**. Elle exclut : 1 seconde avant, 1 seconde après, un autre tronçon | ✅ | ✅ |
| Une fenêtre sans relevé, ou un tronçon inconnu, rend une liste vide | ✅ | ✅ |
| Une fenêtre qui passe minuit garde la veille et le jour | ✅ | ✅ |
| Deux relevés à la même seconde (deux capteurs) sont gardés tous les deux | ✅ | ✅ |
| Les relevés rendus sont des objets du domaine (vitesse en nombre, figés) | ✅ | ✅ |
| **SQLite seulement** : les relevés survivent à un redémarrage (on ferme la base, puis on la rouvre) | — | ✅ |

Quelques précisions :
- **Les relevés sont enregistrés dans le désordre**, exprès. Le contrat ne promet pas d'ordre, car le
  service ne calcule qu'une moyenne. Le test trie donc avant de comparer.
- **Chaque test SQLite a son propre fichier**, dans un dossier temporaire. Les tests ne se gênent
  pas entre eux, et aucun fichier n'est créé dans le projet.
- **Le dernier test n'est pas dans le contrat.** Il montre ce que seul l'adaptateur réel apporte, et
  donc la raison de l'écrire.

### Durées mesurées (2 lancements)

| Adaptateur | Par test |
|---|---|
| Mémoire | 0,2 à 1,4 ms (le premier test : 23 à 30 ms, le temps de chargement) |
| SQLite | 30 à 100 ms (création du fichier et de la table) |

---

## 4. L'essai : le contrat attrape-t-il une vraie erreur ?

Nous avons modifié l'adaptateur SQLite le temps d'un essai, pour qu'il **exclue** les bornes. C'est
une erreur classique :

```sql
WHERE troncon = ? AND horodatage > ? AND horodatage < ?     -- au lieu de BETWEEN ? AND ?
```

Résultat :

```
ok 1 - memoire : la fenetre rend les releves du troncon entre debut et fin, bornes incluses
...
not ok 6 - sqlite : la fenetre rend les releves du troncon entre debut et fin, bornes incluses
ok 7 - sqlite : une fenetre sans releve rend une liste vide
not ok 8 - sqlite : une fenetre qui passe minuit garde la veille et le jour
not ok 9 - sqlite : deux releves a la meme seconde (deux capteurs) sont gardes tous les deux
not ok 10 - sqlite : les releves rendus sont des objets du domaine (vitesse en nombre, figes)
not ok 11 - sqlite seulement : les releves survivent a un redemarrage du service
# pass 6
# fail 5
```

**5 tests SQLite échouent, et l'adaptateur en mémoire passe toujours.** Le contrat montre exactement
quel adaptateur ne respecte pas le port.

Sans ce test, l'erreur se serait vue en production : un relevé fait pile 15 minutes avant aurait été
oublié, et la moyenne aurait été fausse. Le test du cas d'utilisation, lui, n'aurait rien vu, car il
tourne sur la mémoire. L'adaptateur a ensuite été remis dans son état d'origine : 11 / 11.

---

## Ce que cette étape prouve

- **La technique se branche sans toucher au centre.** Il y a 1 fichier créé, et `domaine.ts`,
  `ports.ts` et `service.ts` n'ont pas bougé.
- **Le contrat rend l'adaptateur en mémoire digne de confiance.** Puisque les deux adaptateurs
  passent le même test, les 7 tests rapides du cas d'utilisation (étape 3) disent vrai aussi pour
  SQLite.
- **Le prix :**
  - 1 adaptateur de 35 lignes et un contrat de 89 lignes ;
  - une traduction ligne ↔ objet à la frontière ;
  - des tests SQLite environ 50 fois plus lents que ceux en mémoire. C'est pour cela que le cas
    d'utilisation, lui, se teste en mémoire.
