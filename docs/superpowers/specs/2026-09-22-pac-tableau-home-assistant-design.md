# Tableau de bord PAC dans Home Assistant — design

*22 septembre 2026*

Remplace le spec « Interface explicative de la PAC » écrit le même jour, dont la
prémisse — une application web séparée — s'est révélée fausse une fois Home Assistant
inspecté. Voir la section *Pourquoi pas l'application*.

## Contexte

Le dépôt `chauffage` hébergeait un panneau de contrôle à deux têtes : lecture de la PAC
géothermique Alpha Innotec par le protocole Luxtronik, et pilotage de sept thermostats
Nussbaum Therm-Control. Les valves Nussbaum ont été déposées ; le plancher chauffant
tourne en circuit direct. Le besoin qui reste est de **comprendre d'un coup d'œil où en
est la PAC**, en français, sans lire des sigles allemands.

### Pourquoi pas l'application

L'inspection de Home Assistant, le 22 septembre 2026, a renversé la décision :

- L'intégration `luxtronik2` (entrée `01M23TSN5FWDSRKAH2NR97EDEZ`, *Alpha Innotec @
  192.168.86.37:8889*) déclare **160 entités au registre, dont 56 désactivées par
  défaut**. Les désactivées contenaient exactement ce qui manquait : sondes de saumure,
  impulsions du compresseur, moyenne extérieure 24 h, puissances thermique et
  électrique instantanées.
- Home Assistant lit **plus** que la connexion directe, pas moins. Les 163 valeurs
  brutes rendues par la bibliothèque npm `luxtronik2` ne contiennent ni
  `current_power_consumption` ni `current_heat_output` : l'intégration lit des
  registres que la bibliothèque ignore.
- L'application pointait encore sur **192.168.86.28**, alors que la PAC répond sur
  **192.168.86.37**. Elle ne se connectait donc plus depuis un moment.
- Le port 8889 du Luxtronik supporte mal les clients concurrents. Maintenir un second
  interrogateur à côté de celui de Home Assistant est un risque gratuit.
- `packages/ecs_solaire.yaml` pilote déjà la consigne ECS de cette PAC depuis Home
  Assistant. La régulation vit donc déjà là ; l'observation doit y vivre aussi.

Le seul avantage qui restait à l'application était la liberté graphique du schéma de
circuit. Il est conservé, sous la forme d'une carte `picture-elements`.

Le sort du dépôt `chauffage` est laissé en suspens. Il n'est plus déployé.

## Entités activées

Onze entités ont été activées dans le registre le 22 septembre 2026, et relevées après
rechargement de l'intégration :

| Entité (préfixe `luxtronik_300722_07_`) | Relevé | Usage |
|---|---|---|
| `sensor…heat_source_input_temperature` | 23,9 °C | Saumure revenant du sol |
| `sensor…heat_source_output_temperature` | 24,0 °C | Saumure repartant au sol |
| `sensor…compressor1_impulses` | 2 | Démarrages, pour le cycle moyen |
| `sensor…outdoor_temperature_average` | 15,7 °C | Moyenne extérieure 24 h |
| `sensor…current_heat_output` | 0 W | Puissance thermique |
| `sensor…current_power_consumption` | 0 W | Puissance électrique |
| `sensor…pump_flow_delta` / `_target` | 0 K | ΔT de circulation calculé par la PAC |
| `sensor…suction_evaporator_temperature` | 0 °C | **Écartée** — sonde absente |
| `binary_sensor…circulation_pump_heating` | — | Pompe de circulation chauffage |
| `binary_sensor…dhw_charging_pump` | — | Pompe de charge du ballon |

Les deux sondes de saumure rendent exactement les valeurs lues en direct sur la PAC
(23,9 / 24,0), ce qui confirme que l'intégration les lit correctement.

## Ce que les compteurs permettent, et ce qu'ils ne permettent pas

