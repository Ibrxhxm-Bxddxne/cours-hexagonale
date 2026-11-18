# UrbanHub : cours d'architecture hexagonale

Services **Qualité de l'air** (`urbanhub-air/`) et **Alertes** (`urbanhub-alertes/`), en TypeScript,
exécutés par Node.js (version 22.18 ou plus).

```bash
npm test          # toute la suite de tests
npm run air       # service Qualité de l'air, port 8001
npm run alertes   # service Alertes, port 8002
npm run trafic    # service Trafic, port 8003
```

## Service Trafic (TP 2)

Dossier : `urbanhub-trafic/`, en TypeScript, comme les deux autres services.

**Règle de gestion :** un tronçon de route est déclaré **congestionné** quand la vitesse moyenne
relevée par ses capteurs sur les 15 dernières minutes tombe sous 40 % de sa vitesse limite ;
UrbanHub signale alors la congestion une seule fois, jusqu'à ce que le tronçon redevienne fluide.

Le détail du choix est dans [`docs/tp2-etape1-choix-du-service.md`](docs/tp2-etape1-choix-du-service.md).

### Schéma

```mermaid
flowchart LR
  capteurs([Capteurs]) -- "POST /releves" --> entree

  subgraph adaptateurs_primaires [Adaptateur primaire]
    entree["entreeHttp.ts"]
  end

  subgraph centre [Centre : aucun import technique]
    port_p{{"RecevoirReleve<br/>(port primaire)"}}
    service["SurveillanceTrafic<br/>(cas d'utilisation)"]
    regle{{"RegleCongestion<br/>(Stratégie)"}}
    domaine["domaine.ts<br/>Releve, Troncon, Signalement"]
    ports_s{{"DepotReleves · ReferentielTroncons<br/>EtatsTroncons · PublicateurSignalements<br/>(ports secondaires)"}}
  end

  subgraph adaptateurs_secondaires [Adaptateurs secondaires]
    depot["DepotRelevesSqlite"]
    ref["ReferentielTronconsEnMemoire<br/>(troncons.json)"]
    etats["EtatsTronconsSqlite"]
    reessai["PublicateurAvecReessai<br/>(Décorateur)"]
    http["PublicateurSignalementsHttp"]
  end

  entree --> port_p --> service
  service --> regle
  service --> domaine
  service --> ports_s
  depot -. implémente .-> ports_s
  ref -. implémente .-> ports_s
  etats -. implémente .-> ports_s
  reessai -. implémente .-> ports_s
  reessai --> http -- "POST /signalements" --> dest([Service destinataire])
  depot --- db[("releves.db")]
  etats --- db
```

- **Les flèches pleines vont vers le centre :** l'entrée appelle le port primaire, et le service ne
  connaît que des ports.
- **Les flèches pointillées** sont les adaptateurs qui implémentent ces ports. Ils dépendent du
  centre, jamais l'inverse.
- **La racine de composition** [`principal.ts`](urbanhub-trafic/src/principal.ts) est le seul
  fichier qui crée et branche ces objets.
- **La règle de dépendance** est vérifiée par
  [`test/regleDependanceTrafic.test.ts`](test/regleDependanceTrafic.test.ts).

### Les deux patrons

#### Stratégie : la règle de congestion ([`regles.ts`](urbanhub-trafic/src/regles.ts))

| | |
|---|---|
| **Le problème** | La règle « moyenne sous 40 % de la limite » se trompe **la nuit**. Un seul bus à l'arrêt (5 km/h à 03:00) déclenche un faux bouchon. Et pendant un bouchon, un véhicule rapide isolé fait croire le tronçon fluide, puis le **même** bouchon est signalé une 2e fois (mesuré : 08:00 et 08:32). Le choix de la règle est une décision métier qui changera : par ville, par tronçon, selon l'heure. |
| **La solution** | Une interface `RegleCongestion` et deux règles interchangeables : `SeuilRelatif` (la règle ci-dessus) et `SeuilRelatifAvecMinimum` (pas de conclusion avec moins de 3 relevés). Le cas d'utilisation reçoit l'une ou l'autre sans savoir laquelle ; on choisit dans `principal.ts` (`REGLE=avec-minimum`). |
| **Maintenabilité (modifier)** | ✅ **Forte.** Une nouvelle règle (heures de pointe, voies rapides) est une **nouvelle classe** ; `service.ts` ne change pas. Chaque règle se teste seule. Le domaine ne garde que le vocabulaire. |
| **Scalabilité (tenir la charge)** | ➖ **Faible, mais réelle.** Le calcul est le même. La règle avec minimum évite les faux signalements, donc du travail inutile chez le destinataire et chez les opérateurs. |
| **Ce qu'il coûte** | Un fichier et une interface de plus (35 lignes) ; un 5e paramètre au constructeur du service ; un cas « pas de conclusion » (`undefined`) que le service doit comprendre ; un réglage (`REGLE`) à documenter, sans quoi personne ne sait quelle règle tourne en production. |
| **Preuve** | [`test/patronsTrafic.test.ts`](test/patronsTrafic.test.ts) : le faux bouchon avec la règle simple, puis 0 faux bouchon et 1 seul signalement avec le minimum. |

#### Décorateur : le réessai autour du publicateur ([`reessai.ts`](urbanhub-trafic/src/adaptateurs/reessai.ts))

