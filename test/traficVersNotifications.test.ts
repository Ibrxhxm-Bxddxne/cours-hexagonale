// TP4, etape 2 : les deux hexagones relies par le reseau, de bout en bout.
// Trafic (vrai cas d'utilisation + vrai publicateur HTTP) -> HTTP -> Notifications (vraie entree HTTP).
// Seuls les adaptateurs de stockage sont en memoire.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { gestionnaire } from "../urbanhub-notifications/src/adaptateurs/entreeHttp.ts";
import { HistoriqueEnMemoire } from "../urbanhub-notifications/src/adaptateurs/historiqueMemoire.ts";
import { ReceptionIncidents } from "../urbanhub-notifications/src/service.ts";
import { DepotRelevesEnMemoire } from "../urbanhub-trafic/src/adaptateurs/depotMemoire.ts";
import { EtatsTronconsEnMemoire } from "../urbanhub-trafic/src/adaptateurs/etatsMemoire.ts";
import { PublicateurSignalementsHttp } from "../urbanhub-trafic/src/adaptateurs/publicationHttp.ts";
import { ReferentielTronconsEnMemoire } from "../urbanhub-trafic/src/adaptateurs/referentielMemoire.ts";
import { releve } from "../urbanhub-trafic/src/domaine.ts";
import { SeuilRelatif } from "../urbanhub-trafic/src/regles.ts";
import { SurveillanceTrafic } from "../urbanhub-trafic/src/service.ts";

test("trois releves lents sur Rivoli : une seule notification chez les operateurs", async () => {
  const textes: string[] = [];
  const historique = new HistoriqueEnMemoire();
  const notifications = createServer(gestionnaire(new ReceptionIncidents(
    { prevenir: async (n) => { textes.push(n.texte); } }, historique), () => {}));
  await new Promise<void>((ok) => notifications.listen(0, ok));
  const url = `http://localhost:${(notifications.address() as AddressInfo).port}/signalements`;

  const trafic = new SurveillanceTrafic(new DepotRelevesEnMemoire(),
    new ReferentielTronconsEnMemoire([{ identifiant: "rue-de-rivoli-1", vitesseLimite: 30 }]),
    new EtatsTronconsEnMemoire(), new PublicateurSignalementsHttp(url), new SeuilRelatif(0.4));

  for (const [vitesse, heure] of [[10, "08:00"], [8, "08:05"], [9, "08:10"]] as const) {
    await trafic.executer(releve({ troncon: "rue-de-rivoli-1", vitesse,
      horodatage: `2026-11-19T${heure}:00` }));
  }
  notifications.close();

  assert.deepEqual(textes,
    ["[trafic] rue-de-rivoli-1 : circulation a 10 km/h pour 30 km/h autorises (depuis 08:00)"]);
  assert.deepEqual(historique.tous().map((i) => i.identifiant), ["rue-de-rivoli-1:2026-11-19T08:00:00"]);
});