**Le COP cumulé de l'eau chaude est mesurable ; l'instantané ne l'est pas encore.**
Les compteurs ECS fonctionnent : `dhw_heat_amount` 15,0 kWh produits pour
`dhw_energy_input` 4,12 kWh consommés sur 1,56 h de marche, soit **un COP de 3,64**.
Cette estimation interne de la PAC est corroborée par une mesure indépendante :
4,12 kWh sur 1,56 h font 2,64 kW de tirage moyen, en plein dans la fourchette
« 2,4 kW au démarrage, 3,3 kW en fin de cycle » relevée les 20 et 21 septembre et
consignée en tête de `packages/ecs_solaire.yaml`. Deux sources indépendantes qui
concordent : l'estimation de la PAC est fiable.

En revanche `current_heat_output` et `current_power_consumption` lisent 0 W, compresseur
à l'arrêt depuis 21 h. Le COP **instantané** reste donc à vérifier à la première chauffe,
et son capteur exige une consommation supérieure à 100 W pour se prononcer.

**Les capteurs de COP de l'intégration sont inutilisables.** `sensor…cop_dhw` et
`sensor…cop_heating` lisent tous deux `unknown` alors que leurs deux ingrédients sont
présents et à jour : l'intégration ne fait pas le calcul. Les COP sont donc calculés
dans les gabarits de ce paquet, jamais lus depuis ces deux entités.

**Le COP de chauffage n'a pas encore de base saine.** `heat_amount_heating` vaut
0 kWh et `operation_hours_heating` 0 h — la PAC n'a pas chauffé la maison depuis la
remise à zéro — mais `heat_energy_input` affiche 52,86 kWh. Un compteur d'entrée qui
tourne pour une sortie nulle est incohérent : celui-là n'a pas été remis à zéro avec
les autres. Le capteur de COP chauffage est construit mais reste indisponible tant que
`heat_amount_heating` est à 0, plutôt que d'annoncer un rendement de 0.

**Aucun compteur électrique dédié à la PAC.** Les trois phases mesurées
(`sensor.puissance_phase_a/b/c`) sont globales — buanderie, maison, cuisine. Elles ne
peuvent pas isoler la PAC. L'estimation interne est la seule source, et la
concordance ci-dessus suffit à s'y fier.

**Le cycle moyen restera muet.** Deux démarrages et deux heures de marche : les
compteurs ont été remis à zéro avec le nouveau système. L'indicateur exige au moins dix
démarrages avant de se prononcer, et affiche sinon « pas assez de démarrages ».

**Les pressions ne veulent rien dire à l'arrêt.** Relevé du 22 septembre : haute
pression 14,57 bar, basse pression 15,10 bar — la basse au-dessus de la haute. Les
pressions s'équilibrent circuit arrêté et les décalages de sonde apparaissent. Elles
sont affichées dans le détail, jamais interprétées, et jamais présentées comme un
indicateur de santé.

## Le paquet `packages/pac.yaml`

Un fichier par projet sous `packages/`, selon la convention posée dans
`configuration.yaml`.

### L'état, en français

`sensor.pac_etat` traduit le `status` Luxtronik et les binaires en un état lisible :

| État rendu | Condition |
|---|---|
| Chauffe la maison | compresseur en marche, statut `heating` |
| Fait l'eau chaude | `status` vaut `hot_water`, ou la pompe de charge ECS est active |
| Rafraîchit | mode rafraîchissement actif |
| Dégivre | vanne de dégivrage ouverte |
| Bloquée par le réseau | `evu_unlocked` à `off` |
| Au-dessus de la limite de chauffe | statut `no_request`, dehors trop doux |
| Au repos | compresseur à l'arrêt, aucune des conditions ci-dessus |
| Erreur | `error_reason` non nul |
| Hors ligne | entités indisponibles |

