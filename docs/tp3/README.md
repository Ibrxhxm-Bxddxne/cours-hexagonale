# TP 3 : monolithe ou microservices, pour UrbanHub

**La question du TP :** la ville ajoute des capteurs et des services. UrbanHub reste-t-il un seul
bloc (un monolithe), ou se découpe-t-il en services ? Nous comparons les deux formes sur notre
backend, puis nous proposons, pour chacune, son déploiement et sa gestion.

**Notre réponse :** aujourd'hui, **un monolithe hexagonal**, plus le service Capteurs en Python. Nous
sortirons Alertes au premier signal, puis Trafic, et nous passerons à PostgreSQL avant de dupliquer
quoi que ce soit. Le raisonnement est dans l'[étape 6](etape6-conclusion.md).

Le code étudié est celui de ce dépôt : `urbanhub-air/`, `urbanhub-alertes/`, `urbanhub-trafic/`
(`npm test` : 67 / 67).

## Les livrables

| Livrable demandé | Où le trouver |
|---|---|
| **Les deux schémas** (monolithe hexagonal, microservices) | [`etape2-deux-dessins.md`](etape2-deux-dessins.md) |
| **La vue d'ensemble** (passerelle, backend principal, services, bases ; qui appelle qui et pourquoi) | [`etape4-vue-ensemble.md`](etape4-vue-ensemble.md), § 1 et 2 |
| **La gestion de chaque service** (configuration par environnement, supervision, livraison) | [`etape4-vue-ensemble.md`](etape4-vue-ensemble.md), § 3 |
| **Le comparatif** (tableau du 3.2, avec des mesures sur notre code) | [`etape3-tableau-comparatif.md`](etape3-tableau-comparatif.md), mesuré par [`experience-etape3.ts`](experience-etape3.ts) |
| **Le manifeste Kubernetes** (service Trafic) | [`k8s/trafic.yaml`](../../k8s/trafic.yaml), avec son image [`Dockerfile.trafic`](../../Dockerfile.trafic) ; la stratégie est dans [`etape5-deploiement-et-manifeste.md`](etape5-deploiement-et-manifeste.md) |

## Les étapes

| Étape | Document | Commit |
|---|---|---|
| 1. Les contextes délimités et leurs données | [`etape1-contextes-delimites.md`](etape1-contextes-delimites.md) | `35413cd` |
| 2. UrbanHub en monolithe hexagonal, puis en microservices | [`etape2-deux-dessins.md`](etape2-deux-dessins.md) | `21671d5` |
| 3. Le tableau du 3.2, rempli avec des mesures | [`etape3-tableau-comparatif.md`](etape3-tableau-comparatif.md) | `129ed24` |
| 4. La vue d'ensemble et la gestion de chaque service | [`etape4-vue-ensemble.md`](etape4-vue-ensemble.md) | `2953a5d` |
| 5. La stratégie de déploiement et le manifeste | [`etape5-deploiement-et-manifeste.md`](etape5-deploiement-et-manifeste.md) | `a8bbee7` |
| 6. La conclusion | [`etape6-conclusion.md`](etape6-conclusion.md) | `079855e` |
| 7. Le rendu | [`etape7-rendu.md`](etape7-rendu.md) | — |

## Les chiffres qui portent la conclusion (étape 3)

| Mesure sur notre code | Résultat |
|---|---|
| Appel de fonction, puis appel HTTP local | environ 1 µs, puis environ 1 ms (plus de 1 000 fois plus lent) |
| Alertes arrêté | la requête du capteur dure 1,5 s, puis reçoit 500 ; la mesure est quand même gardée |
| Alertes figé | la requête du capteur attend 7,5 s |
| Alertes revenu | l'alerte repart, et les opérateurs ne sont prévenus qu'une fois |
