// Le domaine du service Trafic : des donnees et un vocabulaire, aucun import technique.
// Regle : un troncon est congestionne quand la vitesse moyenne de ses releves sur les
// 15 dernieres minutes tombe sous 40 % de sa vitesse limite ; on le signale une seule fois.

/** Horodatage local du capteur, a la seconde, sans fuseau : "2026-11-18T08:10:00". */
const HORODATAGE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
export const FENETRE_MINUTES = 15;
export const PART_DE_LA_LIMITE = 0.4;

export class ReleveInvalide extends Error {}
export class TronconInconnu extends Error {}

/** Une mesure d'un capteur : la vitesse des vehicules sur un troncon, en km/h. */
export type Releve = Readonly<{ troncon: string; vitesse: number; horodatage: string }>;

/** Une portion de route et sa vitesse limite, en km/h. */
export type Troncon = Readonly<{ identifiant: string; vitesseLimite: number }>;

/** L'etat d'un troncon : il ne change que quand la regle le dit. */
export type EtatTroncon = "fluide" | "congestionne";

/** Le message envoye quand un troncon passe de fluide a congestionne. */
export type Signalement = Readonly<{ troncon: string; vitesseMoyenne: number;
  vitesseLimite: number; debut: string; identifiant: string }>;

export function releve(r: Releve): Releve {
  const valide = r.troncon && Number.isFinite(r.vitesse) && r.vitesse >= 0
    && HORODATAGE.test(r.horodatage);
  if (!valide) {
    throw new ReleveInvalide(
      "troncon, vitesse positive et horodatage AAAA-MM-JJTHH:MM:SS requis");
  }
  return Object.freeze({ ...r });
}

export function troncon(t: Troncon): Troncon {
  if (!t.identifiant || !(t.vitesseLimite > 0)) {
    throw new TronconInconnu(`troncon ${t.identifiant} sans vitesse limite valable`);
  }
  return Object.freeze({ ...t });
}

/** L'identifiant voyage avec le message : un consommateur peut ignorer un doublon. */
export function signalement(s: Omit<Signalement, "identifiant">): Signalement {
  return Object.freeze({ ...s, identifiant: `${s.troncon}:${s.debut}` });
}

/** "2026-11-18T08:10:00" -> "2026-11-18T07:55:00" : la borne basse, incluse. */
export function debutFenetre(horodatage: string): string {
  // calcul sur l'horloge UTC pour ne pas dependre du fuseau de la machine
  const fin = Date.parse(`${horodatage}Z`);
  return new Date(fin - FENETRE_MINUTES * 60_000).toISOString().slice(0, 19);
}

export function vitesseMoyenne(releves: Releve[]): number {
  return releves.reduce((somme, r) => somme + r.vitesse, 0) / releves.length;
}

/** La regle : sous 40 % de la limite, le troncon est congestionne. */
export function etatSelon(moyenne: number, t: Troncon): EtatTroncon {
  return moyenne < PART_DE_LA_LIMITE * t.vitesseLimite ? "congestionne" : "fluide";
}
