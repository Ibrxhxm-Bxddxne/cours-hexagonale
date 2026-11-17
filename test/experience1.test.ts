// TP1, experience 1 : la logique metier testee seule, sans base ni reseau.
// Inspire de surveillance.test.ts : un depot en memoire et un faux publicateur.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Alerte } from "../urbanhub-air/src/ports.ts";
import { DepotMesuresEnMemoire } from "../urbanhub-air/src/adaptateurs/depotMemoire.ts";
import { mesure } from "../urbanhub-air/src/domaine.ts";
import { SeuilMoyenneJournaliere } from "../urbanhub-air/src/regles.ts";
import { SurveillanceQualiteAir } from "../urbanhub-air/src/service.ts";

function assembler() {
  const publiees: Alerte[] = [];  // faux publicateur : il retient au lieu d'envoyer
  const service = new SurveillanceQualiteAir(new DepotMesuresEnMemoire(),
    { publier: async (a) => { publiees.push(a); } }, new SeuilMoyenneJournaliere("PM10", 50));
  return { service, publiees };
}
const m = (polluant: string, valeur: number, horodatage: string) =>
  mesure({ capteur: "capteur-12", polluant, valeur, horodatage });

test("une moyenne egale au seuil (50) ne declenche rien : le seuil est strict", async () => {
  const { service, publiees } = assembler();
  await service.executer(m("PM10", 40, "2026-11-17T08:00:00"));
  await service.executer(m("PM10", 60, "2026-11-17T09:00:00"));   // moyenne 50
  assert.equal(publiees.length, 0);
});

test("un autre polluant (NO2 a 90) ne declenche pas la regle PM10", async () => {
  const { service, publiees } = assembler();
  await service.executer(m("NO2", 90, "2026-11-17T08:00:00"));
  assert.equal(publiees.length, 0);
});

test("la veille ne compte pas dans la moyenne du jour", async () => {
  const { service, publiees } = assembler();
  await service.executer(m("PM10", 200, "2026-11-16T23:00:00"));   // veille : alerte du 16
  await service.executer(m("PM10", 30, "2026-11-17T08:00:00"));    // jour : moyenne 30, rien
  assert.deepEqual(publiees.map((a) => a.jour), ["2026-11-16"]);
});
