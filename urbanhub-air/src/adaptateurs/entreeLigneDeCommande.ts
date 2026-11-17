// TP1, experience 3 : une entree de plus. La ligne de commande pilote le MEME cas d'utilisation.
// Inspire de entreeCsv.ts : on traduit les arguments en Mesure, puis cas.executer(...).
import { MesureInvalide, mesure } from "../domaine.ts";
import type { EnregistrerMesure } from "../ports.ts";

/** args = [capteur, polluant, valeur, horodatage] ; rend un code de sortie. */
export async function lancer(args: string[], cas: EnregistrerMesure,
  journal: (texte: string) => void = console.error): Promise<number> {
  const [capteur, polluant, valeur, horodatage] = args;
  try {
    await cas.executer(mesure({ capteur, polluant, valeur: Number(valeur), horodatage }));
    return 0;
  } catch (erreur) {
    if (!(erreur instanceof MesureInvalide)) throw erreur;  // on n'avale rien
    journal(`usage : capteur polluant valeur horodatage (${erreur.message})`);
    return 2;                                                 // l'equivalent du 422 de HTTP
  }
}