**La pompe de charge ECS n'est pas un détecteur fiable.** Relevé le 22 septembre à 11 h 30,
compresseur en marche et ballon en charge : `status` valait `hot_water` pendant que
`binary_sensor.…dhw_charging_pump` valait `off`. C'est `status` qui fait foi.

L'état « au-dessus de la limite de chauffe » mérite d'exister à part. La PAC l'annonce
elle-même — lecture directe du 22 septembre : `Heizgrenze (Soll 15 °C)` — et c'est la
réponse à la question « pourquoi elle ne chauffe pas ? » un jour à 11,6 °C.

La durée dans l'état vient de `states.sensor.pac_etat.last_changed`, pas du
`status_time` de la PAC : celui-ci lit 0 s alors que le compresseur est arrêté depuis
21 h. Il n'est pas fiable.

### La phrase de causalité

`sensor.pac_explication` compose, en Jinja, la chaîne qui explique l'état courant. La
régulation Alpha Innotec pilote sur le **retour**, ce qui la rend lisible :

> Il fait 11,6 °C dehors, au-dessus de la limite de chauffe : la PAC ne demande rien.
> Le plancher est à 23,5 °C au retour.

> Il fait −2 °C dehors. La courbe vise 28,5 °C au retour ; le retour est à 27,8 °C.
> Le compresseur tourne pour combler l'écart.

> Le ballon est à 44 °C, la consigne est 54 °C. La PAC charge l'eau chaude ;
> le chauffage reprendra ensuite.

Quand `input_boolean.ecs_solaire_boost_actif` est actif (son nom affiché est
« ECS solaire - chauffe en cours », vérifié le 22 septembre), la phrase le dit et
nomme la consigne haute — sinon la consigne à 55 °C au lieu de 54 paraîtrait inexpliquée.
C'est `packages/ecs_solaire.yaml` qui la déplace.

### Les indicateurs

| Capteur | Calcul | Disponible quand |
|---|---|---|
| `sensor.pac_ecart_chauffage` | départ − retour | compresseur en marche |
| `sensor.pac_ecart_source` | saumure entrée − sortie | compresseur en marche |
| `sensor.pac_cop_instant` | puissance thermique ÷ puissance électrique | consommation > 100 W |
| `sensor.pac_cop_ecs` | `dhw_heat_amount` ÷ `dhw_energy_input` | toujours — vaut 3,64 |
| `sensor.pac_cop_chauffage` | `heat_amount_heating` ÷ `heat_energy_input` | `heat_amount_heating` > 0 |
| `sensor.pac_cycle_moyen` | heures × 60 ÷ démarrages | démarrages ≥ 10 |

Chacun porte un attribut `verdict` : une phrase en français plutôt qu'un nombre nu.

**Les deux écarts passent en `unavailable` compresseur à l'arrêt**, par un
`availability:` sur le gabarit. Ce n'est pas de la prudence décorative : relevé du
22 septembre, tout le circuit est équilibré à 24 °C, saumure comprise, et l'écart source
vaut −0,1 K. Un verdict là-dessus serait un mensonge.

### Les seuils

En dur dans le YAML, avec le raisonnement en commentaire à côté — pas de helpers
réglables pour des valeurs qu'on touchera rarement.

**Ces seuils sont des valeurs de départ tirées de la littérature sur les planchers
chauffants en géothermie, pas de mesures sur cette installation.** Les compteurs ayant
été remis à zéro, aucune mesure n'existe encore. Ils sont à revoir après une saison de
chauffe, et le commentaire dans le fichier le dira.

- **Écart chauffage** : 3 à 7 K normal. Sous 2 K, la circulation est trop rapide ou la
  PAC module à vide ; au-dessus de 8 K, le débit est trop faible.
- **Écart source** : 2 à 5 K normal. Au-dessus de 6 K, soit le débit de saumure
  faiblit, soit le terrain ne rend plus assez.
- **Température du sol** (saumure entrante) : au-dessus de 0 °C en saison de chauffe,
  confortable ; sous −5 °C, le terrain est sollicité au-delà de sa plage habituelle.
