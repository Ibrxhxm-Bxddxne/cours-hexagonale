import { DatabaseSync } from "node:sqlite";    // dans Node.js depuis la 22.13
import { releve } from "../domaine.ts";
import type { DepotReleves, Releve } from "../ports.ts";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS releve (troncon TEXT NOT NULL, vitesse REAL NOT NULL,
    horodatage TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS releve_par_troncon_et_heure ON releve (troncon, horodatage);`;

/** Adaptateur REEL du port DepotReleves : les releves survivent a un redemarrage. */
export class DepotRelevesSqlite implements DepotReleves {
  #base: DatabaseSync;

  constructor(chemin: string) {      // ":memory:" pour une base jetable
    this.#base = new DatabaseSync(chemin);
    this.#base.exec(SCHEMA);
  }

  enregistrer(r: Releve) {           // des parametres ?, jamais de concatenation
    this.#base.prepare("INSERT INTO releve (troncon, vitesse, horodatage) VALUES (?, ?, ?)")
      .run(r.troncon, r.vitesse, r.horodatage);
  }

  entre(troncon: string, debut: string, fin: string) {
    // l'index (troncon, horodatage) evite de relire toute la table a chaque releve
    return this.#base.prepare("SELECT troncon, vitesse, horodatage FROM releve"
      + " WHERE troncon = ? AND horodatage BETWEEN ? AND ?")
      .all(troncon, debut, fin)
      .map((ligne) => releve(ligne as Releve));   // traduction : ligne -> objet du domaine
  }

  fermer() {
    this.#base.close();
  }
}
