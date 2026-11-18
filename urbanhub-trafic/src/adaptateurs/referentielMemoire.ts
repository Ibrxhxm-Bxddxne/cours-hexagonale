import { troncon } from "../domaine.ts";
import type { ReferentielTroncons, Troncon } from "../ports.ts";

/** Adaptateur du port ReferentielTroncons : la liste des troncons, donnee a la construction. */
export class ReferentielTronconsEnMemoire implements ReferentielTroncons {
  #troncons = new Map<string, Troncon>();

  constructor(troncons: Troncon[]) {
    for (const t of troncons) this.#troncons.set(t.identifiant, troncon(t));
  }

  trouver(identifiant: string) {
    return this.#troncons.get(identifiant);
  }
}
