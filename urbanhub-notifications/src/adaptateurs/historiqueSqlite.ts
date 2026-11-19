import { DatabaseSync } from "node:sqlite";
import { incident } from "../domaine.ts";
import type { Historique, Incident } from "../ports.ts";

const SCHEMA = `CREATE TABLE IF NOT EXISTS incident (
  rang INTEGER PRIMARY KEY AUTOINCREMENT,
  identifiant TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL, lieu TEXT NOT NULL, resume TEXT NOT NULL, survenu TEXT NOT NULL)`;

/** Adaptateur REEL du port Historique : la base propre au service, notifications.db. */
export class HistoriqueSqlite implements Historique {
  #base: DatabaseSync;

  constructor(chemin: string) {
    this.#base = new DatabaseSync(chemin);
    this.#base.exec(SCHEMA);
  }

  enregistrer(i: Incident) {         // indivisible : la contrainte UNIQUE tranche, pas un SELECT avant
    const { changes } = this.#base.prepare(
      "INSERT INTO incident (identifiant, source, lieu, resume, survenu)"
      + " VALUES (?, ?, ?, ?, ?) ON CONFLICT (identifiant) DO NOTHING")
      .run(i.identifiant, i.source, i.lieu, i.resume, i.survenu);
    return changes === 1;            // 1 ligne ajoutee : nouveau ; 0 : deja la
  }

  retirer(identifiant: string) {
    this.#base.prepare("DELETE FROM incident WHERE identifiant = ?").run(identifiant);
  }

  tous() {
    return this.#base.prepare("SELECT identifiant, source, lieu, resume, survenu"
      + " FROM incident ORDER BY rang").all()
      .map((ligne) => incident(ligne as Incident));   // traduction : ligne -> objet du domaine
  }

  fermer() {
    this.#base.close();
  }
}
