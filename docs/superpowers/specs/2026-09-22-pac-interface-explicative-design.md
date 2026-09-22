# Interface explicative de la PAC — design

*22 septembre 2026*

## Contexte

Le projet `chauffage` était un panneau de contrôle à deux têtes : il lisait la PAC
géothermique Alpha Innotec par le protocole Luxtronik, et pilotait sept thermostats
Nussbaum Therm-Control répartis sur deux contrôleurs. Les valves Nussbaum ont été
déposées. Le plancher chauffant tourne désormais en circuit direct, sans régulation
par pièce.

Tout ce qui touchait aux pièces perd son objet : le service Nussbaum et ses 426
lignes, le coordinateur qui répercutait le mode rafraîchissement vers les valves, la
grille de pièces, et l'assistant de courbe de chauffe — qui recommandait des réglages
en comparant les températures des chambres à une consigne.

Home Assistant tient déjà les séries temporelles de l'installation. Cette interface
n'a donc pas à refaire des graphiques d'historique : elle vient **en supplément**, pour
répondre d'un coup d'œil à une question que Home Assistant rend mal — *qu'est-ce que
la PAC est en train de faire, et est-ce que ça va bien ?*

## Objectif

Une page unique, en lecture seule, qui explique l'état de la PAC en français courant.
Chaque valeur affichée est nommée, située dans le circuit, et accompagnée d'un verdict.
L'utilisateur n'a pas à connaître le sigle TRL Soll pour comprendre où en est sa maison.

L'écriture des paramètres n'est pas exposée aujourd'hui, mais le chemin reste ouvert :
`writeParameter()` et `WRITABLE_PARAMS` restent dans le backend, sans route ni UI.

## Ce que la page montre

La page se lit de haut en bas, dans l'ordre des quatre questions qu'on se pose devant
une PAC.

### 1. Que fait-elle en ce moment ?

Un bandeau en tête, avec une phrase en gros caractères et une pastille de couleur :

> **Elle chauffe la maison** — depuis 23 min

Les états possibles, dérivés du mode Luxtronik et de l'état du compresseur :
chauffage, eau chaude sanitaire, dégivrage, repos, erreur, hors ligne.

La durée vient d'un suivi des transitions tenu en mémoire par le backend. Elle n'est
pas persistée : après un redémarrage du conteneur, la durée repart de zéro et le
bandeau l'omet tant qu'aucune transition n'a été observée. Afficher une durée fausse
serait pire que ne rien afficher.

### 2. Pourquoi ?

Une phrase sous le bandeau, qui déroule la chaîne de causalité. La régulation Alpha
Innotec pilote sur la température de **retour**, ce qui rend l'explication lisible :

> Il fait −2 °C dehors. La courbe de chauffe vise 28,5 °C au retour ; le retour est à
> 27,8 °C, soit 0,7 °C en dessous. Le compresseur tourne pour combler l'écart.

En mode eau chaude, la même phrase se réécrit autour du ballon :

> Le ballon est à 44 °C, la consigne est 50 °C. La PAC a basculé sur l'eau chaude ;
> le chauffage reprendra ensuite.

Ces phrases sont composées par le backend, pas par le frontend (voir *Architecture*).

### 3. Où passe la chaleur ?

Un schéma SVG du circuit, dessiné à la main dans un composant React — pas de
bibliothèque de diagrammes. Il montre :

- le **sol** et les capteurs géothermiques, avec la saumure qui en revient (`sourceIn`)
  et celle qui y repart (`sourceOut`) ;
- la **PAC** au centre, avec le compresseur et la température de gaz chaud (`hotGas`) ;
- le **départ** et le **retour** du plancher chauffant (`heatingFlow`, `heatingReturn`) ;
- la dérivation vers le **ballon ECS** (`hotWater`) ;
- les **pompes** (saumure, chauffage, bouclage) et la vanne ECS, allumées ou éteintes.

Chaque température est posée là où sa sonde se trouve réellement. Le trajet actif est
mis en évidence : quand la PAC fait l'eau chaude, c'est la branche du ballon qui
s'anime, pas celle du plancher. Quand tout est à l'arrêt, le schéma est gris et statique.

C'est le cœur de la valeur ajoutée : comprendre la circulation d'un coup d'œil plutôt
que de lire neuf nombres.

### 4. Est-ce que ça va bien ?

Quatre indicateurs dérivés, chacun avec un verdict en français plutôt qu'un nombre nu.

| Indicateur | Calcul | Ce qu'il dit |
|---|---|---|
| Écart chauffage | `heatingFlow − heatingReturn` | Combien de chaleur le plancher absorbe |
| Écart source | `sourceIn − sourceOut` | Combien on prend au terrain |
| Température du sol | `sourceIn` | Si le terrain s'épuise |
| Cycle moyen | `compressorHours × 60 ÷ compressorImpulses` | Si la PAC fait des cycles courts |

