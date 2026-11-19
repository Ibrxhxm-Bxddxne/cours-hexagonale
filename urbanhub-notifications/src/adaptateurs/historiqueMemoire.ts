import type { Historique, Incident } from "../ports.ts";

/** Adaptateur du port Historique, pour les tests et le prototype. */
export class HistoriqueEnMemoire implements Historique {
  #incidents = new Map<string, Incident>();   // une Map garde l'ordre d'insertion

  enregistrer(incident: Incident) {
    if (this.#incidents.has(incident.identifiant)) return false;
    this.#incidents.set(incident.identifiant, incident);
    return true;
  }

  retirer(identifiant: string) {
    this.#incidents.delete(identifiant);
  }

  tous() {
    return [...this.#incidents.values()];
  }
}