| | |
|---|---|
| **Le problème** | Le signalement part par le réseau. Sans réessai, une panne passagère n'est rattrapée qu'**au relevé suivant**, qui peut arriver des minutes plus tard, ou jamais la nuit, si plus aucun véhicule ne passe. Écrire le réessai **dans** le publicateur HTTP l'aurait lié à HTTP (à refaire pour Kafka) ; l'écrire **dans** le service aurait mêlé une technique à la règle métier. |
| **La solution** | `PublicateurAvecReessai` implémente le **même port** `PublicateurSignalements` et enveloppe le publicateur réel : 3 essais, des pauses grandissantes (500 ms puis 1000 ms), et une panne durable **remonte** au lieu d'être avalée. Il s'assemble dans `principal.ts` : `new PublicateurAvecReessai(new PublicateurSignalementsHttp(url))`. |
| **Maintenabilité (modifier)** | ✅ **Forte.** Écrit une fois, il s'applique à tout publicateur (HTTP aujourd'hui, Kafka demain). Ni `service.ts` ni `publicationHttp.ts` n'ont changé pour l'ajouter. On l'enlève, ou on règle le nombre d'essais, en une ligne. Les pauses sont injectées, donc les tests ne dorment pas. |
| **Scalabilité (tenir la charge)** | ✅ **Positive, avec une limite.** Sous charge, le destinataire a des ratés courts : ils sont absorbés au lieu de faire échouer la requête du capteur. Les pauses **grandissantes** laissent le destinataire respirer au lieu de l'assommer. ⚠️ Mais pendant les essais, la requête du capteur reste ouverte : jusqu'à environ 7,5 s (1,5 s de pauses et 3 délais de 2 s). Si le destinataire tombe pour de bon, les connexions s'accumulent. |
| **Ce qu'il coûte** | Du temps de réponse en cas de panne (jusqu'à environ 7,5 s) ; des **doublons possibles** (message reçu mais réponse perdue, puis renvoyé), d'où l'`identifiant` du signalement, qui permet au destinataire de les ignorer ; une couche de plus à suivre en lisant le code. Contre une panne longue, il faudra un coupe-circuit ou une boîte d'envoi (TP 4). |
| **Preuve** | [`test/patronsTrafic.test.ts`](test/patronsTrafic.test.ts) : sans réessai, personne n'est prévenu à 08:00 ; avec, le signalement part à 08:00 après 2 pannes ; une panne durable remonte après 3 essais ; les pauses valent `[500, 1000]`. |

#### Et le patron Dépôt ?

`DepotReleves` est un **Dépôt** depuis l'étape 2 : les relevés se rangent et se relisent comme une
collection (`enregistrer`, `entre`), en mémoire ou dans SQLite, sans que le service connaisse le SQL.
Nous ne le comptons pas parmi les deux patrons de l'étape 5, parce qu'il était déjà là avant elle.
Il a pourtant rendu possibles les étapes 4 et 6.

Le détail des étapes est dans le dossier `docs/` :

| Étape | Document |
|---|---|
| 1. Le service et sa règle | [`docs/tp2-etape1-choix-du-service.md`](docs/tp2-etape1-choix-du-service.md) |
| 2. Le domaine et les ports | [`docs/tp2-etape2-domaine-et-ports.md`](docs/tp2-etape2-domaine-et-ports.md) |
| 3. Le cas d'utilisation et ses tests | [`docs/tp2-etape3-cas-utilisation-et-tests.md`](docs/tp2-etape3-cas-utilisation-et-tests.md) |
| 4. L'adaptateur réel et son contrat | [`docs/tp2-etape4-adaptateur-reel-et-contrat.md`](docs/tp2-etape4-adaptateur-reel-et-contrat.md) |
| 5. Les patrons et la racine de composition | [`docs/tp2-etape5-patrons-et-composition.md`](docs/tp2-etape5-patrons-et-composition.md) |
| 6. Le remplacement d'un adaptateur | [`docs/tp2-etape6-remplacement-adaptateur.md`](docs/tp2-etape6-remplacement-adaptateur.md) |
| 7. Les patrons justifiés | [`docs/tp2-etape7-patrons-justifies.md`](docs/tp2-etape7-patrons-justifies.md) |

### Remplacement d'un adaptateur (étape 6)

| | |
|---|---|
| **Commit** | `197c622`, « TP2 etape 6 : etats des troncons en SQLite » |
| **Port** | `EtatsTroncons` (inchangé) |
| **Remplacé** | `EtatsTronconsEnMemoire` → `EtatsTronconsSqlite` |
| **Fichiers du commit** | `urbanhub-trafic/src/adaptateurs/etatsSqlite.ts` (créé) et `urbanhub-trafic/src/principal.ts` (la racine de composition) : **rien d'autre** |
| **Pourquoi** | avec la mémoire, un redémarrage du service faisait signaler **deux fois** le même bouchon ; avec SQLite, une seule fois |

Le détail : [`docs/tp2-etape6-remplacement-adaptateur.md`](docs/tp2-etape6-remplacement-adaptateur.md).

## Rendus

### TP 1 : trois avantages de l'hexagone, prouvés

| | |
|---|---|
| **Lien du dépôt** | https://github.com/Ibrxhxm-Bxddxne/cours-hexagonale |
| **Empreinte du commit** | `3f34f32` (TP1 étape 5 : rapport) |
| **Chemin du rapport** | [`docs/rapport-tp1.md`](docs/rapport-tp1.md) |

Les expériences sont dans des commits séparés :

| Expérience | Commit |
|---|---|
| Expérience 1 : un test qui tourne sans base | `a3680f4` |
| Expérience 2 : un adaptateur remplacé | `5f1822b` |
| Expérience 3 : une entrée de plus | `a80b807` |

Les documents des étapes sont dans le dossier `docs/` :

- [étape 2 : les trois avantages et leurs preuves](docs/etape2-trois-avantages.md)
- [étape 3 : les résultats des expériences](docs/etape3-resultats-experiences.md)
- [étape 4 : la comparaison avec le service Alertes](docs/etape4-comparaison-backend.md)
