// Les ports du service Trafic : les contrats que l'application ecrit, dans son vocabulaire.
// Aucun mot technique ici : ni SQL, ni HTTP, ni Kafka.
import type { EtatTroncon, Releve, Signalement, Troncon } from "./domaine.ts";

export type { EtatTroncon, Releve, Signalement, Troncon };

/** Port PRIMAIRE : ce que le service offre. Un adaptateur d'entree (HTTP...) l'appelle. */
export interface RecevoirReleve {
  executer(releve: Releve): Promise<void>;
}

/** Port SECONDAIRE : ranger les releves et relire ceux d'une fenetre de temps. */
export interface DepotReleves {
  enregistrer(releve: Releve): void;
  /** Les releves du troncon dont l'horodatage est entre debut et fin, bornes incluses. */
  entre(troncon: string, debut: string, fin: string): Releve[];
}

/** Port SECONDAIRE : la liste des troncons de la ville et leur vitesse limite. */
export interface ReferentielTroncons {
  /** undefined si le troncon n'existe pas. */
  trouver(identifiant: string): Troncon | undefined;
}

/** Port SECONDAIRE : l'etat de chaque troncon, pour ne signaler qu'une fois par episode. */
export interface EtatsTroncons {
  /** "fluide" pour un troncon jamais vu. */
  etat(troncon: string): EtatTroncon;
  changer(troncon: string, etat: EtatTroncon): void;
}

/** Port SECONDAIRE : prevenir le reste d'UrbanHub qu'un troncon est congestionne. */
export interface PublicateurSignalements {
  publier(signalement: Signalement): Promise<void>;
}
