import type { IncomingMessage, ServerResponse } from "node:http";
import { IncidentInvalide } from "../domaine.ts";
import type { RecevoirIncident } from "../ports.ts";
import { incidentDepuisSignalement } from "./traductionTrafic.ts";

export { incidentDepuisSignalement };   // la traduction est partagee avec l'entree Kafka (etape 5)

const lireCorps = async (requete: IncomingMessage) => {
  let corps = "";
  for await (const morceau of requete) corps += morceau;
  return corps;
};

/** Adaptateur PRIMAIRE : traduit POST /signalements en appel du port RecevoirIncident. */
export function gestionnaire(cas: RecevoirIncident, journal: (ligne: string) => void = console.log) {
  return async (requete: IncomingMessage, reponse: ServerResponse) => {
    if (requete.method !== "POST" || requete.url !== "/signalements") {
      reponse.writeHead(404).end();
      return;
    }
    try {
      const recu = incidentDepuisSignalement(JSON.parse(await lireCorps(requete)));
      journal(`recu ${recu.identifiant}`);
      const issue = await cas.executer(recu);
      if (issue === "doublon") journal(`doublon ignore ${recu.identifiant}`);
      // 202 dans les DEUX cas : pour l'emetteur, le message est pris en compte ; un doublon
      // qui recevrait une erreur serait renvoye encore, pour rien
      reponse.writeHead(202).end();
    } catch (erreur) {
      // une donnee fausse ne s'arrangera pas en la renvoyant : 422 ; le reste : 500, a retenter
      const invalide = erreur instanceof IncidentInvalide || erreur instanceof SyntaxError;
      if (!invalide) console.error(erreur);           // on n'avale rien : on journalise
      reponse.writeHead(invalide ? 422 : 500).end(invalide ? (erreur as Error).message : "");
    }
  };
}
