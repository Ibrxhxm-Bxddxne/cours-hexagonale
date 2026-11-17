import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mesure } from "../domaine.ts";
import type { DepotMesures, Mesure } from "../ports.ts";

/** TP1, experience 2 : le MEME port DepotMesures, range dans un fichier JSON. */
export class DepotMesuresFichierJson implements DepotMesures {
  #chemin: string;

  constructor(chemin: string) {
    this.#chemin = chemin;
    if (!existsSync(chemin)) writeFileSync(chemin, "[]");
  }

  #lire(): Mesure[] {             // traduction : texte JSON -> objets du domaine
    return (JSON.parse(readFileSync(this.#chemin, "utf8")) as Mesure[]).map(mesure);
  }

  enregistrer(m: Mesure) {        // traduction : objet du domaine -> texte JSON
    writeFileSync(this.#chemin, JSON.stringify([...this.#lire(), m]));
  }

  duJour(capteur: string, polluant: string, jour: string) {
    return this.#lire().filter((m) => m.capteur === capteur
      && m.polluant === polluant && m.horodatage.startsWith(jour));
  }
}
