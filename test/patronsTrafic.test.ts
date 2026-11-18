// TP2, etape 5 : les deux patrons du service Trafic, chacun sur son vrai probleme.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DepotRelevesEnMemoire } from "../urbanhub-trafic/src/adaptateurs/depotMemoire.ts";
import { EtatsTronconsEnMemoire } from "../urbanhub-trafic/src/adaptateurs/etatsMemoire.ts";
import { ReferentielTronconsEnMemoire } from "../urbanhub-trafic/src/adaptateurs/referentielMemoire.ts";
import { PublicateurAvecReessai } from "../urbanhub-trafic/src/adaptateurs/reessai.ts";
import { releve } from "../urbanhub-trafic/src/domaine.ts";
import type { PublicateurSignalements, Signalement } from "../urbanhub-trafic/src/ports.ts";
import { type RegleCongestion, SeuilRelatif, SeuilRelatifAvecMinimum } from "../urbanhub-trafic/src/regles.ts";
import { SurveillanceTrafic } from "../urbanhub-trafic/src/service.ts";

const VOLTAIRE = "boulevard-voltaire-3";   // limite 50 km/h : seuil a 20 km/h

function assembler(regle: RegleCongestion, publicateur?: PublicateurSignalements) {
  const publies: Signalement[] = [];
  const service = new SurveillanceTrafic(new DepotRelevesEnMemoire(),
    new ReferentielTronconsEnMemoire([{ identifiant: VOLTAIRE, vitesseLimite: 50 }]),
    new EtatsTronconsEnMemoire(),
    publicateur ?? { publier: async (s) => { publies.push(s); } }, regle);
  return { service, publies };
}
const r = (vitesse: number, heure: string) =>
  releve({ troncon: VOLTAIRE, vitesse, horodatage: `2026-11-18T${heure}:00` });

// ---------- STRATEGIE : la regle de congestion ----------

test("strategie, le probleme : la nuit, UN bus a l'arret (5 km/h) declenche un faux bouchon", async () => {
  const { service, publies } = assembler(new SeuilRelatif(0.4));
  await service.executer(r(5, "03:00"));
  assert.equal(publies.length, 1);           // faux signalement avec la regle simple
});

test("strategie, la solution : avec un minimum de 3 releves, le bus seul ne suffit pas", async () => {
  const { service, publies } = assembler(new SeuilRelatifAvecMinimum(3, 0.4));
  await service.executer(r(5, "03:00"));
  assert.equal(publies.length, 0);
});

test("strategie : avec 3 releves lents, le vrai bouchon est bien signale", async () => {
  const { service, publies } = assembler(new SeuilRelatifAvecMinimum(3, 0.4));
  for (const heure of ["08:00", "08:01", "08:02"]) await service.executer(r(10, heure));
  assert.deepEqual(publies.map((s) => s.debut), ["2026-11-18T08:02:00"]);
});

test("strategie : trop peu de releves ne termine pas un episode en cours (pas de double signalement)", async () => {
  const { service, publies } = assembler(new SeuilRelatifAvecMinimum(3, 0.4));
  for (const heure of ["08:00", "08:01", "08:02"]) await service.executer(r(10, heure)); // signale
  await service.executer(r(45, "08:30"));    // 1 seul releve dans la fenetre : on ne conclut pas
  for (const heure of ["08:31", "08:32"]) await service.executer(r(5, heure));
  // a 08:32 : (45 + 5 + 5) / 3 = 18,3, toujours congestionne -> l'episode continue, pas de 2e signalement
  // (avec SeuilRelatif seul, 08:30 aurait rendu le troncon fluide, et 08:32 l'aurait signale une 2e fois)
  assert.equal(publies.length, 1);
});

// ---------- DECORATEUR : le reessai autour du publicateur ----------

function publicateurQuiTombe(pannes: number) {
  const p = { appels: 0, recus: [] as Signalement[], async publier(s: Signalement) {
    p.appels += 1;
    if (p.appels <= pannes) throw new Error("reseau coupe");
    p.recus.push(s);
  } };
  return p;
}
const sansPause = async () => {};

test("decorateur, le probleme : sans reessai, une panne passagere retarde le signalement au releve suivant", async () => {
  const interne = publicateurQuiTombe(1);
  const { service } = assembler(new SeuilRelatif(0.4), interne);
  await assert.rejects(service.executer(r(10, "08:00")), /reseau coupe/);
  assert.equal(interne.recus.length, 0);     // personne n'est prevenu a 08:00
});

test("decorateur, la solution : la panne passagere est absorbee, signalement a l'heure", async () => {
  const interne = publicateurQuiTombe(2);
  const { service } = assembler(new SeuilRelatif(0.4),
    new PublicateurAvecReessai(interne, 3, 500, sansPause));
  await service.executer(r(10, "08:00"));
  assert.equal(interne.appels, 3);
  assert.deepEqual(interne.recus.map((s) => s.debut), ["2026-11-18T08:00:00"]);
});

test("decorateur : une panne durable remonte apres 3 essais, au lieu d'etre avalee", async () => {
  const interne = publicateurQuiTombe(99);
  await assert.rejects(new PublicateurAvecReessai(interne, 3, 500, sansPause)
    .publier({} as Signalement), /reseau coupe/);
  assert.equal(interne.appels, 3);
});

test("decorateur : les pauses grandissent (500 ms puis 1000 ms) pour ne pas assommer le destinataire", async () => {
  const pauses: number[] = [];
  await new PublicateurAvecReessai(publicateurQuiTombe(2), 3, 500,
    async (ms) => { pauses.push(ms); }).publier({} as Signalement);
  assert.deepEqual(pauses, [500, 1000]);
});
