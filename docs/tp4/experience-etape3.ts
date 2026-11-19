// TP4, etape 3 : ce que change le coupe-circuit face a un Notifications FIGE (il ne repond jamais).
// Lancer : node --no-warnings docs/tp4/experience-etape3.ts
// Le vrai cas d'utilisation de Trafic, le vrai publicateur HTTP, un vrai serveur fige en local.
// Temps reduits au 1/10 pour que l'essai dure quelques secondes : delai 200 ms (2 s en production),
// pauses 50 puis 100 ms (500 puis 1000 ms). Seuil (5 echecs) et ordre des Decorateurs : ceux de principal.ts.
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
const R = new URL("../../urbanhub-trafic/src/", import.meta.url).href;
const { SurveillanceTrafic } = await import(R + "service.ts");
const { DepotRelevesEnMemoire } = await import(R + "adaptateurs/depotMemoire.ts");
const { EtatsTronconsEnMemoire } = await import(R + "adaptateurs/etatsMemoire.ts");
const { ReferentielTronconsEnMemoire } = await import(R + "adaptateurs/referentielMemoire.ts");
const { PublicateurSignalementsHttp } = await import(R + "adaptateurs/publicationHttp.ts");
const { PublicateurAvecReessai } = await import(R + "adaptateurs/reessai.ts");
const { PublicateurAvecCoupeCircuit } = await import(R + "adaptateurs/coupeCircuit.ts");
const { SeuilRelatif } = await import(R + "regles.ts");
const { releve } = await import(R + "domaine.ts");

let requetesRecues = 0;
const fige = createServer(() => { requetesRecues += 1; /* ne repond jamais */ });
await new Promise<void>((ok) => fige.listen(0, ok));
const url = `http://localhost:${(fige.address() as AddressInfo).port}/signalements`;

async function jouer(nom: string, avecCoupeCircuit: boolean) {
  requetesRecues = 0;
  const http = new PublicateurSignalementsHttp(url, 200);
  const interne = avecCoupeCircuit ? new PublicateurAvecCoupeCircuit(http, 5, 30_000) : http;
  const trafic = new SurveillanceTrafic(new DepotRelevesEnMemoire(),
    new ReferentielTronconsEnMemoire([{ identifiant: "rue-de-rivoli-1", vitesseLimite: 30 }]),
    new EtatsTronconsEnMemoire(), new PublicateurAvecReessai(interne, 3, 50), new SeuilRelatif(0.4));
  const durees: number[] = [];
  for (let i = 0; i < 10; i++) {
    const t = performance.now();
    await trafic.executer(releve({ troncon: "rue-de-rivoli-1", vitesse: 9,
      horodatage: `2026-11-19T08:${String(i).padStart(2, "0")}:00` })).catch(() => {});
    durees.push(Math.round(performance.now() - t));
  }
  const total = durees.reduce((a, b) => a + b, 0);
  console.log(`${nom} : 10 releves en ${total} ms ; requetes recues par Notifications : ${requetesRecues}`);
  console.log(`   duree de chaque releve (ms) : ${durees.join(" ")}`);
}

await jouer("reessai seul              ", false);
await jouer("reessai + coupe-circuit   ", true);
fige.closeAllConnections();
fige.close();