**Règle importante :** les deux écarts ne veulent rien dire compresseur à l'arrêt —
l'eau stagne, les sondes s'équilibrent. Quand le compresseur ne tourne pas, ces deux
indicateurs affichent « non mesurable à l'arrêt » au lieu d'un verdict. Le cycle moyen
et la température du sol restent valables en permanence.

Les seuils sont des valeurs de départ, regroupées dans un seul objet nommé au sommet
de `diagnostic.ts`, avec le raisonnement en commentaire à côté. Ils seront affinés par
l'observation ; le spec ne prétend pas qu'ils sont les bons.

- Écart chauffage : 3–7 K normal pour un plancher. En dessous de 2 K, la circulation
  est trop rapide ou la PAC module à vide ; au-dessus de 8 K, le débit est trop faible.
- Écart source : 2–5 K normal. Au-dessus de 6 K, soit le débit de saumure faiblit, soit
  le terrain ne rend plus assez.
- Température du sol : au-dessus de 0 °C en saison de chauffe, c'est confortable ; en
  dessous de −5 °C en entrée, le terrain est sollicité au-delà de sa plage habituelle.
- Cycle moyen : au-delà de 20 min, sain ; entre 10 et 20 min, acceptable ; en dessous
  de 10 min, cycles courts, qui usent le compresseur.

### Le détail, replié

Sous les quatre indicateurs, trois sections qu'on déplie quand on veut creuser :

- **La courbe de chauffe**, tracée en lecture seule à partir de `endPoint` et
  `parallelOffset`, avec le point du jour posé dessus (`outdoor`, `heatingReturnTarget`).
  Le code de tracé existe déjà dans `heatingCurve.ts` et `HeatingCurveChart.tsx`.
- **Toutes les valeurs brutes**, chacune avec son nom français, son sigle Luxtronik
  (TA, TVL, TRL, TBW, TEE, TAE, THG) et sa description — `explanations.ts` les tient
  déjà — plus les compteurs d'heures, de démarrages et d'énergie.
- **Le journal d'erreurs**, avec ses traductions (`errorTranslations.ts`, 207 lignes).

### Une honnêteté à tenir

La PAC remonte l'énergie **thermique produite** (`energy_heating`, `energy_hot_water`),
pas l'électricité consommée. Sans compteur électrique dédié, le COP n'est pas calculable.
La page affiche les kWh produits et dit explicitement qu'elle ne peut pas en déduire un
rendement. Aucun chiffre de COP inventé.

## Architecture

### Les verdicts sont calculés côté backend

Un module `backend/src/services/diagnostic.ts` prend un `HeatPumpData` et l'état des
transitions, et rend un objet `Diagnostic` : l'état courant et sa durée, la phrase
explicative, les quatre indicateurs avec leur valeur et leur verdict.

Les seuils vivent donc à un seul endroit, et Home Assistant peut lire ces mêmes verdicts
par un capteur REST sur `/api/status` s'il le faut un jour. Le frontend ne fait que
mettre en forme — il ne décide jamais si une valeur est normale.

`diagnostic.ts` est composé de fonctions pures sauf pour le suivi des transitions, qui
est isolé dans son propre petit module d'état. C'est ce qui le rend testable.

### Flux de données

```
luxtronik2 (TCP 8889)
   └─ luxtronik.ts  ── poll 10 s ──▶  HeatPumpData
                                         │
                                         ▼
                                   diagnostic.ts  ──▶  Diagnostic
                                         │
                          ┌──────────────┴──────────────┐
                          ▼                             ▼
                   GET /api/status              WebSocket broadcast
                                                        │
                                                  React (une page)
```

Le message WebSocket devient unique :
`{ type: 'status', data: { heatpump: HeatPumpData, diagnostic: Diagnostic } }`.
Le type `rooms` et la compatibilité avec l'ancien format brut disparaissent.

`GET /api/status` rend la même enveloppe. `GET /api/data` est conservé et rend le
`HeatPumpData` seul, pour qui veut les valeurs sans interprétation.

### Docker

L'infrastructure ne bouge pas : deux conteneurs (backend Node, frontend nginx qui
proxifie `/api` et `/ws`), réseau `web` externe, Traefik sur
`chauffage.lab.crog.org`, Watchtower. Seules les variables d'environnement Nussbaum
sont retirées du `docker-compose.yml`, et les libellés Homepage sont réécrits pour
refléter la nouvelle vocation.

Le volume `backend-data` n'a plus rien à stocker — l'historique disparaît — mais il
reste déclaré : le coût est nul et il resservira si l'écriture revient.

## Ce qui est supprimé

**Backend**

- `services/nussbaum.ts` (426 l.), `services/coordinator.ts` (35 l.),
  `services/history.ts` (126 l.), `types/nussbaum.ts` (37 l.)
- `routes/controls.ts` en entier — écriture PAC et routes de pièces
- Les données : `backend/rooms-cache.json`, `backend/data/rooms-cache.json`,
  `backend/data/history.json`
- Dans `config.ts` : le bloc `nussbaum`
- Dans `package.json` : la dépendance `modbus-serial`, qui n'est plus importée nulle part
  (vérifié : aucune occurrence dans `src/`)
