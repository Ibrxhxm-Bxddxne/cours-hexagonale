// TP4, etape 2 : l'adaptateur qui PUBLIE en HTTP (service Trafic), avec un delai.
// Un vrai serveur HTTP local joue le destinataire : on verifie ce qui passe sur le reseau.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { PublicateurSignalementsHttp } from "../urbanhub-trafic/src/adaptateurs/publicationHttp.ts";
import { signalement } from "../urbanhub-trafic/src/domaine.ts";

const bouchon = signalement({ troncon: "rue-de-rivoli-1", vitesseMoyenne: 9,
  vitesseLimite: 30, debut: "2026-11-19T08:10:00" });

async function destinataire(repondre: (req: IncomingMessage, rep: ServerResponse, corps: string) => void) {
  const serveur = createServer(async (req, rep) => {
    let corps = "";
    for await (const m of req) corps += m;
    repondre(req, rep, corps);
  });
  await new Promise<void>((ok) => serveur.listen(0, ok));
  const url = `http://localhost:${(serveur.address() as AddressInfo).port}/signalements`;
  return { url, fermer: () => { serveur.closeAllConnections(); serveur.close(); } };
}

test("il envoie le signalement en JSON, identifiant compris, par POST", async () => {
  let recu: { methode?: string; type?: string; corps?: unknown } = {};
  const d = await destinataire((req, rep, corps) => {
    recu = { methode: req.method, type: req.headers["content-type"], corps: JSON.parse(corps) };
    rep.writeHead(202).end();
  });
  await new PublicateurSignalementsHttp(d.url).publier(bouchon);
  d.fermer();
  assert.equal(recu.methode, "POST");
  assert.equal(recu.type, "application/json");
  assert.deepEqual(recu.corps, bouchon);
});

test("un refus du destinataire (500) leve une erreur : rien n'est avale", async () => {
  const d = await destinataire((_req, rep) => rep.writeHead(500).end());
  await assert.rejects(new PublicateurSignalementsHttp(d.url).publier(bouchon), /500/);
  d.fermer();
});

test("LE DELAI : un destinataire fige est abandonne au bout du delai, pas au bout de 30 s", async () => {
  const d = await destinataire(() => { /* ne repond jamais */ });
  const debut = performance.now();
  await assert.rejects(new PublicateurSignalementsHttp(d.url, 200).publier(bouchon),
    (e: Error) => e.name === "TimeoutError");
  const duree = performance.now() - debut;
  d.fermer();
  assert.ok(duree >= 190 && duree < 1000, `abandon apres ${Math.round(duree)} ms`);
});

test("personne n'ecoute : l'erreur reseau remonte", async () => {
  await assert.rejects(new PublicateurSignalementsHttp("http://localhost:9/signalements", 500)
    .publier(bouchon));
});
