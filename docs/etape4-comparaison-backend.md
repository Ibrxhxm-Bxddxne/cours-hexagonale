# TP 1, étape 4 : comparaison avec un service de notre backend

Service comparé : **Alertes** (`urbanhub-alertes/`). Il reçoit les alertes publiées par Qualité de
l'air et prévient les opérateurs.

Il a 3 fichiers :

| Fichier | Rôle | Lignes |
|---|---|---|
| `src/service.ts` | le cas d'utilisation `ReceptionAlertes` et le port `Operateurs` | 23 |
| `src/entreeHttp.ts` | l'entrée HTTP, `POST /alertes` | 14 |
| `src/principal.ts` | la racine de composition | 10 |

Les essais ont été faits sans modifier le code du service : des scripts à part importent ses
fichiers. Node.js 22.20.

---

## 1. Les trois questions du cours (1.4, cas 5)

| Question | Qualité de l'air | Alertes |
|---|---|---|
| Y a-t-il une règle métier ? | Oui : la moyenne du jour au-dessus de 50 µg/m³ | **Oui** : une alerte reçue deux fois ne prévient qu'une fois (idempotence, `service.ts` l. 19) |
| Plusieurs entrées ou sorties ? | Oui : HTTP et CSV en entrée ; la base et Alertes en sortie | **Pas encore** : 1 entrée (HTTP), 1 sortie (le journal). **Demain** : Kafka en entrée (`compose.yaml` l. 35, TP 4), un SMS ou un mail en sortie |
| Une technique qui va changer ? | Oui : SQLite, puis une base partagée | **Oui** : la mémoire des alertes déjà traitées est un `Set`. Le code l'annonce lui-même : « en production : une table » (`service.ts` l. 12) |

Le résultat : **deux « oui » et un « bientôt ».** Alertes n'est pas un simple CRUD comme l'annuaire
des capteurs. Il a une règle à protéger, donc l'hexagone peut se justifier.

---

## 2. Les trois avantages, un par un

### Avantage 1 : la logique métier se teste seule. **Présent.**

`urbanhub-alertes/src/service.ts`, ligne 14 :

```ts
  constructor(operateurs: Operateurs) {
```

Le service reçoit un **port** (`Operateurs`, lignes 5 à 7), pas un envoi de SMS ou de mail en dur.
Le test `test/alertesIdempotent.test.ts` en profite : il passe un faux opérateur qui retient les
alertes, sans réseau ni serveur.

**Essai :** `node --test test/alertesIdempotent.test.ts` réussit en **1,5 à 1,9 ms**, le même ordre
que `surveillance.test.ts`.

**Verdict :** rien ne manque ici.

---

### Avantage 2 : la technique se remplace. **Il manque, pour la mémoire des doublons.**

`urbanhub-alertes/src/service.ts`, ligne 12 :

```ts
  #dejaTraitees = new Set<string>();       // en production : une table
```

C'est une **technique (la mémoire du processus) écrite dans le centre**. Pour Qualité de l'air, le
service reçoit son dépôt par un port (`DepotMesures`). Ici, il fabrique lui-même son stockage, sans
port.

On ne peut donc pas le remplacer par une table sans modifier `service.ts`, et aucun test de contrat
ne vérifie qu'une future table se comporterait comme le `Set`.

**Essai : un redémarrage, ou deux copies du service.** Deux instances de `ReceptionAlertes`
reçoivent la même alerte :

```ts
new ReceptionAlertes(op).recevoir(alerte);   // avant le redémarrage (ou copie 1)
new ReceptionAlertes(op).recevoir(alerte);   // après le redémarrage (ou copie 2)
```

Résultat :

```
prevenus : 2 [ 'capteur-12:PM10:2026-11-17', 'capteur-12:PM10:2026-11-17' ]
```

**Les opérateurs sont prévenus deux fois.** La règle que le service doit protéger, l'idempotence,
ne tient que tant que le processus reste en vie et qu'il est seul.

Or le projet prévoit justement plusieurs copies. Qualité de l'air tourne déjà en 2 copies
(`k8s/qualite-air.yaml`, ligne 5 : `replicas: 2`), et Kafka livre un message « au moins une fois »,
donc parfois deux.

**Le mérite-t-il ?** **Oui, c'est le manque le plus important.** Il touche la seule règle métier du
service.

**Le prix :**

