import { TronconInconnu, debutFenetre, signalement, vitesseMoyenne } from "./domaine.ts";
import type { DepotReleves, EtatsTroncons, PublicateurSignalements, RecevoirReleve,
  ReferentielTroncons, Releve } from "./ports.ts";
import type { RegleCongestion } from "./regles.ts";

/** Le cas d'utilisation : il implemente le port primaire RecevoirReleve. */
export class SurveillanceTrafic implements RecevoirReleve {
  // des PORTS et une STRATEGIE, jamais une base ou un reseau
  #depot: DepotReleves;
  #referentiel: ReferentielTroncons;
  #etats: EtatsTroncons;
  #publicateur: PublicateurSignalements;
  #regle: RegleCongestion;

  constructor(depot: DepotReleves, referentiel: ReferentielTroncons,
    etats: EtatsTroncons, publicateur: PublicateurSignalements, regle: RegleCongestion) {
    this.#depot = depot;
    this.#referentiel = referentiel;
    this.#etats = etats;
    this.#publicateur = publicateur;
    this.#regle = regle;
  }

  async executer(releve: Releve) {
    const troncon = this.#referentiel.trouver(releve.troncon);
    if (!troncon) throw new TronconInconnu(`troncon inconnu : ${releve.troncon}`);

    this.#depot.enregistrer(releve);
    const fenetre = this.#depot.entre(releve.troncon,
      debutFenetre(releve.horodatage), releve.horodatage);
    const nouvel = this.#regle.etat(fenetre, troncon);
    // pas de conclusion, ou rien n'a change : on ne fait rien
    if (!nouvel || nouvel === this.#etats.etat(releve.troncon)) return;

    if (nouvel === "congestionne") {
      await this.#publicateur.publier(signalement({ troncon: troncon.identifiant,
        vitesseMoyenne: vitesseMoyenne(fenetre), vitesseLimite: troncon.vitesseLimite,
        debut: releve.horodatage }));
    }
    // l'etat change APRES la publication : si elle echoue, le prochain releve retentera
    this.#etats.changer(releve.troncon, nouvel);
  }
}
