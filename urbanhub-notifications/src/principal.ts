import { createServer } from "node:http";
import kafkajs from "kafkajs";
import { gestionnaire } from "./adaptateurs/entreeHttp.ts";
import { consommer } from "./adaptateurs/entreeKafka.ts";
import { HistoriqueSqlite } from "./adaptateurs/historiqueSqlite.ts";
import { OperateursParJournal } from "./adaptateurs/operateursJournal.ts";
import { ReceptionIncidents } from "./service.ts";

// La racine de composition du service Notifications : le SEUL fichier qui cree et branche.
// Les tests ne l'importent pas : ils assemblent leurs propres adaptateurs.
const env = process.env;

const historique = new HistoriqueSqlite(env.BASE_NOTIFICATIONS ?? "notifications.db");  // SA base
const operateurs = new OperateursParJournal();
const service = new ReceptionIncidents(operateurs, historique);

// Entree 1, HTTP : l'adresse que Trafic vise par defaut (URL_SIGNALEMENTS)
createServer(gestionnaire(service)).listen(Number(env.PORT ?? 8004));

// Entree 2, Kafka (TP 4, etape 5) : le MEME cas d'utilisation, dans le groupe « notifications »
if (env.KAFKA_BROKERS) {
  const kafka = new kafkajs.Kafka({ clientId: "notifications",
    brokers: env.KAFKA_BROKERS.split(","), logLevel: kafkajs.logLevel.WARN });
  const consommateur = kafka.consumer({ groupId: env.KAFKA_GROUPE ?? "notifications" });
  await consommateur.connect();
  // ARRET PROPRE (TP 4, etape 6) : a l'arret du conteneur (SIGTERM), on QUITTE le groupe.
  // Sans cela, Kafka croit le consommateur vivant jusqu'a la fin de sa session (environ 30 s) :
  // le groupe reste « Stable », et on ne peut ni rejouer ses offsets ni reaffecter ses partitions.
  const arreter = async () => { await consommateur.disconnect(); process.exit(0); };
  process.once("SIGTERM", arreter);
  process.once("SIGINT", arreter);
  await consommer(consommateur, service);
}
