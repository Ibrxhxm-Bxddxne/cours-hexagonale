// TP4, etape 2 : l'adaptateur PRIMAIRE qui recoit (service Notifications), POST /signalements.
// Un vrai serveur HTTP, des adaptateurs secondaires en memoire.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { gestionnaire, incidentDepuisSignalement } from "../urbanhub-notifications/src/adaptateurs/entreeHttp.ts";
import { HistoriqueEnMemoire } from "../urbanhub-notifications/src/adaptateurs/historiqueMemoire.ts";
import type { Notification, Operateurs } from "../urbanhub-notifications/src/ports.ts";
import { ReceptionIncidents } from "../urbanhub-notifications/src/service.ts";

const signalementTrafic = { troncon: "rue-de-rivoli-1", vitesseMoyenne: 9.4, vitesseLimite: 30,
  debut: "2026-11-19T08:10:00", identifiant: "rue-de-rivoli-1:2026-11-19T08:10:00" };

async function demarrer(operateurs?: Operateurs) {
  const prevenus: Notification[] = [];
  const historique = new HistoriqueEnMemoire();
  const service = new ReceptionIncidents(
    operateurs ?? { prevenir: async (n) => { prevenus.push(n); } }, historique);
  const serveur = createServer(gestionnaire(service, () => {}));
  await new Promise<void>((ok) => serveur.listen(0, ok));
  const base = `http://localhost:${(serveur.address() as AddressInfo).port}`;
  const envoyer = (corps: string, methode = "POST", chemin = "/signalements") =>
    fetch(base + chemin, { method: methode, body: methode === "POST" ? corps : undefined,
      headers: { "Content-Type": "application/json" } });
  return { envoyer, prevenus, historique, fermer: () => serveur.close() };
}

test("la traduction : un signalement de trafic devient un incident, sans vocabulaire du trafic", () => {
  assert.deepEqual(incidentDepuisSignalement(signalementTrafic), {
    identifiant: "rue-de-rivoli-1:2026-11-19T08:10:00", source: "trafic", lieu: "rue-de-rivoli-1",
    resume: "circulation a 9 km/h pour 30 km/h autorises", survenu: "2026-11-19T08:10:00" });
});

test("POST /signalements valide : 202, les operateurs sont prevenus, l'incident est historise", async () => {
  const s = await demarrer();
  const reponse = await s.envoyer(JSON.stringify(signalementTrafic));
  s.fermer();
  assert.equal(reponse.status, 202);
  assert.deepEqual(s.prevenus.map((n) => n.texte),
    ["[trafic] rue-de-rivoli-1 : circulation a 9 km/h pour 30 km/h autorises (depuis 08:10)"]);
  assert.equal(s.historique.tous().length, 1);
});

test("une donnee fausse : 422, et rien ne se passe (la renvoyer ne servirait a rien)", async () => {
  const s = await demarrer();
  const casses = ["{pas du json", JSON.stringify({ ...signalementTrafic, vitesseMoyenne: "vite" }),
    JSON.stringify({ ...signalementTrafic, debut: "hier" }), JSON.stringify({})];
  const statuts = [];
  for (const corps of casses) statuts.push((await s.envoyer(corps)).status);
  s.fermer();
  assert.deepEqual(statuts, [422, 422, 422, 422]);
  assert.equal(s.prevenus.length, 0);
});

test("operateurs injoignables : 500, et l'incident n'est pas historise (Trafic retentera)", async () => {
  const erreurs = console.error;
  console.error = () => {};                // l'erreur est journalisee : on ne la montre pas ici
  const s = await demarrer({ prevenir: async () => { throw new Error("SMS en panne"); } });
  const reponse = await s.envoyer(JSON.stringify(signalementTrafic));
  s.fermer();
  console.error = erreurs;
  assert.equal(reponse.status, 500);
  assert.equal(s.historique.tous().length, 0);
});

test("une autre route ou une autre methode : 404", async () => {
  const s = await demarrer();
  const statuts = [(await s.envoyer("", "GET")).status,
    (await s.envoyer("{}", "POST", "/alertes")).status];
  s.fermer();
  assert.deepEqual(statuts, [404, 404]);
});