- Dans `routes/data.ts` : `/rooms`, `/history`, `/history/settings`, `/system`

**Frontend**

- `types/nussbaum.ts`, `components/RoomCard.tsx` (203 l.),
  `components/RoomGrid.tsx` (77 l.), `components/DemandSummary.tsx` (27 l.)
- `components/ControlPanel.tsx` (176 l.) et `components/HeatingCurvePage.tsx` (363 l.)
- `components/ui/slider.tsx`, `components/ui/select.tsx` — plus aucun consommateur
  une fois `RoomCard` et `ControlPanel` partis
- Dans `lib/heatingCurve.ts` : `analyzeAndRecommend()` et l'interface
  `Recommendation` — la recommandation reposait sur les mesures des pièces
- Dans `hooks/useHeatPump.ts` : `roomsData`, `roomsStale`, `sendControl`,
  `setRoomTemperature`, `renameRoom`, `resetErrors`
- Dans `lib/explanations.ts` : l'entrée `desiredRoomTemp`
- La navigation par onglets dans `App.tsx` : il n'y a plus qu'une page

Environ 1 500 lignes disparaissent.

## Ce qui est gardé

- `luxtronik.ts` et son parsing, inchangés hormis le retrait du cas d'erreur dupliqué
- `errorTranslations.ts` — 207 lignes de traductions de codes Luxtronik, irremplaçables
- `explanations.ts` — les descriptions en français, étendues aux nouveaux indicateurs
- `heatingCurve.ts` — `calculateCurveTemp()` et `generateCurvePoints()`
- `HeatingCurveChart.tsx`, allégé de ses contrôles d'édition
- `ErrorLog`, `RuntimeStats`, `OperatingModes`, `SystemStatus`, `InfoTooltip`,
  `TemperatureCard` — réemployés dans les sections repliées
- Les primitives `ui/` restantes : `card`, `badge`, `button`, `separator`

## Nouveaux fichiers

**Backend**

- `src/types/diagnostic.ts` — `Diagnostic`, `Indicator`, `Verdict`, `SystemState`
- `src/services/diagnostic.ts` — les seuils, les fonctions pures de verdict, la
  composition des phrases
- `src/services/stateTracker.ts` — le suivi des transitions de mode et de compresseur,
  qui donne la durée de l'état courant

**Frontend**

- `src/types/diagnostic.ts` — miroir des types backend
- `src/components/StatusBanner.tsx` — le bandeau et la phrase explicative
- `src/components/CircuitDiagram.tsx` — le schéma SVG
- `src/components/HealthChecks.tsx` — les quatre indicateurs
- `src/components/RawValues.tsx` — la section repliée des valeurs brutes

## Tests

Le dépôt n'a aucun test aujourd'hui. Les verdicts en méritent : ce sont des seuils qui
produisent des affirmations sur l'installation, et une inversion de signe y passerait
inaperçue — c'est exactement ce qui est arrivé au commit `e8e8e23`, qui corrigeait un
signe inversé dans les recommandations de courbe.

On ajoute **Vitest** au backend et on teste `diagnostic.ts` et `stateTracker.ts` :

- chaque indicateur rend le bon verdict de part et d'autre de chaque seuil ;
- les deux écarts rendent « non mesurable » compresseur à l'arrêt ;
- le cycle moyen ne divise pas par zéro quand `compressorImpulses` vaut 0 ;
- la phrase explicative dit « chauffe » quand le retour est sous la consigne et
  « consigne atteinte » au-dessus ;
- le suivi de transitions n'annonce pas de durée tant qu'aucune transition n'a été vue,
  et remet le compteur à zéro au changement d'état.

Le frontend n'est pas testé unitairement : il ne fait que de la mise en forme. Le rendu
est vérifié dans le navigateur via le MCP Chrome, écran large et écran de téléphone.

## Erreurs et cas limites

- **PAC injoignable** : `luxtronik.ts` rend déjà un `HeatPumpData` avec
  `connected: false`. Le bandeau affiche « Hors ligne » et le schéma se grise. Aucun
  indicateur n'est calculé sur des zéros — le diagnostic rend un état `offline` sans
  indicateurs, plutôt que quatre verdicts sur des valeurs nulles.
- **WebSocket coupé** : le badge de connexion passe au rouge, la dernière valeur reçue
  reste affichée avec son horodatage, et un bandeau discret indique qu'elle est figée.
- **Valeurs manquantes** : le parsing remplace déjà les absences par `0`. Le diagnostic
  distingue un vrai 0 °C d'une absence pour la température de gaz chaud, où 0 est
  impossible en fonctionnement : au-dessous de 5 °C compresseur en marche, la valeur
  est marquée indisponible plutôt qu'interprétée.

## Hors périmètre

- Toute écriture vers la PAC, et l'interface qui irait avec
- Les séries temporelles et les graphiques d'historique — c'est le rôle de Home Assistant
- Le calcul d'un COP, faute de compteur électrique
- Une intégration Home Assistant native (MQTT, discovery) ; `/api/status` suffit si
  le besoin se présente
