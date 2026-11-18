// Patron STRATEGIE : la facon de decider « congestionne » est un objet interchangeable.
// Le cas d'utilisation recoit une RegleCongestion ; il ne sait pas laquelle.
import { vitesseMoyenne } from "./domaine.ts";
import type { EtatTroncon, Releve, Troncon } from "./ports.ts";

export interface RegleCongestion {
  /** L'etat du troncon d'apres les releves de la fenetre ;
   *  undefined : pas assez d'informations pour conclure, l'etat ne change pas. */
  etat(fenetre: Releve[], troncon: Troncon): EtatTroncon | undefined;
}

/** La regle du README : sous 40 % de la vitesse limite, le troncon est congestionne. */
export class SeuilRelatif implements RegleCongestion {
  readonly part: number;
  constructor(part = 0.4) {
    this.part = part;
  }
  etat(fenetre: Releve[], troncon: Troncon): EtatTroncon {
    return vitesseMoyenne(fenetre) < this.part * troncon.vitesseLimite ? "congestionne" : "fluide";
  }
}

/** La meme regle, mais seulement avec assez de releves : la nuit, un seul vehicule lent
 *  (un bus a l'arret, une livraison) ne suffit pas a declarer un bouchon. */
export class SeuilRelatifAvecMinimum implements RegleCongestion {
  readonly minimum: number;
  #seuil: SeuilRelatif;
  constructor(minimum = 3, part = 0.4) {
    this.minimum = minimum;
    this.#seuil = new SeuilRelatif(part);
  }
  etat(fenetre: Releve[], troncon: Troncon) {
    return fenetre.length < this.minimum ? undefined : this.#seuil.etat(fenetre, troncon);
  }
}