| | Ce qu'il faut faire |
|---|---|
| 1 port | Une interface, par exemple `JournalAlertes { marquerSiNouvelle(identifiant): boolean }`, environ 3 lignes dans `service.ts` |
| 2 adaptateurs | Un en mémoire (le `Set` actuel, déplacé hors du centre) et un en SQLite, environ 15 et 20 lignes |
| 1 test de contrat | Le même test pour les deux adaptateurs, comme `contratDepot.test.ts` |
| 1 ligne | Dans `principal.ts`, pour choisir l'adaptateur |

**Le prix caché :**
- le port doit **vérifier et marquer en une seule opération** (`marquerSiNouvelle`), et non pas avec
  deux appels séparés `dejaVue()` puis `marquer()` ;
- sinon, deux copies du service peuvent toutes les deux répondre « pas encore vue » en même temps ;
- en SQL, cela se fait avec une clé unique et un `INSERT` qui échoue sur un doublon. C'est le genre
  de décision qu'on paie « au départ », en concevant le port.

---

### Avantage 3 : toutes les entrées se valent. **Il manque, mais ça peut attendre.**

`urbanhub-alertes/src/entreeHttp.ts`, lignes 2 et 5 :

```ts
import type { ReceptionAlertes } from "./service.ts";
export function gestionnaire(reception: ReceptionAlertes, journal = console.log) {
```

L'entrée dépend de la **classe** `ReceptionAlertes`, pas d'un port primaire. Qualité de l'air, lui, a
l'interface `EnregistrerMesure`. Et il n'y a qu'une seule entrée.

**Le défaut trouvé au passage**, `entreeHttp.ts`, ligne 9 :

```ts
    const alerte = JSON.parse(corps);
```

Il n'y a aucune validation et aucun `try/catch`. Qualité de l'air, lui, valide dans le domaine
(`mesure()`) et répond 422.

**Essai :** on envoie `POST /alertes` avec le corps `pas du json`. Résultat :

```
SyntaxError: Unexpected token 'p', "pas du json" is not valid JSON
    at Server.<anonymous> (.../urbanhub-alertes/src/entreeHttp.ts:9:25)
code de sortie du processus : 1
```

**Une seule requête mal formée arrête tout le service.** Les alertes suivantes sont alors perdues.

**Le mérite-t-il ?**
- **Le port primaire : pas encore.** Avec une seule entrée, une interface en plus serait un détour
  sans bénéfice. Il deviendra utile au **TP 4**, quand les alertes arriveront aussi par Kafka : le
  consommateur Kafka devra appeler la même réception que HTTP. Le prix est faible, environ 3 lignes.
- **La validation dans le domaine : oui, tout de suite.** Ce n'est pas une question d'hexagone, c'est
  un défaut :
  - une fonction `alerteRecue()` qui vérifie l'identifiant et la moyenne, comme `mesure()` ;
  - un `try/catch` qui répond 422 ;
  - une fois la vérification dans le domaine, l'entrée Kafka la réutilisera gratuitement.

---

## 3. Verdict

| Avantage | Chez Alertes | La ligne qui le montre | Le mérite-t-il ? |
|---|---|---|---|
| Logique testée seule | ✅ présent | `service.ts` l. 14 : le constructeur reçoit le port `Operateurs` | déjà acquis |
| Technique remplaçable | ❌ manque | `service.ts` l. 12 : `new Set<string>()` dans le centre | **oui, en priorité** : la règle d'idempotence casse au redémarrage ou avec 2 copies |
| Entrées équivalentes | ❌ manque | `entreeHttp.ts` l. 2 : dépend de la classe ; l. 9 : `JSON.parse` sans garde | port : **plus tard** (TP 4, Kafka) ; validation : **oui, tout de suite** |

**L'avantage qui lui manque le plus est le deuxième, la technique remplaçable.** Alertes n'a qu'une
règle, mais toute sa valeur est dans cette règle. Or elle repose sur un `Set` en mémoire écrit dans
le centre.

Un port `JournalAlertes` coûterait environ 3 fichiers et 40 lignes. Il permettrait de passer à une
table sans toucher au cas d'utilisation, et de vérifier la table par un test de contrat écrit une
fois.

**Ce qu'on retient pour notre backend :**
- l'hexagone ne se mesure pas au nombre de fichiers, mais à **ce qu'il protège** ;
- un service de 3 fichiers avec une vraie règle mérite ses ports ;
- un CRUD de 20 fichiers sans règle n'en mérite pas.