- **Cycle moyen** : au-delà de 20 min, sain ; de 10 à 20 min, acceptable ; sous 10 min,
  cycles courts, qui usent le compresseur.
- **COP** : au-dessus de 4, bon pour de la géothermie sur plancher ; sous 3, à regarder.

## Le tableau `dashboards/pac.yaml`

Déclaré dans `configuration.yaml` sous `lovelace.dashboards` avec la clé
`pac-chauffage` — le chemin doit contenir un tiret, règle notée dans le fichier —
titre « PAC », icône `mdi:heat-pump`. `max_columns: 4`, pour les raisons de largeur
consignées dans le `CLAUDE.md`.

La vue se lit de haut en bas :

1. **En ce moment** — carte `markdown` : l'état en gros, la durée, la phrase de
   causalité.
2. **Le circuit** — carte `picture-elements` (voir ci-dessous).
3. **Est-ce que ça va bien** — carte `entities` : les indicateurs, chacun avec
   son verdict. Les indisponibles disent pourquoi.
4. **La courbe de chauffe** — les trois paramètres du circuit 2 (fin 35 °C, pied 20 °C,
   abaissement 0 K) et la consigne de retour courante. Le circuit 2 est le seul réel :
   les circuits 1 et 3 lisent 75 °C, valeur sentinelle de sonde absente.
5. **L'historique** — `history-graph` sur les températures et `statistics-graph` sur
   les heures et l'énergie. Gratuit ici, contrairement à l'application.
6. **Le détail**, replié — toutes les valeurs brutes avec leur nom français, leur sigle
   Luxtronik (TA, TVL, TRL, TBW, TEE, TAE, THG) et leur entité d'origine ; les
   pressions, non interprétées ; les compteurs ; la dernière erreur.

Les cartes posées en section reçoivent `grid_options: {columns: full}` — sans quoi
elles n'occupent que la moitié de la grille, piège constaté au DOM le 21 septembre 2026
et consigné dans le `CLAUDE.md`.

## Le schéma du circuit

Un SVG dessiné à la main, déposé dans `www/pac-circuit.svg`, servi comme fond d'une
carte `picture-elements`. Il représente :

- le **sol** et les capteurs géothermiques, la saumure qui en revient et celle qui y
  repart ;
- la **PAC** au centre, compresseur et gaz chaud ;
- le **départ** et le **retour** du plancher chauffant ;
- la dérivation vers le **ballon ECS**.

Par-dessus, des éléments `state-label` positionnés en pourcentage posent chaque
température là où sa sonde se trouve réellement, et des `state-icon` montrent les
pompes et la vanne, allumées ou éteintes.

Le fond est neutre et lisible dans les deux thèmes : traits sombres sur fond
transparent ne conviendrait pas en thème clair, donc le SVG porte ses propres teintes
et un contraste qui tient sur clair comme sur sombre.

La mise en évidence du trajet actif se fait par les icônes de pompes et la couleur des
étiquettes, pas par une animation du SVG : `picture-elements` ne redessine pas son
image de fond selon l'état.

## Le lien depuis le tableau « Maison »

`dashboards/maison.yaml` est **généré** par `gen_maison.py` — son en-tête le dit en
capitales. Le lien s'ajoute donc dans le script, jamais dans le YAML.

