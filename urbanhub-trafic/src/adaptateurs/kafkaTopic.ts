// Le topic des signalements, regle une fois (TP 4, etape 5) : 3 partitions.
// Cree explicitement, plutot que laisse a la creation automatique du broker,
// pour que le nombre de partitions soit ECRIT dans le depot et pas dans un reglage du serveur.

export const TOPIC_SIGNALEMENTS = "signalements";
export const PARTITIONS = 3;

/** Le morceau de l'administration kafkajs dont on a besoin. */
export interface Administration {
  createTopics(options: { topics: { topic: string; numPartitions: number;
    replicationFactor: number }[]; waitForLeaders?: boolean }): Promise<boolean>;
}

/** Cree le topic s'il n'existe pas ; rend false s'il existait deja (rien a faire). */
export function creerTopic(admin: Administration, replication = 1) {
  return admin.createTopics({ waitForLeaders: true, topics: [{ topic: TOPIC_SIGNALEMENTS,
    numPartitions: PARTITIONS, replicationFactor: replication }] });
}
