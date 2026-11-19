import type { PublicateurSignalements, Signalement } from "../ports.ts";
import { CircuitOuvert, RefusDefinitif } from "./erreurs.ts";

export type EtatCircuit = "ferme" | "ouvert" | "semi-ouvert";

/**
 * Patron DECORATEUR : le coupe-circuit (M. Nygard, Release It!, 2007).
 * - FERME : les appels passent ; il compte les echecs D'AFFILEE ; au seuil (5), il s'ouvre.
 * - OUVERT : pendant la duree (30 s), tout appel echoue AUSSITOT, sans toucher le reseau.
 * - SEMI-OUVERT : la duree passee, UN seul appel d'essai passe. Reussi : il se referme.
 *   Rate : il se rouvre pour une nouvelle duree. Pendant l'essai, les autres sont refuses.
 */
export class PublicateurAvecCoupeCircuit implements PublicateurSignalements {
  #interne: PublicateurSignalements;
  #seuil: number;
  #dureeMs: number;
  #maintenant: () => number;
  #echecs = 0;
  #ouvertA: number | undefined;     // instant d'ouverture ; undefined : ferme
  #essaiEnCours = false;

  constructor(interne: PublicateurSignalements, seuil = 5, dureeMs = 30_000,
    maintenant = Date.now) {                // maintenant : une horloge remplacable dans les tests
    this.#interne = interne;
    this.#seuil = seuil;
    this.#dureeMs = dureeMs;
    this.#maintenant = maintenant;
  }

  /** L'etat courant : pour les tests, et pour la supervision. */
  get etat(): EtatCircuit {
    if (this.#ouvertA === undefined) return "ferme";
    return this.#maintenant() - this.#ouvertA < this.#dureeMs ? "ouvert" : "semi-ouvert";
  }

  async publier(s: Signalement) {
    const etat = this.etat;
    if (etat === "ouvert" || (etat === "semi-ouvert" && this.#essaiEnCours)) {
      throw new CircuitOuvert();            // aucun appel reseau
    }
    const essai = etat === "semi-ouvert";
    if (essai) this.#essaiEnCours = true;
    try {
      await this.#interne.publier(s);
      this.#echecs = 0;                     // un succes referme et remet le compte a zero
      this.#ouvertA = undefined;
    } catch (erreur) {
      // un refus 4xx prouve que le destinataire REPOND : ce n'est pas une panne, on ne compte pas
      if (!(erreur instanceof RefusDefinitif)) {
        this.#echecs += 1;
        if (essai || this.#echecs >= this.#seuil) this.#ouvertA = this.#maintenant();
      }
      throw erreur;                         // on n'avale jamais l'erreur
    } finally {
      if (essai) this.#essaiEnCours = false;
    }
  }
}
