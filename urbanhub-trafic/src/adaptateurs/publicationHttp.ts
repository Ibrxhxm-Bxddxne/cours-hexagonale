import type { PublicateurSignalements, Signalement } from "../ports.ts";
import { RefusDefinitif } from "./erreurs.ts";

/** Adaptateur SECONDAIRE : envoie le signalement en JSON a un service d'UrbanHub. */
export class PublicateurSignalementsHttp implements PublicateurSignalements {
  #url: string;
  #delaiMs: number;

  constructor(url: string, delaiMs = 2000) {
    this.#url = url;
    this.#delaiMs = delaiMs;                // jamais d'appel reseau sans delai
  }

  async publier(s: Signalement) {
    const reponse = await fetch(this.#url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),              // l'identifiant voyage avec le signalement
      signal: AbortSignal.timeout(this.#delaiMs),
    });
    // 4xx : le message lui-meme est refuse, le renvoyer ne sert a rien ; 5xx : panne, a retenter
    if (reponse.status >= 400 && reponse.status < 500) throw new RefusDefinitif(reponse.status);
    if (!reponse.ok) throw new Error(`le destinataire a repondu ${reponse.status}`);
  }
}
