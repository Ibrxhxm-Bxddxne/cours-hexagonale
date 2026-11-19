// TP4, etape 4 : le consommateur IDEMPOTENT. Un message recu deux fois n'agit qu'une fois.
// La cle : l'identifiant tire de la mesure qui a declenche le signalement (troncon:debut).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { gestionnaire } from "../urbanhub-notifications/src/adaptateurs/entreeHttp.ts";
import { HistoriqueEnMemoire } from "../urbanhub-notifications/src/adaptateurs/historiqueMemoire.ts";
import { HistoriqueSqlite } from "../urbanhub-notifications/src/adaptateurs/historiqueSqlite.ts";
import { incident } from "../urbanhub-notifications/src/domaine.ts";
import type { Historique, Notification, Operateurs } from "../urbanhub-notifications/src/ports.ts";
import { ReceptionIncidents } from "../urbanhub-notifications/src/service.ts";

// le message que Trafic envoie (etape 2) : son identifiant vient du releve, troncon:debut
const signalement = { troncon: "rue-de-rivoli-1", vitesseMoyenne: 9, vitesseLimite: 30,
  debut: "2026-11-19T08:10:00", identifiant: "rue-de-rivoli-1:2026-11-19T08:10:00" };
const bouchon = incident({ identifiant: signalement.identifiant, source: "trafic",
  lieu: "rue-de-rivoli-1", resume: "bouchon", survenu: signalement.debut });

function espion() {
  const prevenus: Notification[] = [];
  return { prevenus, operateurs: { prevenir: async (n: Notification) => { prevenus.push(n); } } };
}

async function serveur(operateurs: Operateurs, historique: Historique, journal: string[] = []) {
  const s = createServer(gestionnaire(new ReceptionIncidents(operateurs, historique),
    (l) => journal.push(l)));
  await new Promise<void>((ok) => s.listen(0, ok));
  const url = `http://localhost:${(s.address() as AddressInfo).port}/signalements`;
  const envoyer = () => fetch(url, { method: "POST", body: JSON.stringify(signalement),
    headers: { "Content-Type": "application/json" } }).then((r) => r.status);
  return { envoyer, fermer: () => s.close() };
}

test("LE test de la consigne : le meme message envoye deux fois en HTTP, une seule notification", async () => {
  const { prevenus, operateurs } = espion();
  const journal: string[] = [];
  const s = await serveur(operateurs, new HistoriqueEnMemoire(), journal);
  const statuts = [await s.envoyer(), await s.envoyer()];
  s.fermer();
  assert.deepEqual(statuts, [202, 202]);     // les deux sont acceptes : l'emetteur n'insiste pas
  assert.equal(prevenus.length, 1);          // mais les operateurs ne sont prevenus qu'UNE fois
  assert.deepEqual(journal, [`recu ${signalement.identifiant}`, `recu ${signalement.identifiant}`,
    `doublon ignore ${signalement.identifiant}`]);
});

test("le cas d'utilisation dit ce qu'il a fait : notifie, puis doublon", async () => {
  const { prevenus, operateurs } = espion();
  const service = new ReceptionIncidents(operateurs, new HistoriqueEnMemoire());
  assert.equal(await service.executer(bouchon), "notifie");
  assert.equal(await service.executer(bouchon), "doublon");
  assert.equal(prevenus.length, 1);
});

test("deux envois SIMULTANES du meme message (le reessai arrive pendant le premier) : une notification", async () => {
  const prevenus: Notification[] = [];
  let liberer = () => {};
  const lents = { prevenir: async (n: Notification) => {   // des operateurs lents a repondre
    await new Promise<void>((ok) => { liberer = ok; }); prevenus.push(n); } };
  const service = new ReceptionIncidents(lents, new HistoriqueEnMemoire());
  const premier = service.executer(bouchon);  // en cours, pas encore fini
  const second = await service.executer(bouchon);
  liberer();
  assert.equal(await premier, "notifie");
  assert.equal(second, "doublon");
  assert.equal(prevenus.length, 1);
});

test("un episode nouveau (meme troncon, autre debut) n'est PAS un doublon", async () => {
  const { prevenus, operateurs } = espion();
  const service = new ReceptionIncidents(operateurs, new HistoriqueEnMemoire());
  await service.executer(bouchon);
  await service.executer({ ...bouchon, identifiant: "rue-de-rivoli-1:2026-11-19T17:40:00" });
  assert.equal(prevenus.length, 2);
});

test("operateurs en panne au 1er envoi : 500, puis le renvoi passe, et une seule notification au total", async () => {
  const prevenus: Notification[] = [];
  let enPanne = true;
  const operateurs = { prevenir: async (n: Notification) => {
    if (enPanne) throw new Error("SMS en panne"); prevenus.push(n); } };
  const erreurs = console.error;
  console.error = () => {};
  const s = await serveur(operateurs, new HistoriqueEnMemoire());
  const premier = await s.envoyer();
  enPanne = false;
  const renvoi = await s.envoyer();
  const doublon = await s.envoyer();
  s.fermer();
  console.error = erreurs;
  assert.deepEqual([premier, renvoi, doublon], [500, 202, 202]);
  assert.equal(prevenus.length, 1);
});

test("l'idempotence survit a un REDEMARRAGE de Notifications (historique SQLite)", async () => {
  const chemin = join(mkdtempSync(join(tmpdir(), "idempotence-")), "notifications.db");
  const { prevenus, operateurs } = espion();
  const avant = new HistoriqueSqlite(chemin);
  await new ReceptionIncidents(operateurs, avant).executer(bouchon);
  avant.fermer();                                   // le service s'arrete
  const apres = new HistoriqueSqlite(chemin);       // et redemarre
  assert.equal(await new ReceptionIncidents(operateurs, apres).executer(bouchon), "doublon");
  apres.fermer();
  assert.equal(prevenus.length, 1);
});
