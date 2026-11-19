// TP4, etape 1 : le cas d'utilisation ReceptionIncidents, teste avec des adaptateurs en memoire.
// Ni base, ni reseau : le test assemble lui-meme ses adaptateurs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HistoriqueEnMemoire } from "../urbanhub-notifications/src/adaptateurs/historiqueMemoire.ts";
import { OperateursParJournal } from "../urbanhub-notifications/src/adaptateurs/operateursJournal.ts";
import { IncidentInvalide, incident, notification } from "../urbanhub-notifications/src/domaine.ts";
import type { Notification, Operateurs } from "../urbanhub-notifications/src/ports.ts";
import { ReceptionIncidents } from "../urbanhub-notifications/src/service.ts";

const bouchon = incident({ identifiant: "rue-de-rivoli-1:2026-11-19T08:10:00", source: "trafic",
  lieu: "rue-de-rivoli-1", resume: "circulation a 9 km/h pour 30 km/h autorises",
  survenu: "2026-11-19T08:10:00" });

function assembler(operateurs?: Operateurs) {
  const prevenus: Notification[] = [];      // adaptateur de test : il retient
  const historique = new HistoriqueEnMemoire();
  const service = new ReceptionIncidents(
    operateurs ?? { prevenir: async (n) => { prevenus.push(n); } }, historique);
  return { service, prevenus, historique };
}

test("un incident recu previent les operateurs, puis entre dans l'historique", async () => {
  const { service, prevenus, historique } = assembler();
  await service.executer(bouchon);
  assert.deepEqual(prevenus, [{ incident: bouchon.identifiant,
    texte: "[trafic] rue-de-rivoli-1 : circulation a 9 km/h pour 30 km/h autorises (depuis 08:10)" }]);
  assert.deepEqual(historique.tous(), [bouchon]);
});

test("operateurs injoignables : l'incident n'est PAS historise, un nouvel envoi le retentera", async () => {
  const { service, historique } = assembler({ prevenir: async () => { throw new Error("SMS en panne"); } });
  await assert.rejects(service.executer(bouchon), /SMS en panne/);
  assert.deepEqual(historique.tous(), []);
});

test("le domaine refuse un incident incomplet ou mal date", () => {
  assert.throws(() => incident({ ...bouchon, lieu: " " }), IncidentInvalide);
  assert.throws(() => incident({ ...bouchon, survenu: "hier" }), IncidentInvalide);
  assert.throws(() => incident({ ...bouchon, resume: undefined as never }), IncidentInvalide);
});

test("la notification ne parle que le vocabulaire du contexte : source, lieu, resume, heure", () => {
  assert.deepEqual(Object.keys(notification(bouchon)).sort(), ["incident", "texte"]);
});

test("l'adaptateur journal ecrit une ligne par notification", async () => {
  const lignes: string[] = [];
  await new OperateursParJournal((l) => lignes.push(l)).prevenir(notification(bouchon));
  assert.equal(lignes.length, 1);
  assert.match(lignes[0], /^NOTIFICATION rue-de-rivoli-1:2026-11-19T08:10:00 \[trafic\]/);
});
