// TP2, etape 3 : la regle de dependance du service Trafic.
// Le centre (tous les fichiers de src/, sauf adaptateurs/ et la racine de composition)
// n'importe aucune technique : ni module Node (base, reseau, fichiers), ni adaptateur, ni fetch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const SRC = new URL("../urbanhub-trafic/src/", import.meta.url);
const HORS_CENTRE = ["principal.ts"];   // la racine de composition a le droit de tout connaitre
const INTERDIT = /from\s+["'](node:|\.\.?\/adaptateurs\/)|\bimport\(|\brequire\(|\bfetch\(/;

// La liste est lue sur le disque : un nouveau fichier du centre est verifie sans rien ajouter ici.
const centre = readdirSync(SRC, { withFileTypes: true })
  .filter((f) => f.isFile() && f.name.endsWith(".ts") && !HORS_CENTRE.includes(f.name))
  .map((f) => f.name);

test("le centre du service Trafic contient bien domaine, ports et service", () => {
  for (const attendu of ["domaine.ts", "ports.ts", "service.ts"]) {
    assert.ok(centre.includes(attendu), `${attendu} manque au centre`);
  }
});

for (const fichier of centre) {
  test(`trafic/${fichier} n'importe aucune technique`, () => {
    assert.doesNotMatch(readFileSync(new URL(fichier, SRC), "utf8"), INTERDIT);
  });
}

test("la regle attrape les fautes", () => {
  for (const faute of [
    'import { DatabaseSync } from "node:sqlite";',
    'import { readFileSync } from "node:fs";',
    'import { DepotRelevesEnMemoire } from "./adaptateurs/depotMemoire.ts";',
    'await fetch("http://alertes:8002");',
    'const pg = await import("pg");',
  ]) {
    assert.match(faute, INTERDIT, faute);
  }
});
