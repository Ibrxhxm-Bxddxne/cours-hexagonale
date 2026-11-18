// TP2, etape 4 : le test de CONTRAT du port DepotReleves.
// Le meme test, ecrit une fois, passe sur l'adaptateur en memoire et sur l'adaptateur SQLite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DepotRelevesEnMemoire } from "../urbanhub-trafic/src/adaptateurs/depotMemoire.ts";
import { DepotRelevesSqlite } from "../urbanhub-trafic/src/adaptateurs/depotSqlite.ts";
import { releve } from "../urbanhub-trafic/src/domaine.ts";
import type { DepotReleves, Releve } from "../urbanhub-trafic/src/ports.ts";

const fichierNeuf = () => join(mkdtempSync(join(tmpdir(), "trafic-")), "releves.db");

// Un adaptateur de plus ? Une ligne ici, et il passe tout le contrat.
const adaptateurs: Record<string, () => DepotReleves> = {
  memoire: () => new DepotRelevesEnMemoire(),
  sqlite: () => new DepotRelevesSqlite(fichierNeuf()),
};

const VOLTAIRE = "boulevard-voltaire-3";
const r = (troncon: string, vitesse: number, horodatage: string) =>
  releve({ troncon, vitesse, horodatage });
// L'ordre ne fait pas partie du contrat : le service ne calcule qu'une moyenne.
const tries = (rs: Releve[]) => [...rs].sort((a, b) =>
  a.horodatage.localeCompare(b.horodatage) || a.vitesse - b.vitesse);

for (const [nom, creer] of Object.entries(adaptateurs)) {
  test(`${nom} : la fenetre rend les releves du troncon entre debut et fin, bornes incluses`, () => {
    const depot = creer();
    const avant = r(VOLTAIRE, 30, "2026-11-18T07:54:59");   // 1 seconde trop tot
    const debut = r(VOLTAIRE, 15, "2026-11-18T07:55:00");   // borne basse : incluse
    const milieu = r(VOLTAIRE, 12, "2026-11-18T08:02:00");
    const fin = r(VOLTAIRE, 10, "2026-11-18T08:10:00");     // borne haute : incluse
    const apres = r(VOLTAIRE, 40, "2026-11-18T08:10:01");   // 1 seconde trop tard
    const voisin = r("rue-de-rivoli-1", 5, "2026-11-18T08:00:00");
    [apres, milieu, avant, voisin, fin, debut].forEach((x) => depot.enregistrer(x));

    assert.deepEqual(tries(depot.entre(VOLTAIRE, "2026-11-18T07:55:00", "2026-11-18T08:10:00")),
      [debut, milieu, fin]);
  });

  test(`${nom} : une fenetre sans releve rend une liste vide`, () => {
    const depot = creer();
    depot.enregistrer(r(VOLTAIRE, 30, "2026-11-18T08:00:00"));
    assert.deepEqual(depot.entre(VOLTAIRE, "2026-11-18T09:00:00", "2026-11-18T09:15:00"), []);
    assert.deepEqual(depot.entre("rue-inconnue", "2026-11-18T00:00:00", "2026-11-18T23:59:59"), []);
  });

  test(`${nom} : une fenetre qui passe minuit garde la veille et le jour`, () => {
    const depot = creer();
    const veille = r(VOLTAIRE, 20, "2026-11-17T23:55:00");
    const jour = r(VOLTAIRE, 25, "2026-11-18T00:05:00");
    [jour, veille].forEach((x) => depot.enregistrer(x));
    assert.deepEqual(tries(depot.entre(VOLTAIRE, "2026-11-17T23:50:00", "2026-11-18T00:05:00")),
      [veille, jour]);
  });

  test(`${nom} : deux releves a la meme seconde (deux capteurs) sont gardes tous les deux`, () => {
    const depot = creer();
    const a = r(VOLTAIRE, 10, "2026-11-18T08:00:00");
    const b = r(VOLTAIRE, 14, "2026-11-18T08:00:00");
    [a, b].forEach((x) => depot.enregistrer(x));
    assert.deepEqual(tries(depot.entre(VOLTAIRE, "2026-11-18T08:00:00", "2026-11-18T08:00:00")),
      [a, b]);
  });

  test(`${nom} : les releves rendus sont des objets du domaine (vitesse en nombre, figes)`, () => {
    const depot = creer();
    depot.enregistrer(r(VOLTAIRE, 17.5, "2026-11-18T08:00:00"));
    const [lu] = depot.entre(VOLTAIRE, "2026-11-18T08:00:00", "2026-11-18T08:00:00");
    assert.equal(typeof lu.vitesse, "number");
    assert.equal(lu.vitesse, 17.5);
    assert.ok(Object.isFrozen(lu), "le releve rendu doit etre fige, comme ceux du domaine");
  });
}

// Ce que seul l'adaptateur reel apporte : la raison de l'ecrire.
test("sqlite seulement : les releves survivent a un redemarrage du service", () => {
  const chemin = fichierNeuf();
  const premier = new DepotRelevesSqlite(chemin);
  premier.enregistrer(r(VOLTAIRE, 12, "2026-11-18T08:00:00"));
  premier.fermer();                                         // le service s'arrete

  const apresRedemarrage = new DepotRelevesSqlite(chemin);  // et redemarre
  assert.deepEqual(apresRedemarrage.entre(VOLTAIRE, "2026-11-18T07:45:00", "2026-11-18T08:00:00"),
    [r(VOLTAIRE, 12, "2026-11-18T08:00:00")]);
  apresRedemarrage.fermer();
});
