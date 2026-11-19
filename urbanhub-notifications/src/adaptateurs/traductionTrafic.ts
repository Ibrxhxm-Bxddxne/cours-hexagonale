import { IncidentInvalide, incident } from "../domaine.ts";
import type { Incident } from "../ports.ts";

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
