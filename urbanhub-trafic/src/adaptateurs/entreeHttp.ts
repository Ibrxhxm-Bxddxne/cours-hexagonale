import type { IncomingMessage, ServerResponse } from "node:http";
import { ReleveInvalide, TronconInconnu, releve } from "../domaine.ts";
import type { RecevoirReleve } from "../ports.ts";

const lireCorps = async (requete: IncomingMessage) => {
  let corps = "";
  for await (const morceau of requete) corps += morceau;
  return corps;
};

/** Adaptateur PRIMAIRE : traduit POST /releves en appel du port RecevoirReleve. */
export function gestionnaire(cas: RecevoirReleve) {
  return async (requete: IncomingMessage, reponse: ServerResponse) => {
    if (requete.method !== "POST" || requete.url !== "/releves") {
      reponse.writeHead(404).end();
      return;
    }
    try {
      await cas.executer(releve(JSON.parse(await lireCorps(requete))));
      reponse.writeHead(202).end();
    } catch (erreur) {
      // jamais d'exception hors du gestionnaire : une requete ne doit pas arreter le service
      const statut = erreur instanceof TronconInconnu ? 404
        : erreur instanceof ReleveInvalide || erreur instanceof SyntaxError ? 422 : 500;
      if (statut === 500) console.error(erreur);    // on n'avale rien : on journalise
      reponse.writeHead(statut).end(statut === 500 ? "" : (erreur as Error).message);
    }
  };
}
