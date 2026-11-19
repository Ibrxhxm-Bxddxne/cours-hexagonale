import { notification } from "./domaine.ts";
import type { Historique, Incident, Operateurs, RecevoirIncident } from "./ports.ts";

/** Le cas d'utilisation : il implemente le port primaire RecevoirIncident. */
export class ReceptionIncidents implements RecevoirIncident {
  // des PORTS, jamais une base ou un reseau
  #operateurs: Operateurs;
  #historique: Historique;

  constructor(operateurs: Operateurs, historique: Historique) {
    this.#operateurs = operateurs;
    this.#historique = historique;
  }

  async executer(incident: Incident) {
    await this.#operateurs.prevenir(notification(incident));
    // historise APRES avoir prevenu : si les operateurs ne sont pas joignables,
    // l'incident n'est pas marque comme traite, et un nouvel envoi le retentera
    this.#historique.enregistrer(incident);
  }
}
