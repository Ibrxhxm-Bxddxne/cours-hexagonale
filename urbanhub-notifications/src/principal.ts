import { createServer } from "node:http";
import { gestionnaire } from "./adaptateurs/entreeHttp.ts";
import { HistoriqueSqlite } from "./adaptateurs/historiqueSqlite.ts";
import { OperateursParJournal } from "./adaptateurs/operateursJournal.ts";
import { ReceptionIncidents } from "./service.ts";

// La racine de composition du service Notifications : le SEUL fichier qui cree et branche.
// Les tests ne l'importent pas : ils assemblent leurs propres adaptateurs.
const env = process.env;

const historique = new HistoriqueSqlite(env.BASE_NOTIFICATIONS ?? "notifications.db");  // SA base
const operateurs = new OperateursParJournal();
const service = new ReceptionIncidents(operateurs, historique);

// 8004 : l'adresse que Trafic vise deja par defaut (URL_SIGNALEMENTS)
createServer(gestionnaire(service)).listen(Number(env.PORT ?? 8004));
