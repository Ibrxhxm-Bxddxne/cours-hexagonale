import { IncidentInvalide } from "../domaine.ts";
import type { Issue, RecevoirIncident } from "../ports.ts";
import { incidentDepuisSignalement } from "./traductionTrafic.ts";

/** Un message lu dans le topic : ce que kafkajs donne a eachMessage, reduit a ce qui sert. */
export type MessageLu = { partition: number;
  message: { key: Buffer | null; value: Buffer | null; offset: string } };

/** Le morceau du consommateur kafkajs dont on a besoin. */
export interface Consommateur {
  subscribe(options: { topic: string; fromBeginning: boolean }): Promise<void>;
  run(options: { eachMessage: (lu: MessageLu) => Promise<void> }): Promise<void>;
}

/**
 * Adaptateur PRIMAIRE : un message du topic « signalements » devient un appel du port
 * RecevoirIncident. MEME cas d'utilisation, MEME traduction que l'entree HTTP.
 */
export async function traiterMessage(cas: RecevoirIncident, lu: MessageLu,
  journal: (ligne: string) => void = console.log): Promise<Issue | "ignore"> {
  const ou = `partition ${lu.partition} offset ${lu.message.offset}`;
  let incident;
  try {
    incident = incidentDepuisSignalement(JSON.parse(lu.message.value?.toString() ?? ""));
  } catch (erreur) {
    // un message ILLISIBLE ne deviendra jamais lisible : on le journalise et on passe au suivant.
    // Lever ici bloquerait toute la partition sur ce message, pour toujours.
    if (!(erreur instanceof IncidentInvalide || erreur instanceof SyntaxError)) throw erreur;
    journal(`message ignore (${ou}) : ${(erreur as Error).message}`);
    return "ignore";
  }
  journal(`recu ${incident.identifiant} (${ou})`);
  // les operateurs injoignables font LEVER : kafkajs ne valide pas l'offset et relira ce message.
  // La relecture est sans risque : le cas d'utilisation est idempotent (etape 4).
  const issue = await cas.executer(incident);
  if (issue === "doublon") journal(`doublon ignore ${incident.identifiant} (${ou})`);
  return issue;
}

/** S'abonne au topic et branche chaque message sur le cas d'utilisation. */
export async function consommer(consommateur: Consommateur, cas: RecevoirIncident,
  topic = "signalements", journal: (ligne: string) => void = console.log) {
  await consommateur.subscribe({ topic, fromBeginning: true });  // un groupe NEUF lit tout le topic
  await consommateur.run({ eachMessage: async (lu) => { await traiterMessage(cas, lu, journal); } });
}
