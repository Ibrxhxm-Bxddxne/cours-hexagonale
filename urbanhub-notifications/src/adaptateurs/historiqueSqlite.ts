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

  enregistrer(i: Incident) {         // un identifiant deja present n'ajoute rien
    this.#base.prepare("INSERT INTO incident (identifiant, source, lieu, resume, survenu)"
      + " VALUES (?, ?, ?, ?, ?) ON CONFLICT (identifiant) DO NOTHING")
      .run(i.identifiant, i.source, i.lieu, i.resume, i.survenu);
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
