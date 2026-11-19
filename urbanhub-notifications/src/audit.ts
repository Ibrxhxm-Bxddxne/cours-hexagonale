// Le SECOND groupe de consommateurs du topic « signalements » (TP 4, etape 5) : le groupe « audit ».
// Il lit TOUS les messages, independamment du groupe « notifications », et n'agit sur rien :
// il les ecrit dans son journal, avec leur partition, leur offset et leur cle.
// C'est ce que fait un service Historique dans le cours (slide 89) : un groupe par lecteur.
// Lancer : KAFKA_BROKERS=localhost:9092 node urbanhub-notifications/src/audit.ts
import kafkajs from "kafkajs";

const brokers = (process.env.KAFKA_BROKERS ?? "localhost:9092").split(",");
const groupe = process.env.KAFKA_GROUPE ?? "audit";
const kafka = new kafkajs.Kafka({ clientId: "audit", brokers, logLevel: kafkajs.logLevel.WARN });
const consommateur = kafka.consumer({ groupId: groupe });
await consommateur.connect();
await consommateur.subscribe({ topic: "signalements", fromBeginning: true });
await consommateur.run({ eachMessage: async ({ partition, message }) => {
  console.log(`[${groupe}] partition ${partition} offset ${message.offset} `
    + `cle ${message.key?.toString()} : ${message.value?.toString()}`);
} });