Le script vit sur p-cloud dans `config/homelab/gen_maison.py`. *(Son propre en-tête
annonce `/home/rjl/homelab/homeassistant/gen_maison.py`, un niveau trop haut : le
chemin réel est `…/homeassistant/config/homelab/gen_maison.py`. Corrigé au passage,
puisqu'on édite le fichier.)*

**Où.** Dans la grille `modes` de `overview()`, celle intitulée « Actions ». Elle
contient déjà des tuiles qui mènent ailleurs — `/reglages-maison`, `/sonnette-cam`,
`/energy`, `/maison-pieces/courbes`. Une tuile « PAC » s'y ajoute naturellement, avec
`icon: mdi:heat-pump`, et pour sous-texte l'état vivant `sensor.pac_etat` plutôt qu'un
libellé figé : la tuile renseigne avant même qu'on la touche.

`tap_action: navigate` vers `/pac-chauffage/pac`. Même forme que les tuiles voisines,
mêmes `grid_options: {columns: 4, rows: 2}`.

**Une seconde entrée**, dans la section `pac` de `TECHNIQUE`, en tête de son `extra` :
la vue Technique montre déjà les chips et les cartes climat de la PAC, et c'est de là
qu'on voudra basculer vers le détail.

**Redéploiement.** La méthode est consignée dans l'en-tête du script : le lancer depuis
son dossier écrit `maison.yaml` à côté, puis
`docker cp maison.yaml homeassistant:/config/dashboards/`. Les fichiers de
`dashboards/` appartiennent à root, d'où la copie par Docker plutôt qu'un `cp` direct
dans le volume monté.

Le tableau « Maison » est relu à chaque actualisation de la page : ce redéploiement-là
ne demande pas de redémarrage, contrairement à la déclaration du nouveau tableau.


## Déploiement et vérification

Les fichiers vivent sur p-cloud, dans `/home/rjl/homelab/homeassistant/config`, monté
sur `/config` dans le conteneur `homeassistant` :

- `packages/pac.yaml` — nouveau
- `dashboards/pac.yaml` — nouveau
- `www/pac-circuit.svg` — nouveau
- `configuration.yaml` — une entrée ajoutée sous `lovelace.dashboards`
- `homelab/gen_maison.py` — modifié : deux liens vers le nouveau tableau
- `dashboards/maison.yaml` — régénéré par le script, jamais édité à la main

Ordre des opérations : écrire les fichiers, sauvegarder `configuration.yaml` selon la
convention `.bak-AAAA-MM-JJ-HHMMSS` visible dans le dossier, puis redémarrer Home
Assistant — la déclaration d'un tableau de bord l'exige, même si son contenu est relu à
chaque rechargement de page.

**Vérification, dans cet ordre :**

1. `check_config` sur la configuration. Il valide le paquet, **pas** le tableau de bord.
2. Chaque gabarit Jinja rendu séparément par l'API `POST /api/template`, avant
   déploiement : c'est le seul moyen de voir une erreur de template autrement qu'en
   cherchant dans le journal.
3. Les états des nouveaux capteurs relevés par l'API REST, et comparés à la lecture
   directe de la PAC.
4. Le rendu vérifié au navigateur avec le MCP Chrome, en large et en largeur de
   téléphone — `check_config` ne valide pas les tableaux de bord, et la largeur des
   cartes se constate, elle ne se déduit pas.
5. Le COP ECS vérifié tout de suite contre le calcul à la main : 15,0 ÷ 4,12 = 3,64.
6. **À la première chauffe**, revenir vérifier le COP instantané, les deux écarts et la
   phrase de causalité en fonctionnement réel. Rien de tout cela n'est observable
   compresseur à l'arrêt.

## Hors périmètre

- Toute nouvelle automatisation de pilotage. `packages/ecs_solaire.yaml` garde la main
  sur la consigne ECS ; ce paquet observe, il ne décide pas.
- Le sort du dépôt `chauffage`, à trancher plus tard.
- Le **COP par cycle de charge ECS** — relever les deux compteurs au début et à la fin
  de chaque chauffe pour mesurer ce que coûte le passage à 55 °C sur surplus solaire.
  Utile vu `packages/ecs_solaire.yaml`, mais c'est un mécanisme à part : report assumé.
- Les 45 entités Luxtronik encore désactivées, qui n'ont pas d'usage ici.
- Une section dans `reglages.yaml` : elle n'a lieu d'être que si des helpers réglables
  apparaissent, et le choix des seuils en dur écarte ce cas.
