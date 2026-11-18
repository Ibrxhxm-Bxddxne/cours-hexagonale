import type { EtatTroncon, EtatsTroncons } from "../ports.ts";

/** Adaptateur du port EtatsTroncons, pour les tests et le prototype. */
export class EtatsTronconsEnMemoire implements EtatsTroncons {
  #etats = new Map<string, EtatTroncon>();

  etat(troncon: string): EtatTroncon {
    return this.#etats.get(troncon) ?? "fluide";      // un troncon jamais vu est fluide
  }

  changer(troncon: string, etat: EtatTroncon) {
    this.#etats.set(troncon, etat);
  }
}
