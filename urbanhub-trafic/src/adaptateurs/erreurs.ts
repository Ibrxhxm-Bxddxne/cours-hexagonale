// Les erreurs que les adaptateurs de publication se passent entre eux.
// Elles disent au reessai s'il est UTILE de retenter : c'est de la technique, pas du domaine.

/** Le destinataire a repondu, et refuse le message (4xx) : le renvoyer ne changera rien. */
export class RefusDefinitif extends Error {
  readonly statut: number;
  constructor(statut: number) {
    super(`le destinataire refuse le message (${statut})`);
    this.name = "RefusDefinitif";
    this.statut = statut;
  }
}

/** Le coupe-circuit refuse l'appel sans toucher le reseau : retenter tout de suite est inutile. */
export class CircuitOuvert extends Error {
  constructor(message = "circuit ouvert : destinataire en panne, appel refuse sans reseau") {
    super(message);
    this.name = "CircuitOuvert";
  }
}
