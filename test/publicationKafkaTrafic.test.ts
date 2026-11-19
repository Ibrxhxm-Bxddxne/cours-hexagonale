// TP4, etape 5 : l'adaptateur de publication KAFKA du service Trafic, sans broker.
// Un faux producteur retient ses envois ; le vrai partitionneur de kafkajs dit ou ils iraient.
import { test } from "node:test";
import assert from "node:assert/strict";
import kafkajs from "kafkajs";
import { PublicateurAvecCoupeCircuit } from "../urbanhub-trafic/src/adaptateurs/coupeCircuit.ts";
import { PARTITIONS, TOPIC_SIGNALEMENTS, creerTopic } from "../urbanhub-trafic/src/adaptateurs/kafkaTopic.ts";
import { PublicateurSignalementsKafka } from "../urbanhub-trafic/src/adaptateurs/publicationKafka.ts";
import { PublicateurAvecReessai } from "../urbanhub-trafic/src/adaptateurs/reessai.ts";
import { DepotRelevesEnMemoire } from "../urbanhub-trafic/src/adaptateurs/depotMemoire.ts";
import { EtatsTronconsEnMemoire } from "../urbanhub-trafic/src/adaptateurs/etatsMemoire.ts";
import { ReferentielTronconsEnMemoire } from "../urbanhub-trafic/src/adaptateurs/referentielMemoire.ts";
import { releve, signalement } from "../urbanhub-trafic/src/domaine.ts";
import type { Signalement } from "../urbanhub-trafic/src/ports.ts";
import { SeuilRelatif } from "../urbanhub-trafic/src/regles.ts";
import { SurveillanceTrafic } from "../urbanhub-trafic/src/service.ts";

type Envoi = { topic: string; messages: { key: string; value: string }[] };
function fauxProducteur() {
  const envois: Envoi[] = [];
  return { envois, async send(envoi: Envoi) { envois.push(envoi); } };
}
const bouchon = signalement({ troncon: "rue-de-rivoli-1", vitesseMoyenne: 9,
  vitesseLimite: 30, debut: "2026-11-19T08:10:00" });

test("le signalement part dans le topic signalements, cle = le troncon, valeur = le JSON avec l'identifiant", async () => {
  const producteur = fauxProducteur();
  await new PublicateurSignalementsKafka(producteur).publier(bouchon);
  assert.deepEqual(producteur.envois, [{ topic: "signalements",
    messages: [{ key: "rue-de-rivoli-1", value: JSON.stringify(bouchon) }] }]);
  assert.equal(JSON.parse(producteur.envois[0].messages[0].value).identifiant,
    "rue-de-rivoli-1:2026-11-19T08:10:00");
});

test("LA CLE, avec le vrai partitionneur de kafkajs : un troncon va toujours dans la MEME partition (sur 3)", () => {
  const partitionner = kafkajs.Partitioners.DefaultPartitioner();
  const partitionMetadata = [0, 1, 2].map((partitionId) => ({ partitionId, leader: 1 }));
  const ou = (cle: string) => partitionner({ topic: "signalements", partitionMetadata,
    message: { key: cle, value: "" } });
  const troncons = ["boulevard-voltaire-3", "rue-de-rivoli-1", "peripherique-porte-maillot"];
  for (const t of troncons) {
    const partition = ou(t);
    assert.ok(partition >= 0 && partition < PARTITIONS);
    for (let i = 0; i < 20; i++) assert.equal(ou(t), partition, `${t} a change de partition`);
  }
  // ce qui en decoule : les signalements d'un troncon restent dans l'ordre (cours, slide 93)
  assert.deepEqual(troncons.map(ou), [1, 0, 0]);
});

test("le topic : 3 partitions, cree une fois", async () => {
  const demandes: unknown[] = [];
  const admin = { createTopics: async (o: unknown) => { demandes.push(o); return true; } };
  await creerTopic(admin);
  assert.deepEqual(demandes, [{ waitForLeaders: true, topics: [{ topic: TOPIC_SIGNALEMENTS,
    numPartitions: 3, replicationFactor: 1 }] }]);
});

test("un broker injoignable : l'erreur remonte, donc le reessai et le coupe-circuit s'appliquent", async () => {
  let appels = 0;
  const enPanne = { send: async () => { appels += 1; throw new Error("broker injoignable"); } };
  const publicateur = new PublicateurAvecReessai(
    new PublicateurAvecCoupeCircuit(new PublicateurSignalementsKafka(enPanne), 5, 30_000),
    3, 500, async () => {});
  await assert.rejects(publicateur.publier(bouchon), /broker injoignable/);
  assert.equal(appels, 3);
});

test("SANS toucher au cas d'utilisation : le meme SurveillanceTrafic publie dans Kafka", async () => {
  const producteur = fauxProducteur();
  const trafic = new SurveillanceTrafic(new DepotRelevesEnMemoire(),
    new ReferentielTronconsEnMemoire([{ identifiant: "rue-de-rivoli-1", vitesseLimite: 30 }]),
    new EtatsTronconsEnMemoire(), new PublicateurSignalementsKafka(producteur), new SeuilRelatif(0.4));
  for (const [v, h] of [[10, "08:00"], [8, "08:05"]] as const) {
    await trafic.executer(releve({ troncon: "rue-de-rivoli-1", vitesse: v, horodatage: `2026-11-19T${h}:00` }));
  }
  assert.equal(producteur.envois.length, 1);   // une fois par episode, comme en HTTP
  const s = JSON.parse(producteur.envois[0].messages[0].value) as Signalement;
  assert.equal(s.identifiant, "rue-de-rivoli-1:2026-11-19T08:00:00");
});
