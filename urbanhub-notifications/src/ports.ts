// Les ports du service Notifications : les contrats que l'application ecrit, dans son vocabulaire.
// Aucun mot technique ici : ni SQL, ni HTTP, ni Kafka.
import type { Incident, Notification } from "./domaine.ts";

export type { Incident, Notification };

/** Ce que le cas d'utilisation a fait d'un incident : l'adaptateur peut le journaliser. */
export type Issue = "notifie" | "doublon";

/** Port PRIMAIRE : ce que le service offre. Un adaptateur d'entree (HTTP, Kafka...) l'appelle. */
export interface RecevoirIncident {
  executer(incident: Incident): Promise<Issue>;
}

/** Port SECONDAIRE : prevenir les operateurs (journal, courriel, SMS...). */
export interface Operateurs {
  prevenir(notification: Notification): Promise<void>;
}

/** Port SECONDAIRE : l'historique des incidents deja notifies. */
export interface Historique {
  /**
   * Garde l'incident, en UNE operation indivisible : true s'il est nouveau,
   * false si son identifiant etait deja la (rien n'est alors ajoute).
   */
  enregistrer(incident: Incident): boolean;
  /** Retire un incident : pour annuler un enregistrement quand les operateurs n'ont pas ete prevenus. */
  retirer(identifiant: string): void;
  /** Les incidents, dans l'ordre ou ils ont ete enregistres. */
  tous(): Incident[];
}
