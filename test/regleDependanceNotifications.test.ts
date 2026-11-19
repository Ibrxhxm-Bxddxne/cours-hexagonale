// TP4, etape 1 : la regle de dependance du service Notifications.
// Le centre (tous les fichiers de src/, sauf adaptateurs/ et la racine de composition)
// n'importe aucune technique : ni module Node, ni adaptateur, ni fetch.
// Il n'importe pas non plus un AUTRE service : chaque contexte delimite a son propre modele.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const SRC = new URL("../urbanhub-notifications/src/", import.meta.url);
const HORS_CENTRE = ["principal.ts"];
const INTERDIT = /from\s+["'](node:|\.\.?\/adaptateurs\/)|\bimport\(|\brequire\(|\bfetch\(/;
const AUTRE_SERVICE = /from\s+["'][^"']*urbanhub-(air|alertes|trafic)\//;

const centre = readdirSync(SRC, { withFileTypes: true })
  .filter((f) => f.isFile() && f.name.endsWith(".ts") && !HORS_CENTRE.includes(f.name))
  .map((f) => f.name);

test("le centre du service Notifications contient bien domaine, ports et service", () => {
  for (const attendu of ["domaine.ts", "ports.ts", "service.ts"]) {
    assert.ok(centre.includes(attendu), `${attendu} manque au centre`);
  }
});

for (const fichier of centre) {
  test(`notifications/${fichier} n'importe aucune technique, ni un autre service`, () => {
    const source = readFileSync(new URL(fichier, SRC), "utf8");
    assert.doesNotMatch(source, INTERDIT);
    assert.doesNotMatch(source, AUTRE_SERVICE);
  });
}

test("la regle attrape les fautes", () => {
  assert.match('import { DatabaseSync } from "node:sqlite";', INTERDIT);
  assert.match('import { HistoriqueSqlite } from "./adaptateurs/historiqueSqlite.ts";', INTERDIT);
  assert.match('import type { Signalement } from "../../urbanhub-trafic/src/domaine.ts";', AUTRE_SERVICE);
});
