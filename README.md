# UrbanHub : cours d'architecture hexagonale

Services **Qualité de l'air** (`urbanhub-air/`) et **Alertes** (`urbanhub-alertes/`), en TypeScript,
exécutés par Node.js (version 22.18 ou plus).

```bash
npm test          # toute la suite de tests
npm run air       # service Qualité de l'air, port 8001
npm run alertes   # service Alertes, port 8002
```

## Rendus

### TP 1 : trois avantages de l'hexagone, prouvés

| | |
|---|---|
| **Lien du dépôt** | https://github.com/Ibrxhxm-Bxddxne/cours-hexagonale |
| **Empreinte du commit** | `3f34f32` (TP1 étape 5 : rapport) |
| **Chemin du rapport** | [`docs/rapport-tp1.md`](docs/rapport-tp1.md) |

Les expériences sont dans des commits séparés :

| Expérience | Commit |
|---|---|
| Expérience 1 : un test qui tourne sans base | `a3680f4` |
| Expérience 2 : un adaptateur remplacé | `5f1822b` |
| Expérience 3 : une entrée de plus | `a80b807` |

Les documents des étapes sont dans le dossier `docs/` :

- [étape 2 : les trois avantages et leurs preuves](docs/etape2-trois-avantages.md)
- [étape 3 : les résultats des expériences](docs/etape3-resultats-experiences.md)
- [étape 4 : la comparaison avec le service Alertes](docs/etape4-comparaison-backend.md)
