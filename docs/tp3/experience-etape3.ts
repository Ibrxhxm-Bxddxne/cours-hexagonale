// TP3, etape 3 : les mesures qui remplissent le tableau du 3.2. Lancer : node docs/tp3/experience-etape3.ts
// Ports locaux utilises : 18002, 18009, 18010. Aucune base du depot n est touchee (dossier temporaire).
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const R = new URL("../../", import.meta.url).href;
const { ReceptionAlertes } = await import(R + "urbanhub-alertes/src/service.ts");
const { gestionnaire } = await import(R + "urbanhub-alertes/src/entreeHttp.ts");
const { SurveillanceQualiteAir } = await import(R + "urbanhub-air/src/service.ts");
const { DepotMesuresSqlite } = await import(R + "urbanhub-air/src/adaptateurs/depotSqlite.ts");
const { PublicateurAlertesHttp } = await import(R + "urbanhub-air/src/adaptateurs/publicationHttp.ts");
const { PublicateurAvecReessai } = await import(R + "urbanhub-air/src/adaptateurs/reessai.ts");
const { SeuilMoyenneJournaliere } = await import(R + "urbanhub-air/src/regles.ts");
const { mesure } = await import(R + "urbanhub-air/src/domaine.ts");

const N = 1000;
let prevenus = 0;
const ops = { prevenir: () => { prevenus++; } };
// 1. appel de fonction (monolithe)
const rec = new ReceptionAlertes(ops);
let t = performance.now();
for (let i = 0; i < N; i++) rec.recevoir({ identifiant: `a${i}`, moyenne: 60 });
const fn = (performance.now() - t) / N;
// 2. appel HTTP (microservices)
const serveur = createServer(gestionnaire(new ReceptionAlertes(ops), () => {})).listen(18002);
await new Promise((ok) => serveur.on("listening", ok));
const pub = new PublicateurAlertesHttp("http://localhost:18002/alertes");
t = performance.now();
for (let i = 0; i < N; i++) await pub.publier({ identifiant: `b${i}`, moyenne: 60 } as any);
const ht = (performance.now() - t) / N;
console.log(`appel de fonction : ${(fn * 1000).toFixed(1)} µs ; appel HTTP local : ${(ht * 1000).toFixed(0)} µs ; rapport x${Math.round(ht / fn)}`);
serveur.close();

// 3. panne d'Alertes (arrêté) : service Air avec réessai
const base = join(mkdtempSync(join(tmpdir(), "tp3-")), "m.db");
const air = new SurveillanceQualiteAir(new DepotMesuresSqlite(base),
  new PublicateurAvecReessai(new PublicateurAlertesHttp("http://localhost:18009/alertes")),
  new SeuilMoyenneJournaliere("PM10", 50));
t = performance.now();
let issue = "ok";
try { await air.executer(mesure({ capteur: "capteur-12", polluant: "PM10", valeur: 80, horodatage: "2026-11-18T08:00:00" })); }
catch (e) { issue = "erreur (le capteur recoit 500) : " + (e as Error).message; }
console.log(`Alertes arrete : ${Math.round(performance.now() - t)} ms, ${issue}`);
const { DatabaseSync } = await import("node:sqlite");
console.log("mesures en base malgre la panne :", (new DatabaseSync(base).prepare("SELECT count(*) n FROM mesure").get() as any).n);

// 4. Alertes revient : la mesure suivante relance l'alerte, une seule fois
let prev2 = 0;
const s2 = createServer(gestionnaire(new ReceptionAlertes({ prevenir: () => { prev2++; } }), () => {})).listen(18009);
await new Promise((ok) => s2.on("listening", ok));
await air.executer(mesure({ capteur: "capteur-12", polluant: "PM10", valeur: 70, horodatage: "2026-11-18T09:00:00" }));
await air.executer(mesure({ capteur: "capteur-12", polluant: "PM10", valeur: 70, horodatage: "2026-11-18T10:00:00" }));
console.log(`Alertes revenu, 2 mesures de plus : operateurs prevenus ${prev2} fois`);
s2.close();

// 5. Alertes lent (ne repond jamais)
const lent = createServer(() => {}).listen(18010);
await new Promise((ok) => lent.on("listening", ok));
const air2 = new SurveillanceQualiteAir(new DepotMesuresSqlite(":memory:"),
  new PublicateurAvecReessai(new PublicateurAlertesHttp("http://localhost:18010/alertes")),
  new SeuilMoyenneJournaliere("PM10", 50));
t = performance.now();
try { await air2.executer(mesure({ capteur: "capteur-7", polluant: "PM10", valeur: 80, horodatage: "2026-11-18T08:00:00" })); } catch {}
console.log(`Alertes fige : la requete du capteur attend ${Math.round(performance.now() - t)} ms`);
lent.closeAllConnections(); lent.close();
