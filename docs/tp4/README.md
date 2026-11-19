# TP 4 : deux microservices hexagonaux qui se parlent

**Trafic** (le service du TP 2) détecte les bouchons. Il envoie ses signalements à **Notifications**,
qui prévient les opérateurs une seule fois par incident. Les deux services sont écrits en hexagone,
chacun a sa base, et ils se parlent en HTTP ou par Kafka.

La synthèse (schéma, livrables, défis et solutions) est dans le
[README du dépôt](../../README.md#trafic-et-notifications-en-microservices-tp-4).

| Étape | Document | Commit |
|---|---|---|
| 1. Le découpage : Trafic microservice, Notifications en hexagone | [`etape1-decoupage.md`](etape1-decoupage.md) | `f278619` |
| 2. Publication HTTP avec délai, et réception | [`etape2-publication-et-reception-http.md`](etape2-publication-et-reception-http.md) | `c35c859` |
| 3. Réessai borné et coupe-circuit | [`etape3-reessai-et-coupe-circuit.md`](etape3-reessai-et-coupe-circuit.md), mesure : [`experience-etape3.ts`](experience-etape3.ts) | `50a58ee` |
| 4. Consommateur idempotent | [`etape4-idempotence.md`](etape4-idempotence.md) | `e04d6e8` |
| 5. Publication Kafka, deux groupes | [`etape5-adaptateur-kafka.md`](etape5-adaptateur-kafka.md) | `646ba3a` |
| 6. `docker compose`, scénario, panne, rejeu | [`etape6-scenario-panne-rejeu.md`](etape6-scenario-panne-rejeu.md), trace : [`trace-etape6.txt`](trace-etape6.txt), script : [`scenario-etape6.sh`](scenario-etape6.sh) | `0996b1a` |
| 7. Le rendu | [`etape7-rendu.md`](etape7-rendu.md) | — |
