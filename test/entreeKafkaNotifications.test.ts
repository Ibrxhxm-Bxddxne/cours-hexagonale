// TP4, etape 5 : l'adaptateur PRIMAIRE Kafka du service Notifications, sans broker.
// Un faux consommateur rejoue ce que kafkajs donnerait a eachMessage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HistoriqueEnMemoire } from "../urbanhub-notifications/src/adaptateurs/historiqueMemoire.ts";
import { type MessageLu, consommer, traiterMessage } from "../urbanhub-notifications/src/adaptateurs/entreeKafka.ts";
import type { Notification } from "../urbanhub-notifications/src/ports.ts";
import { ReceptionIncidents } from "../urbanhub-notifications/src/service.ts";

const signalement = { troncon: "rue-de-rivoli-1", vitesseMoyenne: 9, vitesseLimite: 30,
  debut: "2026-11-19T08:10:00", identifiant: "rue-de-rivoli-1:2026-11-19T08:10:00" };
const lu = (valeur: string, offset = "0", partition = 0): MessageLu =>
  ({ partition, message: { key: Buffer.from("rue-de-rivoli-1"), value: Buffer.from(valeur), offset } });

function assembler(prevenir?: (n: Notification) => Promise<void>) {
  const prevenus: Notification[] = [];
  const service = new ReceptionIncidents(
    { prevenir: prevenir ?? (async (n) => { prevenus.push(n); }) }, new HistoriqueEnMemoire());
  const journal: string[] = [];
  return { service, prevenus, journal, ecrire: (l: string) => journal.push(l) };
}

test("un message du topic previent les operateurs, avec la MEME traduction que l'entree HTTP", async () => {
  const a = assembler();
  assert.equal(await traiterMessage(a.service, lu(JSON.stringify(signalement)), a.ecrire), "notifie");
  assert.deepEqual(a.prevenus.map((n) => n.texte),
    ["[trafic] rue-de-rivoli-1 : circulation a 9 km/h pour 30 km/h autorises (depuis 08:10)"]);
  assert.deepEqual(a.journal, ["recu rue-de-rivoli-1:2026-11-19T08:10:00 (partition 0 offset 0)"]);
});

test("le meme message relu (offset 0 puis 0 : un rejeu) : doublon, pas de seconde notification", async () => {
  const a = assembler();
  await traiterMessage(a.service, lu(JSON.stringify(signalement), "0"), a.ecrire);
  assert.equal(await traiterMessage(a.service, lu(JSON.stringify(signalement), "0"), a.ecrire), "doublon");
  assert.equal(a.prevenus.length, 1);
  assert.match(a.journal.at(-1)!, /^doublon ignore .* \(partition 0 offset 0\)$/);
});

test("un message illisible est journalise et IGNORE : il ne bloque pas la partition", async () => {
  const a = assembler();
  assert.equal(await traiterMessage(a.service, lu("{pas du json", "7"), a.ecrire), "ignore");
  assert.equal(await traiterMessage(a.service, lu(JSON.stringify({ troncon: "x" }), "8"), a.ecrire), "ignore");
  assert.equal(a.prevenus.length, 0);
  assert.match(a.journal[0], /^message ignore \(partition 0 offset 7\)/);
});

test("operateurs injoignables : l'erreur REMONTE, donc kafkajs ne valide pas l'offset et relira", async () => {
  const a = assembler(async () => { throw new Error("SMS en panne"); });
  await assert.rejects(traiterMessage(a.service, lu(JSON.stringify(signalement)), a.ecrire), /SMS en panne/);
});

test("consommer : abonne au topic signalements depuis le debut, et branche chaque message", async () => {
  const a = assembler();
  const abonnements: unknown[] = [];
  const faux = {
    subscribe: async (o: unknown) => { abonnements.push(o); },
    run: async ({ eachMessage }: { eachMessage: (m: MessageLu) => Promise<void> }) => {
      await eachMessage(lu(JSON.stringify(signalement), "0", 2));
      await eachMessage(lu(JSON.stringify({ ...signalement, identifiant: "rue-de-rivoli-1:2026-11-19T17:40:00",
        debut: "2026-11-19T17:40:00" }), "1", 2));
    },
  };
  await consommer(faux, a.service, "signalements", a.ecrire);
  assert.deepEqual(abonnements, [{ topic: "signalements", fromBeginning: true }]);
  assert.equal(a.prevenus.length, 2);
});
