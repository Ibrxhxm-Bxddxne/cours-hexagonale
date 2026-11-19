// TP4, etape 3 : le Decorateur de REESSAI BORNE du service Trafic.
// Ses premiers tests (panne passagere absorbee, panne durable remontee, pauses qui grandissent)
// sont dans patronsTrafic.test.ts (TP 2). Ici : ses deux bornes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CircuitOuvert, RefusDefinitif } from "../urbanhub-trafic/src/adaptateurs/erreurs.ts";
import { PublicateurAvecReessai } from "../urbanhub-trafic/src/adaptateurs/reessai.ts";
import type { Signalement } from "../urbanhub-trafic/src/ports.ts";

const quiLeve = (erreur: () => Error) => {
  const p = { appels: 0, publier: async (_s: Signalement) => { p.appels += 1; throw erreur(); } };
  return p;
};
const pausesNotees = () => {
  const pauses: number[] = [];
  return { pauses, attendre: async (ms: number) => { pauses.push(ms); } };
};

test("borne 1 : jamais plus de 3 essais, puis l'erreur remonte", async () => {
  const interne = quiLeve(() => new Error("reseau coupe"));
  const { pauses, attendre } = pausesNotees();
  await assert.rejects(new PublicateurAvecReessai(interne, 3, 500, attendre)
    .publier({} as Signalement), /reseau coupe/);
  assert.equal(interne.appels, 3);
  assert.deepEqual(pauses, [500, 1000]);     // 1,5 s d'attente au plus, en plus des delais
});

test("borne 2 : un refus definitif (422) n'est PAS retente : un appel, aucune pause", async () => {
  const interne = quiLeve(() => new RefusDefinitif(422));
  const { pauses, attendre } = pausesNotees();
  await assert.rejects(new PublicateurAvecReessai(interne, 3, 500, attendre)
    .publier({} as Signalement), RefusDefinitif);
  assert.equal(interne.appels, 1);
  assert.deepEqual(pauses, []);
});

test("borne 2 : un circuit ouvert n'est PAS retente : un appel, aucune pause", async () => {
  const interne = quiLeve(() => new CircuitOuvert());
  const { pauses, attendre } = pausesNotees();
  await assert.rejects(new PublicateurAvecReessai(interne, 3, 500, attendre)
    .publier({} as Signalement), CircuitOuvert);
  assert.equal(interne.appels, 1);
  assert.deepEqual(pauses, []);
});
