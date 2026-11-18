import type { DepotReleves, Releve } from "../ports.ts";

/** Adaptateur du port DepotReleves, pour les tests et le prototype. */
export class DepotRelevesEnMemoire implements DepotReleves {
  #releves: Releve[] = [];

  enregistrer(releve: Releve) {
    this.#releves.push(releve);
  }

  entre(troncon: string, debut: string, fin: string) {
    // meme format d'horodatage partout : la comparaison de textes suit l'ordre du temps
    return this.#releves.filter((r) => r.troncon === troncon
      && r.horodatage >= debut && r.horodatage <= fin);
  }
}
