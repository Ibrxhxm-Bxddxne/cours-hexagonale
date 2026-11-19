// Les ports du service Notifications : les contrats que l'application ecrit, dans son vocabulaire.
// Aucun mot technique ici : ni SQL, ni HTTP, ni Kafka.
import type { Incident, Notification } from "./domaine.ts";

export type { Incident, Notification };

/** Port PRIMAIRE : ce que le service offre. Un adaptateur d'entree (HTTP, Kafka...) l'appelle. */
export interface RecevoirIncident {
  executer(incident: Incident): Promise<void>;
}

/** Port SECONDAIRE : prevenir les operateurs (journal, courriel, SMS...). */
export interface Operateurs {
  prevenir(notification: Notification): Promise<void>;
}

/** Port SECONDAIRE : l'historique des incidents deja notifies. */
export interface Historique {
  /** Garde l'incident ; un identifiant deja present n'ajoute rien. */
  enregistrer(incident: Incident): void;
  /** Les incidents, dans l'ordre ou ils ont ete enregistres. */
  tous(): Incident[];
}
