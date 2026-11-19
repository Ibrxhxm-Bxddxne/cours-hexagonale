// TP4, etape 3 : le Decorateur COUPE-CIRCUIT du service Trafic.
// Il s'ouvre apres 5 echecs d'affilee, refuse tout pendant 30 s, puis laisse passer UN appel d'essai.
// L'horloge est celle du test : on avance de 30 s sans attendre 30 s.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PublicateurAvecCoupeCircuit } from "../urbanhub-trafic/src/adaptateurs/coupeCircuit.ts";
import { CircuitOuvert, RefusDefinitif } from "../urbanhub-trafic/src/adaptateurs/erreurs.ts";
import { PublicateurAvecReessai } from "../urbanhub-trafic/src/adaptateurs/reessai.ts";
import type { Signalement } from "../urbanhub-trafic/src/ports.ts";

const s = {} as Signalement;

/** Un destinataire dont on regle la sante, et qui compte les appels qui l'atteignent. */
function destinataire() {
  const d = { enPanne: true, appels: 0, erreur: () => new Error("Notifications injoignable") as Error,
    publier: async (_s: Signalement) => { d.appels += 1; if (d.enPanne) throw d.erreur(); } };
  return d;
}
function assembler() {
  const horloge = { t: 0 };
  const d = destinataire();
  const circuit = new PublicateurAvecCoupeCircuit(d, 5, 30_000, () => horloge.t);
  return { horloge, d, circuit };
}
const echouer = (circuit: PublicateurAvecCoupeCircuit, fois: number) =>
  Promise.all(Array.from({ length: fois }, () => circuit.publier(s).catch(() => {})));

test("ferme : 4 echecs d'affilee, il reste ferme et chaque appel atteint le destinataire", async () => {
  const { d, circuit } = assembler();
  for (let i = 0; i < 4; i++) await assert.rejects(circuit.publier(s), /injoignable/);
  assert.equal(circuit.etat, "ferme");
  assert.equal(d.appels, 4);
});

test("au 5e echec il s'ouvre : l'appel suivant echoue AUSSITOT, sans toucher le reseau", async () => {
  const { d, circuit } = assembler();
  for (let i = 0; i < 5; i++) await circuit.publier(s).catch(() => {});
  assert.equal(circuit.etat, "ouvert");
  await assert.rejects(circuit.publier(s), CircuitOuvert);
  assert.equal(d.appels, 5);                 // le 6e appel n'est pas parti
});

test("les echecs comptent D'AFFILEE : un succes remet le compte a zero", async () => {
  const { d, circuit } = assembler();
  for (let i = 0; i < 4; i++) await circuit.publier(s).catch(() => {});
  d.enPanne = false;
  await circuit.publier(s);
  d.enPanne = true;
  for (let i = 0; i < 4; i++) await circuit.publier(s).catch(() => {});
  assert.equal(circuit.etat, "ferme");       // 4 + 4 echecs, mais jamais 5 d'affilee
});

test("ouvert pendant 30 s, pas une de moins", async () => {
  const { horloge, d, circuit } = assembler();
  await echouer(circuit, 5);
  horloge.t = 29_999;
  await assert.rejects(circuit.publier(s), CircuitOuvert);
  assert.equal(d.appels, 5);
  horloge.t = 30_000;
  assert.equal(circuit.etat, "semi-ouvert");
});

test("semi-ouvert : UN appel d'essai passe ; s'il reussit, le circuit se referme", async () => {
  const { horloge, d, circuit } = assembler();
  await echouer(circuit, 5);
  horloge.t = 30_000;
  d.enPanne = false;
  await circuit.publier(s);
  assert.equal(d.appels, 6);
  assert.equal(circuit.etat, "ferme");
});

test("semi-ouvert : si l'essai rate, il se rouvre pour 30 s de plus", async () => {
  const { horloge, d, circuit } = assembler();
  await echouer(circuit, 5);
  horloge.t = 30_000;
  await assert.rejects(circuit.publier(s), /injoignable/);   // l'essai part, et rate
  assert.equal(d.appels, 6);
  horloge.t = 59_999;
  assert.equal(circuit.etat, "ouvert");
  horloge.t = 60_000;
  assert.equal(circuit.etat, "semi-ouvert");
});

test("semi-ouvert : pendant l'essai, les autres appels sont refuses (un seul essai a la fois)", async () => {
  const { horloge, d, circuit } = assembler();
  await echouer(circuit, 5);
  horloge.t = 30_000;
  let liberer = () => {};
  d.enPanne = false;
  d.publier = async () => { d.appels += 1; await new Promise<void>((ok) => { liberer = ok; }); };
  const essai = circuit.publier(s);          // l'essai est en vol
  await assert.rejects(circuit.publier(s), CircuitOuvert);
  liberer();
  await essai;
  assert.equal(d.appels, 6);
  assert.equal(circuit.etat, "ferme");
});

test("un refus 422 n'est pas une panne : il ne compte pas, le circuit reste ferme", async () => {
  const { d, circuit } = assembler();
  d.erreur = () => new RefusDefinitif(422);
  for (let i = 0; i < 10; i++) await assert.rejects(circuit.publier(s), RefusDefinitif);
  assert.equal(circuit.etat, "ferme");
});

test("empiles comme dans principal.ts (reessai autour du coupe-circuit) : la panne cesse d'etre appelee", async () => {
  const { d, circuit } = assembler();
  const pauses: number[] = [];
  const publicateur = new PublicateurAvecReessai(circuit, 3, 500, async (ms) => { pauses.push(ms); });
  await publicateur.publier(s).catch(() => {});   // releve 1 : 3 appels reseau (echecs 1 a 3)
  await publicateur.publier(s).catch(() => {});   // releve 2 : 2 appels (echecs 4, 5 : ouvert), puis refus
  assert.equal(d.appels, 5);
  assert.equal(circuit.etat, "ouvert");
  const avant = pauses.length;
  await assert.rejects(publicateur.publier(s), CircuitOuvert);   // releve 3 : aucun appel, aucune pause
  assert.equal(d.appels, 5);
  assert.equal(pauses.length, avant);
});
