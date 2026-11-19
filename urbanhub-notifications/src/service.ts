import { notification } from "./domaine.ts";
import type { Historique, Incident, Issue, Operateurs, RecevoirIncident } from "./ports.ts";

/**
 * Le cas d'utilisation : il implemente le port primaire RecevoirIncident.
 * Il est IDEMPOTENT (TP 4, etape 4) : un incident recu deux fois ne previent qu'une fois.
 * La cle est l'identifiant fourni par la source, tire de la mesure : pour Trafic, troncon:debut.
 */
export class ReceptionIncidents implements RecevoirIncident {
  // des PORTS, jamais une base ou un reseau
  #operateurs: Operateurs;
  #historique: Historique;

  constructor(operateurs: Operateurs, historique: Historique) {
    this.#operateurs = operateurs;
    this.#historique = historique;
  }

  async executer(incident: Incident): Promise<Issue> {
    // 1. RESERVER l'identifiant d'abord, en une operation indivisible : deux envois du meme
    //    incident, meme simultanes, ne peuvent pas passer tous les deux
    if (!this.#historique.enregistrer(incident)) return "doublon";
    try {
      await this.#operateurs.prevenir(notification(incident));
    } catch (erreur) {
      // 2. operateurs injoignables : on rend la reservation, pour qu'un nouvel envoi
      //    de la source (son reessai) puisse reussir
      this.#historique.retirer(incident.identifiant);
      throw erreur;
    }
    return "notifie";
  }
}
