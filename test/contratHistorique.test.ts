// TP4, etape 1 : le test de CONTRAT du port Historique (service Notifications).
// Le meme test pour l'adaptateur en memoire et pour celui de la base propre au service.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HistoriqueEnMemoire } from "../urbanhub-notifications/src/adaptateurs/historiqueMemoire.ts";
import { HistoriqueSqlite } from "../urbanhub-notifications/src/adaptateurs/historiqueSqlite.ts";
import { incident } from "../urbanhub-notifications/src/domaine.ts";
import type { Historique } from "../urbanhub-notifications/src/ports.ts";

const fichierNeuf = () => join(mkdtempSync(join(tmpdir(), "notifications-")), "notifications.db");

const adaptateurs: Record<string, () => Historique> = {
  memoire: () => new HistoriqueEnMemoire(),
  sqlite: () => new HistoriqueSqlite(fichierNeuf()),
};

const inc = (n: number) => incident({ identifiant: `troncon-${n}:2026-11-19T08:0${n}:00`,
  source: "trafic", lieu: `troncon-${n}`, resume: "bouchon", survenu: `2026-11-19T08:0${n}:00` });

for (const [nom, creer] of Object.entries(adaptateurs)) {
  test(`${nom} : un historique neuf est vide`, () => {
    assert.deepEqual(creer().tous(), []);
  });

  test(`${nom} : les incidents reviennent dans l'ordre d'enregistrement`, () => {
    const h = creer();
    [inc(3), inc(1), inc(2)].forEach((i) => h.enregistrer(i));
    assert.deepEqual(h.tous(), [inc(3), inc(1), inc(2)]);
  });

  test(`${nom} : le meme identifiant enregistre deux fois ne fait qu'une ligne`, () => {
    const h = creer();
    h.enregistrer(inc(1));
    h.enregistrer({ ...inc(1), resume: "autre texte" });
    assert.deepEqual(h.tous(), [inc(1)]);
  });

  test(`${nom} : enregistrer dit si l'incident est nouveau (true), puis deja la (false)`, () => {
    const h = creer();
    assert.equal(h.enregistrer(inc(1)), true);
    assert.equal(h.enregistrer(inc(1)), false);
    assert.equal(h.enregistrer(inc(2)), true);
  });

  test(`${nom} : retirer rend l'identifiant, qui peut etre enregistre de nouveau`, () => {
    const h = creer();
    h.enregistrer(inc(1));
    h.enregistrer(inc(2));
    h.retirer(inc(1).identifiant);
    assert.deepEqual(h.tous(), [inc(2)]);
    assert.equal(h.enregistrer(inc(1)), true);
    h.retirer("jamais-vu");                  // retirer un inconnu ne casse rien
  });
}

test("sqlite seulement : l'historique survit a un redemarrage du service", () => {
  const chemin = fichierNeuf();
  const avant = new HistoriqueSqlite(chemin);
  avant.enregistrer(inc(1));
  avant.fermer();
  const apres = new HistoriqueSqlite(chemin);
  assert.deepEqual(apres.tous(), [inc(1)]);
  apres.fermer();
});
