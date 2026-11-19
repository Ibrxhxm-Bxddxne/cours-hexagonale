// Le domaine du service Notifications : des donnees et un vocabulaire, aucun import technique.
// Son contexte : prevenir les operateurs d'un INCIDENT, quelle que soit sa source.
// Il ne connait ni troncon, ni vitesse, ni polluant : chaque source traduit son message
// en Incident dans l'adaptateur d'entree (la frontiere du contexte delimite).

/** Date et heure, au moins a la minute : "2026-11-19T08:10" ou "2026-11-19T08:10:00". */
const HORODATAGE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export class IncidentInvalide extends Error {}

/** Un incident signale par un autre service d'UrbanHub. */
export type Incident = Readonly<{
  identifiant: string;   // fourni par la source : il servira a reconnaitre un doublon
  source: string;        // "trafic", "qualite-air"...
  lieu: string;          // ou se passe l'incident, dans les mots de la source
  resume: string;        // une phrase courte, deja lisible par un operateur
  survenu: string;       // quand l'incident a commence
}>;

/** Ce que recoivent les operateurs : un texte, et l'incident dont il parle. */
export type Notification = Readonly<{ incident: string; texte: string }>;

export function incident(i: Incident): Incident {
  const complet = [i.identifiant, i.source, i.lieu, i.resume]
    .every((champ) => typeof champ === "string" && champ.trim() !== "");
  if (!complet || typeof i.survenu !== "string" || !HORODATAGE.test(i.survenu)) {
    throw new IncidentInvalide(
      "identifiant, source, lieu, resume et survenu (AAAA-MM-JJTHH:MM) requis");
  }
  return Object.freeze({ ...i });
}

/** La regle de redaction : la source, le lieu, le resume et l'heure de debut. */
export function notification(i: Incident): Notification {
  const heure = i.survenu.slice(11, 16);
  return Object.freeze({ incident: i.identifiant,
    texte: `[${i.source}] ${i.lieu} : ${i.resume} (depuis ${heure})` });
}
