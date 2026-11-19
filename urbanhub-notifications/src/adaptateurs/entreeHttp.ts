import type { IncomingMessage, ServerResponse } from "node:http";
import { IncidentInvalide, incident } from "../domaine.ts";
import type { Incident, RecevoirIncident } from "../ports.ts";

const lireCorps = async (requete: IncomingMessage) => {
  let corps = "";
  for await (const morceau of requete) corps += morceau;
  return corps;
};

/**
 * La TRADUCTION a la frontiere du contexte : un signalement du service Trafic devient un Incident.
 * Le vocabulaire du trafic (troncon, vitesses) s'arrete ici ; le centre ne le voit jamais.
 */
export function incidentDepuisSignalement(s: Record<string, unknown>): Incident {
  const { identifiant, troncon, vitesseMoyenne, vitesseLimite, debut } = s;
  if (typeof vitesseMoyenne !== "number" || !Number.isFinite(vitesseMoyenne)
    || typeof vitesseLimite !== "number" || !Number.isFinite(vitesseLimite)) {
    throw new IncidentInvalide("signalement de trafic sans vitesseMoyenne ni vitesseLimite");
  }
  return incident({ identifiant: identifiant as string, source: "trafic", lieu: troncon as string,
    resume: `circulation a ${Math.round(vitesseMoyenne)} km/h pour ${vitesseLimite} km/h autorises`,
    survenu: debut as string });
}

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
