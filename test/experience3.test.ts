// TP1, experience 3 : une troisieme entree (ligne de commande), aux cotes de HTTP et CSV.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lancer } from "../urbanhub-air/src/adaptateurs/entreeLigneDeCommande.ts";
import { DepotMesuresEnMemoire } from "../urbanhub-air/src/adaptateurs/depotMemoire.ts";
import type { Alerte } from "../urbanhub-air/src/ports.ts";
import { SeuilMoyenneJournaliere } from "../urbanhub-air/src/regles.ts";
import { SurveillanceQualiteAir } from "../urbanhub-air/src/service.ts";

function assembler() {
  const publiees: Alerte[] = [];
  const service = new SurveillanceQualiteAir(new DepotMesuresEnMemoire(),
    { publier: async (a) => { publiees.push(a); } }, new SeuilMoyenneJournaliere("PM10", 50));
  return { service, publiees };
}

test("la ligne de commande donne la meme alerte que HTTP et CSV : moyenne 55", async () => {
  const { service, publiees } = assembler();
  assert.equal(await lancer(["capteur-12", "PM10", "40", "2026-11-17T08:00:00"], service), 0);
  assert.equal(await lancer(["capteur-12", "PM10", "70", "2026-11-17T09:00:00"], service), 0);
  assert.deepEqual(publiees.map((a) => a.moyenne), [55]);
});

test("des arguments incomplets sont refuses (code 2), comme le 422 de HTTP", async () => {
  const { service, publiees } = assembler();
  const messages: string[] = [];
  assert.equal(await lancer(["capteur-12", "PM10"], service, (t) => messages.push(t)), 2);
  assert.equal(publiees.length, 0);
  assert.match(messages[0], /usage/);
});
