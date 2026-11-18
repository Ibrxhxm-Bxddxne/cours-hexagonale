import { DatabaseSync } from "node:sqlite";
import type { EtatTroncon, EtatsTroncons } from "../ports.ts";

const SCHEMA = `CREATE TABLE IF NOT EXISTS etat_troncon (
  troncon TEXT PRIMARY KEY,
  etat TEXT NOT NULL CHECK (etat IN ('fluide', 'congestionne')))`;

/** Le MEME port EtatsTroncons, dans SQLite : l'etat « deja signale » survit a un redemarrage. */
export class EtatsTronconsSqlite implements EtatsTroncons {
  #base: DatabaseSync;

  constructor(chemin: string) {
    this.#base = new DatabaseSync(chemin);
    this.#base.exec(SCHEMA);
  }

  etat(troncon: string): EtatTroncon {
    const ligne = this.#base.prepare("SELECT etat FROM etat_troncon WHERE troncon = ?")
      .get(troncon) as { etat: EtatTroncon } | undefined;
    return ligne?.etat ?? "fluide";                    // un troncon jamais vu est fluide
  }

  changer(troncon: string, etat: EtatTroncon) {        // une ligne par troncon : on la remplace
    this.#base.prepare("INSERT INTO etat_troncon (troncon, etat) VALUES (?, ?)"
      + " ON CONFLICT (troncon) DO UPDATE SET etat = excluded.etat").run(troncon, etat);
  }

  fermer() {
    this.#base.close();
  }
}
