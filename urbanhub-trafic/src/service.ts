import { TronconInconnu, debutFenetre, etatSelon, signalement, vitesseMoyenne } from "./domaine.ts";
import type { DepotReleves, EtatsTroncons, PublicateurSignalements, RecevoirReleve,
  ReferentielTroncons, Releve } from "./ports.ts";

/** Le cas d'utilisation : il implemente le port primaire RecevoirReleve. */
export class SurveillanceTrafic implements RecevoirReleve {
  // des PORTS, jamais une base ou un reseau
  #depot: DepotReleves;
  #referentiel: ReferentielTroncons;
  #etats: EtatsTroncons;
  #publicateur: PublicateurSignalements;

  constructor(depot: DepotReleves, referentiel: ReferentielTroncons,
    etats: EtatsTroncons, publicateur: PublicateurSignalements) {
    this.#depot = depot;
    this.#referentiel = referentiel;
    this.#etats = etats;
    this.#publicateur = publicateur;
  }

  async executer(releve: Releve) {
    const troncon = this.#referentiel.trouver(releve.troncon);
    if (!troncon) throw new TronconInconnu(`troncon inconnu : ${releve.troncon}`);

    this.#depot.enregistrer(releve);
    const fenetre = this.#depot.entre(releve.troncon,
      debutFenetre(releve.horodatage), releve.horodatage);
    const moyenne = vitesseMoyenne(fenetre);
    const nouvel = etatSelon(moyenne, troncon);
    if (nouvel === this.#etats.etat(releve.troncon)) return;   // rien n'a change

    if (nouvel === "congestionne") {
      await this.#publicateur.publier(signalement({ troncon: troncon.identifiant,
        vitesseMoyenne: moyenne, vitesseLimite: troncon.vitesseLimite,
        debut: releve.horodatage }));
    }
    // l'etat change APRES la publication : si elle echoue, le prochain releve retentera
    this.#etats.changer(releve.troncon, nouvel);
  }
}
