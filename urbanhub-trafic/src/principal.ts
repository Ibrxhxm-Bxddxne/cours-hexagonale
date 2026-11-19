import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { DepotRelevesSqlite } from "./adaptateurs/depotSqlite.ts";
import { gestionnaire } from "./adaptateurs/entreeHttp.ts";
import { EtatsTronconsSqlite } from "./adaptateurs/etatsSqlite.ts";
import { PublicateurAvecCoupeCircuit } from "./adaptateurs/coupeCircuit.ts";
import { PublicateurSignalementsHttp } from "./adaptateurs/publicationHttp.ts";
import { ReferentielTronconsEnMemoire } from "./adaptateurs/referentielMemoire.ts";
import { PublicateurAvecReessai } from "./adaptateurs/reessai.ts";
import { SeuilRelatif, SeuilRelatifAvecMinimum } from "./regles.ts";
import { SurveillanceTrafic } from "./service.ts";

// La racine de composition : le SEUL fichier qui cree les objets et les branche.
// Les tests ne l'importent pas : ils assemblent leurs propres adaptateurs.
const env = process.env;

const troncons = JSON.parse(readFileSync(
  env.TRONCONS ?? new URL("../troncons.json", import.meta.url), "utf8"));

const base = env.BASE_RELEVES ?? "releves.db";
const depot = new DepotRelevesSqlite(base);
const referentiel = new ReferentielTronconsEnMemoire(troncons);
const etats = new EtatsTronconsSqlite(base);          // etape 6 : remplace EtatsTronconsEnMemoire
// Deux Decorateurs empiles autour du publicateur HTTP (TP 4, etape 3) :
// le reessai a l'exterieur, le coupe-circuit a l'interieur (cours, slide 83).
const publicateur = new PublicateurAvecReessai(                       // 3 essais, pauses 0,5 s puis 1 s
  new PublicateurAvecCoupeCircuit(                                    // 5 echecs -> ouvert 30 s
    new PublicateurSignalementsHttp(env.URL_SIGNALEMENTS ?? "http://localhost:8004/signalements"),
    5, 30_000));
const regle = env.REGLE === "avec-minimum"                            // Strategie
  ? new SeuilRelatifAvecMinimum(3, 0.4)
  : new SeuilRelatif(0.4);

const service = new SurveillanceTrafic(depot, referentiel, etats, publicateur, regle);

createServer(gestionnaire(service)).listen(Number(env.PORT ?? 8003));
