import type { Notification, Operateurs } from "../ports.ts";

/** Adaptateur du port Operateurs : une ligne dans le journal du service. */
export class OperateursParJournal implements Operateurs {
  #ecrire: (ligne: string) => void;

  constructor(ecrire: (ligne: string) => void = console.log) {
    this.#ecrire = ecrire;
  }

  async prevenir(n: Notification) {
    this.#ecrire(`NOTIFICATION ${n.incident} ${n.texte}`);
  }
}
