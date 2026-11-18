// TP2, etape 6 : le test de CONTRAT du port EtatsTroncons.
// L'adaptateur SQLite remplace celui en memoire dans principal.ts : il doit tenir le meme contrat.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EtatsTronconsEnMemoire } from "../urbanhub-trafic/src/adaptateurs/etatsMemoire.ts";
import { EtatsTronconsSqlite } from "../urbanhub-trafic/src/adaptateurs/etatsSqlite.ts";
import type { EtatsTroncons } from "../urbanhub-trafic/src/ports.ts";

const fichierNeuf = () => join(mkdtempSync(join(tmpdir(), "trafic-etats-")), "etats.db");

const adaptateurs: Record<string, () => EtatsTroncons> = {
  memoire: () => new EtatsTronconsEnMemoire(),
  sqlite: () => new EtatsTronconsSqlite(fichierNeuf()),
};

for (const [nom, creer] of Object.entries(adaptateurs)) {
  test(`${nom} : un troncon jamais vu est fluide`, () => {
    assert.equal(creer().etat("boulevard-voltaire-3"), "fluide");
  });

  test(`${nom} : l'etat change, puis revient`, () => {
    const etats = creer();
    etats.changer("boulevard-voltaire-3", "congestionne");
    assert.equal(etats.etat("boulevard-voltaire-3"), "congestionne");
    etats.changer("boulevard-voltaire-3", "fluide");
    assert.equal(etats.etat("boulevard-voltaire-3"), "fluide");
  });

  test(`${nom} : changer deux fois le meme etat ne pose pas de probleme`, () => {
    const etats = creer();
    etats.changer("boulevard-voltaire-3", "congestionne");
    etats.changer("boulevard-voltaire-3", "congestionne");
    assert.equal(etats.etat("boulevard-voltaire-3"), "congestionne");
  });

  test(`${nom} : les troncons sont independants`, () => {
    const etats = creer();
    etats.changer("boulevard-voltaire-3", "congestionne");
    assert.equal(etats.etat("rue-de-rivoli-1"), "fluide");
  });
}

// La raison du remplacement : ce que la memoire ne sait pas faire.
test("sqlite seulement : l'etat « deja signale » survit a un redemarrage", () => {
  const chemin = fichierNeuf();
  const avant = new EtatsTronconsSqlite(chemin);
  avant.changer("boulevard-voltaire-3", "congestionne");
  avant.fermer();                                     // le service s'arrete
  const apres = new EtatsTronconsSqlite(chemin);      // et redemarre
  assert.equal(apres.etat("boulevard-voltaire-3"), "congestionne");
  apres.fermer();
});

test("sqlite seulement : la base refuse un etat hors du vocabulaire du domaine", () => {
  const etats = new EtatsTronconsSqlite(fichierNeuf());
  assert.throws(() => etats.changer("boulevard-voltaire-3", "bouche" as never), /CHECK/);
  etats.fermer();
});
