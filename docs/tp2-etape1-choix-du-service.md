# TP 2, étape 1 : le service choisi et sa règle métier

## Le service : Trafic

UrbanHub reçoit un nouveau service. Le TP propose quatre sujets : trafic, bruit, incidents ou
énergie. Nous avons choisi **Trafic** :

- des capteurs posés sur les routes relèvent la vitesse des véhicules, tronçon par tronçon ;
- le service décide si un tronçon est **congestionné** et le signale, par exemple au service
  d'information des voyageurs.

**Langage :** TypeScript, exécuté par Node.js 22.18 ou plus, comme Qualité de l'air et Alertes. Le
code ira dans `urbanhub-trafic/`, à côté des deux autres services, et ses tests dans `test/`.

## La règle métier, en une phrase

> Un tronçon de route est déclaré **congestionné** quand la vitesse moyenne relevée par ses capteurs
> sur les 15 dernières minutes tombe sous 40 % de sa vitesse limite ; UrbanHub signale alors la
> congestion une seule fois, jusqu'à ce que le tronçon redevienne fluide.

### Les mots de la règle

Ces mots deviendront le vocabulaire du domaine, à l'étape 2 :

| Mot | Sens |
|---|---|
| **Tronçon** | une portion de route, avec un identifiant et une vitesse limite (par exemple `boulevard-voltaire-3`, 50 km/h) |
| **Relevé** | une mesure d'un capteur : tronçon, vitesse en km/h, horodatage |
| **Fenêtre** | les 15 dernières minutes avant le relevé reçu |
| **Seuil** | 40 % de la vitesse limite du tronçon (20 km/h pour un tronçon limité à 50) |
| **Congestionné / fluide** | l'état du tronçon : congestionné sous le seuil, fluide sinon |
| **Signalement** | le message envoyé quand un tronçon passe de fluide à congestionné |

### Un exemple chiffré

Prenons le tronçon `boulevard-voltaire-3`, limité à 50 km/h. Le seuil est donc de 20 km/h.

| Heure | Vitesse relevée | Moyenne sur 15 min | État | Signalement ? |
|---|---|---|---|---|
| 08:00 | 30 km/h | 30 | fluide | non |
| 08:05 | 15 km/h | 22,5 | fluide | non |
| 08:10 | 10 km/h | **18,3** | **congestionné** | **oui, une fois** |
| 08:15 | 12 km/h | 16,75 | congestionné | non, déjà signalé |
| 08:30 | 45 km/h | 28,5 | fluide | non (l'épisode est fini) |

La fenêtre inclut sa borne : un relevé fait exactement 15 minutes avant compte encore.

- À 08:15, la fenêtre va de 08:00 à 08:15 : (30 + 15 + 10 + 12) / 4 = 16,75.
- À 08:30, elle ne contient plus que les relevés de 08:15 et 08:30 : (12 + 45) / 2 = 28,5. Le tronçon
  redevient fluide, et un prochain bouchon pourra de nouveau être signalé.

## Pourquoi ce service mérite un hexagone

Nous reprenons les trois questions du cours (1.4) :

| Question | Réponse pour Trafic |
|---|---|
| Y a-t-il une règle métier ? | **Oui** : un seuil relatif à chaque tronçon, une fenêtre de 15 minutes et un seul signalement par épisode |
| Plusieurs entrées ou sorties ? | **Oui** : en entrée, les relevés des capteurs (HTTP) ; en sortie, les relevés stockés, l'état des tronçons et les signalements |
| Une technique qui va changer ? | **Oui** : le stockage (mémoire, puis base) et le canal de signalement (HTTP, puis Kafka) |

Trois « oui » : contrairement à un annuaire de capteurs sans règle, ce service a quelque chose à
protéger.

## Ce que la règle annonce pour la suite du TP

- **Étape 2, les ports** :
  - un port primaire pour recevoir un relevé ;
  - des ports secondaires pour trois besoins : stocker et relire les relevés de la fenêtre,
    connaître la vitesse limite d'un tronçon et son état (fluide ou déjà signalé), et envoyer le
    signalement.
- **Étape 5, les patrons** :
  - **Stratégie** : la façon de décider « congestionné » pourra changer (un seuil relatif de 40 %,
    un seuil plus strict aux heures de pointe, ou autre chose) sans toucher au cas d'utilisation ;
  - **Décorateur** : le signalement passe par le réseau, on pourra lui ajouter un réessai sans
    modifier l'adaptateur ;
  - **Dépôt** : les relevés seront rangés et relus comme une collection, quelle que soit la base.

  Le choix final des deux patrons se fera à l'étape 5.
