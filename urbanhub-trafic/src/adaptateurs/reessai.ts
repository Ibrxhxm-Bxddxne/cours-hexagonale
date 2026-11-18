import type { PublicateurSignalements, Signalement } from "../ports.ts";

const dormir = (ms: number) => new Promise<void>((fin) => setTimeout(fin, ms));

/** Patron DECORATEUR : le MEME port PublicateurSignalements, avec un reessai autour.
 *  Ni le service ni le publicateur HTTP ne changent : on enveloppe l'un pour l'autre. */
export class PublicateurAvecReessai implements PublicateurSignalements {
  #interne: PublicateurSignalements;
  #essais: number;
  #pauseMs: number;
  #attendre: (ms: number) => Promise<void>;

  constructor(interne: PublicateurSignalements, essais = 3, pauseMs = 500,
    attendre = dormir) {                    // attendre : remplacable dans les tests
    this.#interne = interne;
    this.#essais = essais;
    this.#pauseMs = pauseMs;
    this.#attendre = attendre;
  }

  async publier(s: Signalement) {
    for (let essai = 1; ; essai += 1) {
      try {
        return await this.#interne.publier(s);
      } catch (erreur) {                    // reseau coupe, delai depasse, refus
        if (essai >= this.#essais) throw erreur;   // on n'avale pas l'erreur
        await this.#attendre(this.#pauseMs * essai); // 500 ms, puis 1000 ms...
      }
    }
  }
}
