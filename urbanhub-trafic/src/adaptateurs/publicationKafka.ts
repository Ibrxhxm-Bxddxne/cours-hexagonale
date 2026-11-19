import type { PublicateurSignalements, Signalement } from "../ports.ts";

/** Le morceau de la bibliotheque Kafka dont on a besoin : le producteur de kafkajs l'a. */
export interface Producteur {
  send(envoi: { topic: string; messages: { key: string; value: string }[] }): Promise<unknown>;
}

/**
 * Adaptateur SECONDAIRE : publie le signalement dans le topic « signalements » de Kafka.
 * MEME port que l'adaptateur HTTP : le cas d'utilisation ne voit pas la difference.
 */
export class PublicateurSignalementsKafka implements PublicateurSignalements {
  #producteur: Producteur;
  #topic: string;

  constructor(producteur: Producteur, topic = "signalements") {
    this.#producteur = producteur;          // injecte : l'objet de la bibliotheque qui envoie
    this.#topic = topic;
  }

  async publier(s: Signalement) {
    await this.#producteur.send({
      topic: this.#topic,
      messages: [{
        key: s.troncon,                     // la CLE : meme troncon, meme partition, donc dans l'ordre
        value: JSON.stringify(s),           // l'identifiant (troncon:debut) voyage avec le message
      }],
    });
  }
}
