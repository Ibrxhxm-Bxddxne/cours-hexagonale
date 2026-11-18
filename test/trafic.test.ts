// TP2, etape 3 : le cas d'utilisation SurveillanceTrafic, teste avec des adaptateurs en memoire.
// Ni base, ni reseau : le test assemble lui-meme ses adaptateurs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DepotRelevesEnMemoire } from "../urbanhub-trafic/src/adaptateurs/depotMemoire.ts";
import { EtatsTronconsEnMemoire } from "../urbanhub-trafic/src/adaptateurs/etatsMemoire.ts";
import { ReferentielTronconsEnMemoire } from "../urbanhub-trafic/src/adaptateurs/referentielMemoire.ts";
import { TronconInconnu, releve } from "../urbanhub-trafic/src/domaine.ts";
import type { PublicateurSignalements, Signalement } from "../urbanhub-trafic/src/ports.ts";
import { SurveillanceTrafic } from "../urbanhub-trafic/src/service.ts";

const VOLTAIRE = "boulevard-voltaire-3";   // limite 50 km/h : seuil a 20 km/h
const RIVOLI = "rue-de-rivoli-1";          // limite 30 km/h : seuil a 12 km/h

function assembler(publicateur?: PublicateurSignalements) {
  const publies: Signalement[] = [];       // adaptateur de test : il retient
  const depot = new DepotRelevesEnMemoire();
  const service = new SurveillanceTrafic(depot,
    new ReferentielTronconsEnMemoire([{ identifiant: VOLTAIRE, vitesseLimite: 50 },
      { identifiant: RIVOLI, vitesseLimite: 30 }]),
    new EtatsTronconsEnMemoire(),
    publicateur ?? { publier: async (s) => { publies.push(s); } });
  return { service, publies, depot };
}
const r = (troncon: string, vitesse: number, heure: string) =>
  releve({ troncon, vitesse, horodatage: `2026-11-18T${heure}:00` });

test("l'exemple de l'etape 1 : un seul signalement, a 08:10, moyenne 18,33", async () => {
  const { service, publies } = assembler();
  for (const [vitesse, heure] of [[30, "08:00"], [15, "08:05"], [10, "08:10"],
    [12, "08:15"], [45, "08:30"]] as const) {
    await service.executer(r(VOLTAIRE, vitesse, heure));
  }
  assert.equal(publies.length, 1);
  assert.equal(publies[0].debut, "2026-11-18T08:10:00");
  assert.equal(publies[0].vitesseMoyenne.toFixed(2), "18.33");
  assert.equal(publies[0].identifiant, `${VOLTAIRE}:2026-11-18T08:10:00`);
});

test("une moyenne egale au seuil (20 km/h sur 50) reste fluide", async () => {
  const { service, publies } = assembler();
  await service.executer(r(VOLTAIRE, 20, "08:00"));
  assert.equal(publies.length, 0);
});

test("le seuil depend du troncon : 15 km/h congestionne Voltaire (50), pas Rivoli (30)", async () => {
  const { service, publies } = assembler();
  await service.executer(r(VOLTAIRE, 15, "08:00"));
  await service.executer(r(RIVOLI, 15, "08:00"));
  assert.deepEqual(publies.map((s) => s.troncon), [VOLTAIRE]);
});

test("redevenu fluide, un nouvel episode est signale de nouveau", async () => {
  const { service, publies } = assembler();
  await service.executer(r(VOLTAIRE, 10, "08:00"));   // episode 1
  await service.executer(r(VOLTAIRE, 50, "08:30"));   // fluide (08:00 sort de la fenetre)
  await service.executer(r(VOLTAIRE, 10, "09:00"));   // episode 2
  assert.deepEqual(publies.map((s) => s.debut),
    ["2026-11-18T08:00:00", "2026-11-18T09:00:00"]);
});

test("les releves d'un autre troncon ne comptent pas dans la moyenne", async () => {
  const { service, publies } = assembler();
  await service.executer(r(RIVOLI, 2, "08:00"));      // Rivoli congestionne
  await service.executer(r(VOLTAIRE, 30, "08:01"));   // Voltaire seul : 30, fluide
  assert.deepEqual(publies.map((s) => s.troncon), [RIVOLI]);
});

test("un troncon inconnu est refuse, et son releve n'est pas range", async () => {
  const { service, depot } = assembler();
  await assert.rejects(service.executer(r("rue-inconnue", 10, "08:00")), TronconInconnu);
  assert.deepEqual(depot.entre("rue-inconnue", "2026-11-18T00:00:00", "2026-11-18T23:59:59"), []);
});

test("si la publication echoue, l'erreur remonte et le releve suivant retente", async () => {
  let essais = 0;
  const publies: Signalement[] = [];
  const { service } = assembler({ publier: async (s) => {
    essais += 1;
    if (essais === 1) throw new Error("reseau coupe");
    publies.push(s);
  } });
  await assert.rejects(service.executer(r(VOLTAIRE, 10, "08:00")), /reseau coupe/);
  await service.executer(r(VOLTAIRE, 10, "08:05"));   // toujours congestionne : on retente
  assert.equal(publies.length, 1);
});
