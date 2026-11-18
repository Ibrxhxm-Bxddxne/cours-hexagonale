# TP 2, étape 2 : le domaine et les ports du service Trafic

**Consigne :** écrire le domaine (la logique métier, sans import technique) et les ports : un
primaire et au moins deux secondaires.

Nous commençons par le centre de l'hexagone : aucune base, aucun serveur et aucun adaptateur
n'existent encore.

| Fichier | Contenu | Lignes |
|---|---|---|
| `urbanhub-trafic/src/domaine.ts` | le vocabulaire et la règle | 62 |
| `urbanhub-trafic/src/ports.ts` | 1 port primaire et 4 ports secondaires | 35 |
| `tsconfig.json` | `urbanhub-trafic` ajouté à `include`, pour que `npm run types` le vérifie | +1 / −1 |

---

## 1. Le domaine (`domaine.ts`)

Chaque mot de la règle (étape 1) devient un type ou une fonction.

| Mot de la règle | Dans le code | Rôle |
|---|---|---|
| Relevé | `type Releve` et `releve()` | une vitesse mesurée sur un tronçon ; `releve()` refuse un relevé incomplet, une vitesse négative ou un horodatage mal formé (`ReleveInvalide`) |
| Tronçon | `type Troncon` et `troncon()` | une portion de route et sa vitesse limite, qui doit être positive (`TronconInconnu`) |
| Fluide / congestionné | `type EtatTroncon` | `"fluide" \| "congestionne"` |
| Signalement | `type Signalement` et `signalement()` | le message à envoyer ; son `identifiant` (`troncon:debut`) permettra au destinataire d'ignorer un doublon |
| Fenêtre de 15 minutes | `FENETRE_MINUTES` et `debutFenetre()` | `"08:10:00"` donne `"07:55:00"`, borne incluse |
| Vitesse moyenne | `vitesseMoyenne()` | la moyenne des relevés de la fenêtre |
| 40 % de la limite | `PART_DE_LA_LIMITE` et `etatSelon()` | **la règle** : sous 40 % de la limite, le tronçon est congestionné |

### Les choix et leurs raisons

- **Le domaine n'importe rien.** Il n'a aucune ligne `import`. Il n'utilise que ce que JavaScript
  fournit partout (`Date`, `Number`, `Object.freeze`).
- **Les objets sont figés** (`Readonly` et `Object.freeze`), comme `mesure()` dans Qualité de l'air.
  Un relevé validé ne peut plus être modifié par erreur.
- **L'horodatage n'a pas de fuseau**, au format `AAAA-MM-JJTHH:MM:SS`. Le calcul de la fenêtre se
  fait sur l'horloge UTC (`Date.parse(\`${horodatage}Z\`)`), pour ne pas dépendre du fuseau de la
  machine. Grâce à ce format unique, deux horodatages se comparent comme du texte : un dépôt pourra
  écrire `horodatage BETWEEN ? AND ?`.
- **La règle est une simple fonction pour l'instant** (`etatSelon`). Si elle doit changer (un autre
  seuil aux heures de pointe, par exemple), le patron Stratégie de l'étape 5 la rendra remplaçable.

---

## 2. Les ports (`ports.ts`)

| Port | Type | Méthodes | Pourquoi le service en a besoin |
|---|---|---|---|
| `RecevoirReleve` | **primaire** | `executer(releve)` | ce que le service **offre** : un adaptateur d'entrée (HTTP, CSV...) l'appellera |
| `DepotReleves` | secondaire | `enregistrer(releve)`, `entre(troncon, debut, fin)` | ranger les relevés et relire ceux de la fenêtre de 15 minutes |
| `ReferentielTroncons` | secondaire | `trouver(identifiant)` | connaître la vitesse limite du tronçon, qui vient des données de la ville |
| `EtatsTroncons` | secondaire | `etat(troncon)`, `changer(troncon, etat)` | se souvenir qu'un tronçon est déjà signalé : **une seule fois par épisode** |
| `PublicateurSignalements` | secondaire | `publier(signalement)` | prévenir le reste d'UrbanHub (aujourd'hui par HTTP, demain peut-être par Kafka) |

Cela fait 1 port primaire et **4 ports secondaires**, pour un minimum demandé de 2. Chacun
correspond à un besoin de la règle :

| Morceau de la règle | Port |
|---|---|
| « la vitesse moyenne relevée sur les 15 dernières minutes » | `DepotReleves` |
| « 40 % de **sa** vitesse limite » | `ReferentielTroncons` |
| « une seule fois, jusqu'à ce que le tronçon redevienne fluide » | `EtatsTroncons` |
| « UrbanHub signale » | `PublicateurSignalements` |

### Les choix et leurs raisons

- **Les ports parlent le langage du métier** : `entre(troncon, debut, fin)`, pas `query(sql)` ni
  `select()`. C'est l'application qui écrit le contrat, et la technique s'y plie.
- **Le dépôt rend des relevés, pas une moyenne.** C'est la leçon de l'expérience 2 du TP 1 : si le
  port rendait une « moyenne calculée en SQL », chaque nouvel adaptateur devrait refaire le calcul,
  et la règle sortirait du centre.
- **L'état est séparé du référentiel.** La vitesse limite vient de la ville et change rarement. Il
  est en lecture seule. L'état change à chaque épisode de congestion et c'est le service qui l'écrit.
  Ce sont deux techniques possibles : un fichier de la ville d'un côté, une table de l'autre.
- **La leçon du TP 1 (étape 4) appliquée.** Chez Alertes, la mémoire des doublons était un `Set`
  écrit dans le centre : elle se perdait au redémarrage. Ici, elle passe par le port `EtatsTroncons`,
  et on pourra donc la ranger dans une base.
- **Le publicateur est asynchrone** (`Promise`), parce qu'il passera par le réseau. Le dépôt, le
  référentiel et l'état sont synchrones, comme `DepotMesures` avec `node:sqlite`.

---

## 3. Vérification

Les tests du cas d'utilisation viennent à l'étape 3. Pour l'instant, nous avons vérifié le domaine
avec un script à part, sur l'exemple chiffré de l'étape 1 (tronçon limité à 50 km/h, seuil à
20 km/h) :

| Relevé | Début de fenêtre | Moyenne calculée | État | Attendu à l'étape 1 |
|---|---|---|---|---|
| 08:00, 30 km/h | 07:45 | 30,00 | fluide | ✅ |
| 08:05, 15 km/h | 07:50 | 22,50 | fluide | ✅ |
| 08:10, 10 km/h | 07:55 | 18,33 | **congestionné** | ✅ |
| 08:15, 12 km/h | 08:00 | 16,75 | congestionné | ✅ |
| 08:30, 45 km/h | 08:15 | 28,50 | fluide | ✅ |

Autres vérifications :

- **Le passage de minuit** : `debutFenetre("2026-11-18T00:05:00")` donne `"2026-11-17T23:50:00"`.
- **Les relevés invalides sont refusés** avec `ReleveInvalide` : un tronçon vide, une vitesse
  négative (−1), ou un horodatage avec fuseau (`...Z`).
- **Aucun import technique** : la recherche de `from "node:..."`, `from "./adaptateurs/"` et
  `fetch(` dans `urbanhub-trafic/src/` ne trouve rien. L'étape 3 transformera cette vérification en
  test.
- **`npm test`** passe toujours : nous n'avons ajouté aucun test et rien modifié dans les autres
  services.
