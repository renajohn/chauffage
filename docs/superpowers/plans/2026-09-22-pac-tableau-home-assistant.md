# Tableau de bord PAC dans Home Assistant — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à la PAC géothermique Alpha Innotec un tableau de bord Home Assistant qui explique en français ce qu'elle fait, pourquoi, et si elle va bien.

**Architecture:** Un paquet `packages/pac.yaml` traduit les entités Luxtronik brutes en capteurs compréhensibles — état, phrase de causalité, écarts, COP, cycle moyen — chacun portant un verdict. Un tableau `dashboards/pac.yaml` les met en scène autour d'un schéma de circuit en `picture-elements`. Les fichiers sont versionnés dans ce dépôt et déployés par `deploy/deploy-ha.sh`, sur le modèle éprouvé de `sonnette-ring`.

**Tech Stack:** Home Assistant (paquets YAML, gabarits Jinja2), Lovelace (`sections`, `markdown`, `picture-elements`, Mushroom v5), SVG, shell POSIX pour le déploiement, Python 3 pour le générateur `gen_maison.py`.

**Spec:** `docs/superpowers/specs/2026-09-22-pac-tableau-home-assistant-design.md`

## Global Constraints

- **Préfixe des entités créées :** `sensor.pac_*` et `binary_sensor.pac_*`.
- **L'identifiant d'entité vient du `name` slugifié, jamais de l'`unique_id`** — constaté en
  Home Assistant 2026.9.3 le 22.09.2026. `name: "PAC température du sol"` donne
  `sensor.pac_temperature_du_sol` ; l'`unique_id` ne fait qu'ancrer l'entité dans le registre
  pour qu'on puisse la renommer ensuite. La clé `object_id`, qui forcerait l'identifiant, est
  refusée par le domaine `template`. **Conséquence tenue partout : on écrit le libellé français
  qu'on veut lire, et l'identifiant est son slug.** L'`unique_id` reprend ce même slug. Ne jamais
  raccourcir un libellé pour obtenir un identifiant : c'est le libellé que l'utilisateur lit.
- **Tout gabarit lit les états avec un défaut** — `float(0)`, `int(0)`, `has_value()`. Règle maison, énoncée en tête de `gen_maison.py` : rien ne doit planter au démarrage quand une entité est encore indisponible.
- **`relative_time()` rend l'anglais** et jure dans une interface française. Toute durée est formatée à la main, sur le modèle de `duree_fr()` dans `gen_maison.py`.
- **Jamais d'identité codée en dur.** Les tableaux sont partagés entre les comptes Renault et Violaine.
- **Seuils en dur dans le YAML**, chacun suivi du raisonnement et de sa provenance en commentaire. Aucun `input_number`, donc aucune section à ajouter dans `reglages.yaml`.
- **Français partout, accents compris**, y compris dans les commentaires YAML.
- **Un `verdict` doit recalculer sa grandeur avec EXACTEMENT le même arrondi que le `state`
  du capteur.** Sans cela le flottant les fait diverger : `17.4 - 15.4` vaut
  `1.9999999999999982`, donc l'état affiche `2.0 K` pendant que le verdict, qui compare la
  valeur brute à son seuil de 2, conclut « Très faible ». Constaté sur 192 combinaisons de
  dixièmes dans la plage 15–40 °C, avec des lectures de sonde ordinaires. Tout banc d'essai qui
  injecte une valeur déjà arrondie au lieu de repartir des lectures brutes est aveugle à ce
  défaut.
- **Les fichiers ne sont jamais édités sur p-cloud.** Source de vérité : ce dépôt. Déploiement par `deploy/deploy-ha.sh`.
- **Sens des sondes, établi le 22.09.2026 :** `flow_in_temperature` = **départ** (Vorlauf), `flow_out_temperature` = **retour** (Rücklauf). Preuve : `flow_out_temperature_target` vaut 15,0 et correspond exactement à `temperature_target_return` lu en direct sur la PAC, or la régulation Alpha Innotec pilote sur le retour. Confirmé par la lecture directe : `temperature_supply` 24,0 = `flow_in`, `temperature_return` 23,5 = `flow_out`.
- **La production d'eau chaude se détecte sur `sensor.…status == 'hot_water'`, jamais sur la
  seule pompe de charge.** Relevé le 22.09.2026 à 11 h 30, compresseur en marche et ballon en
  charge : `status` valait `hot_water` pendant que `binary_sensor.…dhw_charging_pump` valait
  **`off`**. Une cascade qui se fie à cette pompe annonce « Chauffe la maison » pendant une
  charge du ballon, et la phrase de causalité affirme alors que le compresseur comble un écart
  alors que le retour est 31 K au-dessus de sa consigne. La pompe reste en second terme d'un
  `or`, elle ne coûte rien.
- **Valeurs de `status` observées à ce jour :** `no_request` et `hot_water`. `heating` et
  `cooling` restent non observées.
- **État de panne :** `binary_sensor.…disturbance_output`, jamais `sensor.…error_reason`. Ce dernier vaut 721 sans discontinuer depuis au moins 5 jours alors que la PAC va bien : c'est la **dernière** erreur mémorisée, pas une erreur active.
- **Hôte :** p-cloud, conteneur `homeassistant`, configuration dans `/home/rjl/homelab/homeassistant/config` (montée sur `/config`).
- **API Home Assistant :** `https://ha.lab.crog.org`, jeton dans la variable d'environnement `$HA`.

---

### Task 1: Échafaudage — dépôt, déploiement, premier capteur

Cette tâche livre la chaîne complète de bout en bout avec un seul capteur trivial. Tant qu'elle ne passe pas, rien d'autre ne peut être vérifié.

**Files:**
- Create: `ha/packages/pac.yaml`
- Create: `deploy/deploy-ha.sh`
- Create: `deploy/deploy.env.example`
- Create: `deploy/deploy.env` (ignoré par git)
- Create: `deploy/render-template.sh`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: rien.
- Produces: `deploy/deploy-ha.sh` (déploie `ha/packages/pac.yaml` et, dès qu'il existe, `ha/dashboards/pac.yaml` et `ha/www/pac-circuit.svg`) ; `deploy/render-template.sh <fichier>` (rend un gabarit Jinja par l'API et écrit le résultat sur la sortie standard) ; l'entité `sensor.pac_temperature_du_sol`.

- [ ] **Step 1: Écrire le test — le gabarit du premier capteur**

Créer `/tmp/t-sol.j2` :

```jinja
{{ states('sensor.luxtronik_300722_07_heat_source_input_temperature') | float(0) | round(1) }}
```

- [ ] **Step 2: Lancer le test, constater qu'il échoue faute d'outil**

```bash
deploy/render-template.sh /tmp/t-sol.j2
```

Attendu : `deploy/render-template.sh: No such file or directory`.

- [ ] **Step 3: Écrire `deploy/render-template.sh`**

```sh
#!/bin/sh
# Rend un gabarit Jinja par l'API de Home Assistant et l'écrit sur la sortie
# standard. C'est le seul moyen de voir une erreur de gabarit autrement qu'en
# fouillant le journal après coup.
#
#   deploy/render-template.sh <fichier>
#   echo "{{ 1 + 1 }}" | deploy/render-template.sh -
#
# $HA : jeton de longue durée. $HA_API : URL de Home Assistant.
set -eu
: "${HA:?variable HA absente (jeton Home Assistant)}"
API="${HA_API:-https://ha.lab.crog.org}"
SRC="${1:?usage: render-template.sh <fichier>|-}"
if [ "$SRC" = "-" ]; then TPL=$(cat); else TPL=$(cat "$SRC"); fi
printf '%s' "$TPL" | python3 -c '
import json, os, sys, urllib.request
tpl = sys.stdin.read()
req = urllib.request.Request(
    os.environ.get("API") + "/api/template",
    data=json.dumps({"template": tpl}).encode(),
    headers={"Authorization": "Bearer " + os.environ["HA"],
             "Content-Type": "application/json"})
try:
    sys.stdout.write(urllib.request.urlopen(req, timeout=30).read().decode())
except urllib.error.HTTPError as e:
    sys.exit("gabarit refusé : " + e.read().decode()[:2000])
' API="$API"
echo
```

Puis `chmod +x deploy/render-template.sh`.

- [ ] **Step 4: Relancer le test, il doit passer**

```bash
HA_API=https://ha.lab.crog.org deploy/render-template.sh /tmp/t-sol.j2
```

Attendu : `23.9` (ou la valeur du moment, un nombre à une décimale — pas une erreur, pas `0.0`).

- [ ] **Step 5: Écrire le paquet minimal**

`ha/packages/pac.yaml` :

```yaml
# Pompe à chaleur géothermique Alpha Innotec — lecture expliquée.
#
# Ce paquet ne pilote rien. Il traduit les entités de l'intégration
# luxtronik2 (préfixe luxtronik_300722_07_, Alpha Innotec @
# 192.168.86.37:8889) en capteurs qu'on comprend sans connaître les sigles
# allemands. Le pilotage de la consigne ECS vit ailleurs, dans
# packages/ecs_solaire.yaml : ne pas écrire de consigne ici.
#
# SOURCE DE VÉRITÉ : dépôt chauffage, ha/packages/pac.yaml, déployé par
# deploy/deploy-ha.sh. Ne pas éditer sur p-cloud.
#
# Sens des sondes, établi le 22.09.2026 : flow_in = DÉPART (Vorlauf),
# flow_out = RETOUR (Rücklauf). flow_out_temperature_target vaut 15,0 et
# correspond à temperature_target_return lu en direct sur la PAC ; or la
# régulation Alpha Innotec pilote sur le retour. La lecture directe donne
# temperature_supply 24,0 (= flow_in) et temperature_return 23,5 (= flow_out).

template:
  - sensor:
      - name: "PAC température du sol"
        unique_id: pac_temperature_du_sol
        unit_of_measurement: "°C"
        device_class: temperature
        state_class: measurement
        icon: mdi:thermometer-water
        # La saumure qui REVIENT des capteurs enterrés : c'est elle qui porte
        # la chaleur prise au terrain. L'entité est désactivée par défaut dans
        # l'intégration ; activée le 22.09.2026.
        availability: "{{ has_value('sensor.luxtronik_300722_07_heat_source_input_temperature') }}"
        state: >-
          {{ states('sensor.luxtronik_300722_07_heat_source_input_temperature')
             | float(0) | round(1) }}
```

- [ ] **Step 6: Écrire `deploy/deploy.env.example` et `deploy/deploy.env`**

`deploy/deploy.env.example` :

```sh
# Copier vers deploy/deploy.env (ignoré par git) et remplir.
# Hôte Docker qui fait tourner Home Assistant (alias ssh).
HOST=p-cloud
# Dossier de configuration de Home Assistant sur cet hôte (monté sur /config).
HA_CONFIG=/home/rjl/homelab/homeassistant/config
# API de Home Assistant, vue depuis la machine qui déploie ($HA = jeton).
HA_API=https://ha.lab.crog.org
```

`deploy/deploy.env` : le même contenu, sans la première ligne de commentaire.

- [ ] **Step 7: Écrire `deploy/deploy-ha.sh`**

```sh
#!/bin/sh
# Déploie le côté Home Assistant : le paquet, le tableau de bord et le schéma
# du circuit. Sauvegarde horodatée de chaque fichier remplacé, puis
# check_config.
#
# NE REDÉMARRE RIEN. Après un exit 0 :
#   - paquet modifié        -> recharger « Toute la configuration YAML »
#                              (Outils de développement > YAML), ou
#     curl -X POST -H "Authorization: Bearer $HA" \
#          $HA_API/api/services/homeassistant/reload_all
#   - tableau modifié       -> actualiser la page (menu ⋮ > Actualiser)
#   - DÉCLARATION d'un nouveau tableau dans configuration.yaml
#                           -> redémarrer Home Assistant
#
# check_config NE VALIDE PAS les tableaux de bord. Leur rendu se vérifie au
# navigateur.
#
# Le dossier de configuration appartient à root : on y écrit à travers le
# conteneur (docker cp), pas par le volume monté.
set -eu
cd "$(dirname "$0")/.."
. deploy/deploy.env
STAMP=$(date +%Y-%m-%d-%H%M%S)

scp -q ha/packages/pac.yaml "$HOST:/tmp/pac-package.yaml"
COPIES="docker cp -q /tmp/pac-package.yaml homeassistant:/config/packages/pac.yaml"
SAUVES="packages/pac.yaml"

if [ -f ha/dashboards/pac.yaml ]; then
  scp -q ha/dashboards/pac.yaml "$HOST:/tmp/pac-dashboard.yaml"
  COPIES="$COPIES && docker cp -q /tmp/pac-dashboard.yaml homeassistant:/config/dashboards/pac.yaml"
  SAUVES="$SAUVES dashboards/pac.yaml"
fi
if [ -f ha/www/pac-circuit.svg ]; then
  scp -q ha/www/pac-circuit.svg "$HOST:/tmp/pac-circuit.svg"
  COPIES="$COPIES && docker cp -q /tmp/pac-circuit.svg homeassistant:/config/www/pac-circuit.svg"
fi

ssh "$HOST" "set -eu
  grep -q 'packages: !include_dir_named packages' '$HA_CONFIG/configuration.yaml' || {
    echo 'configuration.yaml ne charge pas packages/ (voir l en-tete de ce script)' >&2
    exit 1; }
  docker exec homeassistant sh -c '
    set -eu
    mkdir -p /config/packages /config/dashboards /config/www
    for f in $SAUVES; do
      if [ -f /config/\$f ]; then cp -p /config/\$f /config/\$f.bak-$STAMP; fi
    done'
  $COPIES
  rm -f /tmp/pac-package.yaml /tmp/pac-dashboard.yaml /tmp/pac-circuit.svg
  echo '== check_config'
  docker exec homeassistant python -m homeassistant --script check_config -c /config"
echo "OK. Recharger la configuration YAML dans Home Assistant."
```

Puis `chmod +x deploy/deploy-ha.sh`.

- [ ] **Step 8: Ignorer le fichier d'environnement**

Ajouter à `.gitignore` :

```
deploy/deploy.env
```

- [ ] **Step 9: Déployer**

```bash
deploy/deploy-ha.sh
```

Attendu : la ligne `== check_config`, puis `Testing configuration at /config` sans `ERROR`, puis `OK. Recharger la configuration YAML dans Home Assistant.`

- [ ] **Step 10: Recharger et vérifier que le capteur existe**

```bash
curl -s -X POST -H "Authorization: Bearer $HA" \
  https://ha.lab.crog.org/api/services/homeassistant/reload_all
curl -s -H "Authorization: Bearer $HA" \
  https://ha.lab.crog.org/api/states/sensor.pac_temperature_du_sol
```

Attendu : un JSON dont `state` est la température du sol (≈ 23.9), `unit_of_measurement` vaut `°C`, et **pas** `unknown` ni `unavailable`.

- [ ] **Step 11: Commit**

```bash
git add ha/packages/pac.yaml deploy/deploy-ha.sh deploy/deploy.env.example \
        deploy/render-template.sh .gitignore
git commit -m "Deploy a first heat pump sensor through a scripted pipeline"
```

---

### Task 2: L'état de la PAC, en français, et depuis combien de temps

**Files:**
- Modify: `ha/packages/pac.yaml`

**Interfaces:**
- Consumes: `deploy/deploy-ha.sh`, `deploy/render-template.sh` (Task 1).
- Produces: `sensor.pac_etat` (chaîne française, une valeur parmi : `Hors ligne`, `Erreur`, `Dégivre`, `Bloquée par le réseau`, `Fait l'eau chaude`, `Rafraîchit`, `Chauffe la maison`, `Au-dessus de la limite de chauffe`, `Au repos`) ; `sensor.pac_depuis` (durée française depuis le dernier changement de `sensor.pac_etat`, du genre `21 h`).

- [ ] **Step 1: Écrire le test du gabarit d'état**

Créer `/tmp/t-etat.j2` avec exactement le corps du futur `state:` :

```jinja
{% set lux = 'luxtronik_300722_07_' %}
{% set statut = states('sensor.' ~ lux ~ 'status') %}
{% if not has_value('sensor.' ~ lux ~ 'status') %}Hors ligne
{% elif is_state('binary_sensor.' ~ lux ~ 'disturbance_output', 'on') %}Erreur
{% elif is_state('binary_sensor.' ~ lux ~ 'defrost_valve', 'on') %}Dégivre
{% elif is_state('binary_sensor.' ~ lux ~ 'evu_unlocked', 'off') %}Bloquée par le réseau
{% elif statut == 'hot_water' or is_state('binary_sensor.' ~ lux ~ 'dhw_charging_pump', 'on') %}Fait l'eau chaude
{% elif statut == 'cooling' %}Rafraîchit
{% elif is_state('binary_sensor.' ~ lux ~ 'compressor', 'on') %}Chauffe la maison
{% elif statut == 'no_request' %}Au-dessus de la limite de chauffe
{% else %}Au repos{% endif %}
```

- [ ] **Step 2: Lancer le test et vérifier la valeur du moment**

```bash
deploy/render-template.sh /tmp/t-etat.j2
```

Attendu, dans les conditions du 22.09.2026 (compresseur arrêté, `status` = `no_request`, `disturbance_output` = `off`) : `Au-dessus de la limite de chauffe`.

Si la sortie est `Erreur`, le gabarit lit `error_reason` au lieu de `disturbance_output` : corriger. Si la sortie est `Au repos`, `status` ne vaut plus `no_request` — relever sa valeur réelle avec
`curl -s -H "Authorization: Bearer $HA" https://ha.lab.crog.org/api/states/sensor.luxtronik_300722_07_status`
et l'ajouter à la chaîne plutôt que de la laisser tomber dans le cas par défaut.

- [ ] **Step 3: Écrire le test du gabarit de durée**

Créer `/tmp/t-depuis.j2` :

```jinja
{% set d = (as_timestamp(now()) - as_timestamp(states.sensor.pac_temperature_du_sol.last_changed, as_timestamp(now()))) | int %}
{% if d < 60 %}moins d'une minute
{% elif d < 5400 %}{{ (d / 60) | round(0) | int }} min
{% elif d < 172800 %}{{ (d / 3600) | round(0) | int }} h
{% else %}{{ (d / 86400) | round(0) | int }} j{% endif %}
```

Ce gabarit vise `sensor.pac_temperature_du_sol` — qui existe depuis la tâche 1 — pour être testable avant que `sensor.pac_etat` n'existe.

- [ ] **Step 4: Lancer le test de durée**

```bash
deploy/render-template.sh /tmp/t-depuis.j2
```

Attendu : une durée française, du genre `3 min` ou `moins d'une minute`. Pas `unknown`, pas de texte anglais.

- [ ] **Step 5: Ajouter les deux capteurs au paquet**

Dans `ha/packages/pac.yaml`, **avant** la ligne `template:` existante, rien ne change ; ajouter sous `template:` un premier bloc `- triggers:` puis conserver le bloc `- sensor:` existant (syntaxe des déclencheurs de Home Assistant 2026.9, celle qu'emploient déjà `chaleur_etage.yaml` et `ecs_solaire.yaml`). Le fichier devient :

```yaml
template:
  # La durée dans l'état courant doit avancer toute seule, minute après
  # minute. Un capteur d'état ne se recalcule qu'au changement de ses
  # sources : il faut donc un déclencheur horaire.
  - triggers:
      - trigger: state
        entity_id: sensor.pac_etat
      - trigger: time_pattern
        minutes: "/1"
      - trigger: homeassistant
        event: start
    sensor:
      - name: "PAC depuis"
        unique_id: pac_depuis
        icon: mdi:timer-sand
        # relative_time() rend l'anglais (« 14 hours »), ce qui jure dans une
        # interface française : la durée est formatée à la main, comme
        # duree_fr() dans gen_maison.py.
        state: >-
          {% set d = (as_timestamp(now())
             - as_timestamp(states.sensor.pac_etat.last_changed, as_timestamp(now()))) | int %}
          {% if d < 60 %}moins d'une minute
          {% elif d < 5400 %}{{ (d / 60) | round(0) | int }} min
          {% elif d < 172800 %}{{ (d / 3600) | round(0) | int }} h
          {% else %}{{ (d / 86400) | round(0) | int }} j{% endif %}

  - sensor:
      - name: "PAC état"
        unique_id: pac_etat
        # L'icône suit une règle plus courte que l'état : la dupliquer en
        # entier n'apporterait rien.
        icon: >-
          {% set lux = 'luxtronik_300722_07_' %}
          {% if not has_value('sensor.' ~ lux ~ 'status') %}mdi:lan-disconnect
          {% elif is_state('binary_sensor.' ~ lux ~ 'disturbance_output', 'on') %}mdi:alert-circle
          {% elif is_state('binary_sensor.' ~ lux ~ 'defrost_valve', 'on') %}mdi:snowflake-melt
          {% elif statut == 'hot_water' or is_state('binary_sensor.' ~ lux ~ 'dhw_charging_pump', 'on') %}mdi:water-boiler
          {% elif is_state('binary_sensor.' ~ lux ~ 'compressor', 'on') %}mdi:heat-wave
          {% else %}mdi:sleep{% endif %}
        # ÉTAT DE PANNE : disturbance_output, jamais error_reason. Ce dernier
        # vaut 721 sans discontinuer depuis au moins 5 jours (relevé du
        # 22.09.2026) alors que la PAC va bien : c'est la DERNIÈRE erreur
        # mémorisée, pas une erreur active.
        #
        # « Au-dessus de la limite de chauffe » mérite d'être un état à part :
        # c'est la réponse à « pourquoi elle ne chauffe pas ? » un jour doux.
        # La PAC l'annonce elle-même — lecture directe du 22.09.2026 :
        # « Heizgrenze (Soll 15 °C) ».
        #
        # La valeur 'cooling' de status n'a PAS été observée : sur les 5 jours
        # précédant le 22.09.2026, status ne prend que 'no_request'. À
        # confirmer au premier rafraîchissement.
        state: >-
          {% set lux = 'luxtronik_300722_07_' %}
          {% set statut = states('sensor.' ~ lux ~ 'status') %}
          {% if not has_value('sensor.' ~ lux ~ 'status') %}Hors ligne
          {% elif is_state('binary_sensor.' ~ lux ~ 'disturbance_output', 'on') %}Erreur
          {% elif is_state('binary_sensor.' ~ lux ~ 'defrost_valve', 'on') %}Dégivre
          {% elif is_state('binary_sensor.' ~ lux ~ 'evu_unlocked', 'off') %}Bloquée par le réseau
          {% elif statut == 'hot_water' or is_state('binary_sensor.' ~ lux ~ 'dhw_charging_pump', 'on') %}Fait l'eau chaude
          {% elif statut == 'cooling' %}Rafraîchit
          {% elif is_state('binary_sensor.' ~ lux ~ 'compressor', 'on') %}Chauffe la maison
          {% elif statut == 'no_request' %}Au-dessus de la limite de chauffe
          {% else %}Au repos{% endif %}

      - name: "PAC température du sol"
        unique_id: pac_temperature_du_sol
        unit_of_measurement: "°C"
        device_class: temperature
        state_class: measurement
        icon: mdi:thermometer-water
        availability: "{{ has_value('sensor.luxtronik_300722_07_heat_source_input_temperature') }}"
        state: >-
          {{ states('sensor.luxtronik_300722_07_heat_source_input_temperature')
             | float(0) | round(1) }}
```

- [ ] **Step 6: Déployer et recharger**

```bash
deploy/deploy-ha.sh && curl -s -X POST -H "Authorization: Bearer $HA" \
  https://ha.lab.crog.org/api/services/homeassistant/reload_all
```

Attendu : `check_config` sans `ERROR`.

- [ ] **Step 7: Vérifier les deux entités**

```bash
for e in sensor.pac_etat sensor.pac_depuis; do
  curl -s -H "Authorization: Bearer $HA" "https://ha.lab.crog.org/api/states/$e" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["entity_id"], "->", repr(d["state"]))'
done
```

Attendu : `sensor.pac_etat -> 'Au-dessus de la limite de chauffe'` et `sensor.pac_depuis -> 'moins d'une minute'` (le capteur vient de naître).

- [ ] **Step 8: Commit**

```bash
git add ha/packages/pac.yaml
git commit -m "Translate the heat pump state into French, with its duration"
```

---

### Task 3: La phrase de causalité

**Files:**
- Modify: `ha/packages/pac.yaml`

**Interfaces:**
- Consumes: `sensor.pac_etat` (Task 2).
- Produces: `sensor.pac_explication` — une phrase française qui explique l'état courant.

- [ ] **Step 1: Écrire le test du gabarit**

Créer `/tmp/t-explication.j2` :

```jinja
{% set lux = 'luxtronik_300722_07_' %}
{% set ext = states('sensor.' ~ lux ~ 'outdoor_temperature') | float(0) | round(1) %}
{% set depart = states('sensor.' ~ lux ~ 'flow_in_temperature') | float(0) | round(1) %}
{% set retour = states('sensor.' ~ lux ~ 'flow_out_temperature') | float(0) | round(1) %}
{% set cible = states('sensor.' ~ lux ~ 'flow_out_temperature_target') | float(0) | round(1) %}
{% set ballon = states('sensor.' ~ lux ~ 'dhw_temperature') | float(0) | round(1) %}
{% set consigne = states('number.' ~ lux ~ 'dhw_target_temperature') | float(0) | round(0) | int %}
{% set boost = is_state('input_boolean.ecs_solaire_boost_actif', 'on') %}
{% set etat = states('sensor.pac_etat') %}
{% if etat == 'Hors ligne' %}
  La pompe à chaleur ne répond plus. Les valeurs affichées datent de sa dernière réponse.
{% elif etat == 'Erreur' %}
  La pompe à chaleur signale un défaut. Code de la dernière erreur : {{ states('sensor.' ~ lux ~ 'error_reason') }}.
{% elif etat == 'Bloquée par le réseau' %}
  Le fournisseur d'électricité a coupé l'autorisation de marche. La PAC reprendra d'elle-même.
{% elif etat == 'Fait l\'eau chaude' %}
  Le ballon est à {{ ballon }} °C, la consigne est {{ consigne }} °C{% if boost %} — relevée pour absorber le surplus solaire{% endif %}. La PAC charge l'eau chaude ; le chauffage reprendra ensuite.
{% elif etat == 'Chauffe la maison' %}
  Il fait {{ ext }} °C dehors. La courbe vise {{ cible }} °C au retour ; le retour est à {{ retour }} °C, le départ à {{ depart }} °C. Le compresseur tourne pour combler l'écart.
{% elif etat == 'Dégivre' %}
  La PAC dégivre son échangeur. C'est passager.
{% elif etat == 'Rafraîchit' %}
  La PAC envoie la fraîcheur du sol dans le plancher. Départ {{ depart }} °C, retour {{ retour }} °C.
{% elif etat == 'Au-dessus de la limite de chauffe' %}
  Il fait {{ ext }} °C dehors, au-dessus de la limite de chauffe : la PAC ne demande rien. Le plancher est à {{ retour }} °C au retour.
{% else %}
  Rien ne tourne. Il fait {{ ext }} °C dehors, le retour du plancher est à {{ retour }} °C.
{% endif %}
```

- [ ] **Step 2: Lancer le test**

```bash
deploy/render-template.sh /tmp/t-explication.j2
```

Attendu, au 22.09.2026 : `Il fait 11.6 °C dehors, au-dessus de la limite de chauffe : la PAC ne demande rien. Le plancher est à 23.5 °C au retour.`

Vérifier en particulier que **le retour vaut bien la valeur la plus basse** des deux (23,5 contre 24,0 au départ). Si départ et retour paraissent inversés, la contrainte globale sur le sens des sondes a été mal appliquée.

- [ ] **Step 3: Ajouter le capteur au paquet**

Dans `ha/packages/pac.yaml`, sous le bloc `- sensor:`, juste après `PAC état`, insérer :

```yaml
      - name: "PAC explication"
        unique_id: pac_explication
        icon: mdi:text-long
        # La régulation Alpha Innotec pilote sur le RETOUR, ce qui rend la
        # chaîne de causalité lisible : consigne de retour contre retour réel.
        # Quand ecs_solaire a relevé la consigne du ballon, la phrase le dit —
        # sinon une consigne à 55 °C au lieu de 54 paraîtrait inexpliquée.
        state: >-
          {% set lux = 'luxtronik_300722_07_' %}
          {% set ext = states('sensor.' ~ lux ~ 'outdoor_temperature') | float(0) | round(1) %}
          {% set depart = states('sensor.' ~ lux ~ 'flow_in_temperature') | float(0) | round(1) %}
          {% set retour = states('sensor.' ~ lux ~ 'flow_out_temperature') | float(0) | round(1) %}
          {% set cible = states('sensor.' ~ lux ~ 'flow_out_temperature_target') | float(0) | round(1) %}
          {% set ballon = states('sensor.' ~ lux ~ 'dhw_temperature') | float(0) | round(1) %}
          {% set consigne = states('number.' ~ lux ~ 'dhw_target_temperature') | float(0) | round(0) | int %}
          {% set boost = is_state('input_boolean.ecs_solaire_boost_actif', 'on') %}
          {% set etat = states('sensor.pac_etat') %}
          {% if etat == 'Hors ligne' %}La pompe à chaleur ne répond plus. Les valeurs affichées datent de sa dernière réponse.
          {% elif etat == 'Erreur' %}La pompe à chaleur signale un défaut. Code de la dernière erreur : {{ states('sensor.' ~ lux ~ 'error_reason') }}.
          {% elif etat == 'Bloquée par le réseau' %}Le fournisseur d'électricité a coupé l'autorisation de marche. La PAC reprendra d'elle-même.
          {% elif etat == 'Fait l\'eau chaude' %}Le ballon est à {{ ballon }} °C, la consigne est {{ consigne }} °C{% if boost %} — relevée pour absorber le surplus solaire{% endif %}. La PAC charge l'eau chaude ; le chauffage reprendra ensuite.
          {% elif etat == 'Chauffe la maison' %}Il fait {{ ext }} °C dehors. La courbe vise {{ cible }} °C au retour ; le retour est à {{ retour }} °C, le départ à {{ depart }} °C. Le compresseur tourne pour combler l'écart.
          {% elif etat == 'Dégivre' %}La PAC dégivre son échangeur. C'est passager.
          {% elif etat == 'Rafraîchit' %}La PAC envoie la fraîcheur du sol dans le plancher. Départ {{ depart }} °C, retour {{ retour }} °C.
          {% elif etat == 'Au-dessus de la limite de chauffe' %}Il fait {{ ext }} °C dehors, au-dessus de la limite de chauffe : la PAC ne demande rien. Le plancher est à {{ retour }} °C au retour.
          {% else %}Rien ne tourne. Il fait {{ ext }} °C dehors, le retour du plancher est à {{ retour }} °C.{% endif %}
```

- [ ] **Step 4: Déployer, recharger et vérifier**

```bash
deploy/deploy-ha.sh && curl -s -X POST -H "Authorization: Bearer $HA" \
  https://ha.lab.crog.org/api/services/homeassistant/reload_all
sleep 3
curl -s -H "Authorization: Bearer $HA" \
  https://ha.lab.crog.org/api/states/sensor.pac_explication \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["state"])'
```

Attendu : la même phrase qu'à l'étape 2. Un état `unknown` signifie que le gabarit a levé une exception — la chercher dans `home-assistant.log`.

**Attention à la longueur :** l'état d'une entité Home Assistant est plafonné à 255 caractères. La phrase la plus longue (`Chauffe la maison`) fait environ 150 caractères ; si une modification la rallonge, elle sera tronquée sans avertissement. Vérifier avec `| wc -c`.

- [ ] **Step 5: Commit**

```bash
git add ha/packages/pac.yaml
git commit -m "Explain in one sentence why the heat pump is doing what it does"
```

---

### Task 4: Les deux écarts, et pourquoi ils se taisent à l'arrêt

**Files:**
- Modify: `ha/packages/pac.yaml`

**Interfaces:**
- Consumes: rien des tâches précédentes.
- Produces: `sensor.pac_ecart_chauffage` et `sensor.pac_ecart_source` (nombres en K, `unavailable` compresseur à l'arrêt), chacun avec un attribut `verdict` (chaîne française).

- [ ] **Step 1: Écrire le test de la disponibilité**

Créer `/tmp/t-dispo.j2` :

```jinja
compresseur={{ states('binary_sensor.luxtronik_300722_07_compressor') }}
ecart_chauffage_brut={{ (states('sensor.luxtronik_300722_07_flow_in_temperature') | float(0)
  - states('sensor.luxtronik_300722_07_flow_out_temperature') | float(0)) | round(1) }}
ecart_source_brut={{ (states('sensor.luxtronik_300722_07_heat_source_input_temperature') | float(0)
  - states('sensor.luxtronik_300722_07_heat_source_output_temperature') | float(0)) | round(1) }}
```

- [ ] **Step 2: Lancer le test et constater pourquoi la disponibilité est nécessaire**

```bash
deploy/render-template.sh /tmp/t-dispo.j2
```

Attendu au 22.09.2026 : `compresseur=off`, `ecart_chauffage_brut=0.5`, `ecart_source_brut=-0.1`.

Un écart source **négatif** est physiquement impossible en marche — on ne rend pas de chaleur au sol en chauffant. C'est ce que mesure un circuit à l'arrêt dont les sondes s'équilibrent. D'où l'`availability:` de l'étape suivante : sans elle, le tableau annoncerait un verdict sur du bruit.

- [ ] **Step 3: Ajouter les deux capteurs au paquet**

Dans `ha/packages/pac.yaml`, sous le bloc `- sensor:`, après `PAC explication` :

```yaml
      # LES DEUX ÉCARTS NE VEULENT RIEN DIRE COMPRESSEUR À L'ARRÊT : l'eau
      # stagne et les sondes s'équilibrent. Relevé du 22.09.2026, tout le
      # circuit à 24 °C, saumure comprise : l'écart source valait -0,1 K,
      # physiquement impossible en marche. D'où l'availability.
      #
      # SEUILS : valeurs de départ tirées de la littérature sur les planchers
      # chauffants en géothermie, PAS de mesures sur cette installation — les
      # compteurs ont été remis à zéro avec le nouveau système et rien n'a
      # encore été observé en marche. À revoir après une saison de chauffe.
      - name: "PAC écart chauffage"
        unique_id: pac_ecart_chauffage
        unit_of_measurement: "K"
        state_class: measurement
        icon: mdi:delta
        availability: >-
          {{ is_state('binary_sensor.luxtronik_300722_07_compressor', 'on')
             and has_value('sensor.luxtronik_300722_07_flow_in_temperature')
             and has_value('sensor.luxtronik_300722_07_flow_out_temperature') }}
        state: >-
          {{ (states('sensor.luxtronik_300722_07_flow_in_temperature') | float(0)
              - states('sensor.luxtronik_300722_07_flow_out_temperature') | float(0)) | round(1) }}
        attributes:
          # 3 à 7 K : plage usuelle d'un plancher chauffant. Sous 2 K, la
          # circulation est trop rapide ou la PAC module à vide ; au-dessus de
          # 8 K, le débit est trop faible.
          verdict: >-
            {% set d = (states('sensor.luxtronik_300722_07_flow_in_temperature') | float(0)
                        - states('sensor.luxtronik_300722_07_flow_out_temperature') | float(0)) | round(1) %}
            {% if d < 2 %}Très faible : la circulation est rapide, ou la PAC module à vide.
            {% elif d <= 7 %}Normal pour un plancher chauffant.
            {% elif d <= 8 %}Un peu élevé : le débit commence à manquer.
            {% else %}Élevé : le débit du circuit est trop faible.{% endif %}

      - name: "PAC écart source"
        unique_id: pac_ecart_source
        unit_of_measurement: "K"
        state_class: measurement
        icon: mdi:earth
        availability: >-
          {{ is_state('binary_sensor.luxtronik_300722_07_compressor', 'on')
             and has_value('sensor.luxtronik_300722_07_heat_source_input_temperature')
             and has_value('sensor.luxtronik_300722_07_heat_source_output_temperature') }}
        state: >-
          {{ (states('sensor.luxtronik_300722_07_heat_source_input_temperature') | float(0)
              - states('sensor.luxtronik_300722_07_heat_source_output_temperature') | float(0)) | round(1) }}
        attributes:
          # 2 à 5 K : plage usuelle. Au-dessus de 6 K, soit le débit de saumure
          # faiblit, soit le terrain ne rend plus assez.
          verdict: >-
            {% set d = (states('sensor.luxtronik_300722_07_heat_source_input_temperature') | float(0)
                        - states('sensor.luxtronik_300722_07_heat_source_output_temperature') | float(0)) | round(1) %}
            {% if d < 2 %}Faible : on prend peu de chaleur au terrain.
            {% elif d <= 5 %}Normal : le terrain rend bien.
            {% elif d <= 6 %}Un peu élevé : à surveiller.
            {% else %}Élevé : débit de saumure faible, ou terrain qui ne suit plus.{% endif %}
```

- [ ] **Step 4: Ajouter le verdict sur la température du sol**

Toujours dans `ha/packages/pac.yaml`, au capteur `PAC température du sol` existant, ajouter sous son `state:` :

```yaml
        attributes:
          # Au-dessus de 0 °C en saison de chauffe, confortable ; sous -5 °C,
          # le terrain est sollicité au-delà de sa plage habituelle. Ce
          # verdict-là reste valable à l'arrêt : c'est une température, pas un
          # écart.
          verdict: >-
            {% set t = states('sensor.luxtronik_300722_07_heat_source_input_temperature') | float(0) | round(1) %}
            {% if t < -5 %}Très froid : le terrain est sollicité au-delà de sa plage habituelle.
            {% elif t < 0 %}Froid, mais dans la plage d'une fin d'hiver.
            {% elif t < 15 %}Normal pour un terrain en saison de chauffe.
            {% else %}Tiède : le terrain s'est rechargé, typique de l'été.{% endif %}
```

- [ ] **Step 5: Déployer, recharger et vérifier que les écarts sont bien indisponibles**

```bash
deploy/deploy-ha.sh && curl -s -X POST -H "Authorization: Bearer $HA" \
  https://ha.lab.crog.org/api/services/homeassistant/reload_all
sleep 3
for e in sensor.pac_ecart_chauffage sensor.pac_ecart_source sensor.pac_temperature_du_sol; do
  curl -s -H "Authorization: Bearer $HA" "https://ha.lab.crog.org/api/states/$e" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["entity_id"], "->", d["state"], "|", d["attributes"].get("verdict","(pas de verdict)"))'
done
```

Attendu, compresseur à l'arrêt : les deux écarts à `unavailable`, et `sensor.pac_temperature_du_sol` à ≈ 23.9 avec le verdict « Tiède : le terrain s'est rechargé, typique de l'été. »

C'est le résultat recherché : **`unavailable` est le succès de cette tâche**, pas son échec.

- [ ] **Step 6: Commit**

```bash
git add ha/packages/pac.yaml
git commit -m "Measure both temperature spreads, and silence them at rest"
```

---

### Task 5: Les COP et le cycle moyen

**Files:**
- Modify: `ha/packages/pac.yaml`

**Interfaces:**
- Consumes: rien des tâches précédentes.
- Produces: `sensor.pac_rendement_eau_chaude`, `sensor.pac_rendement_chauffage`, `sensor.pac_rendement_instantane`, `sensor.pac_cycle_moyen` — chacun avec un attribut `verdict`.

- [ ] **Step 1: Écrire le test des quatre calculs**

Créer `/tmp/t-cop.j2` :

```jinja
{% set lux = 'luxtronik_300722_07_' %}
{% set ecs_out = states('sensor.' ~ lux ~ 'dhw_heat_amount') | float(0) %}
{% set ecs_in = states('sensor.' ~ lux ~ 'dhw_energy_input') | float(0) %}
{% set ch_out = states('sensor.' ~ lux ~ 'heat_amount_heating') | float(0) %}
{% set ch_in = states('sensor.' ~ lux ~ 'heat_energy_input') | float(0) %}
{% set w_out = states('sensor.' ~ lux ~ 'current_heat_output') | float(0) %}
{% set w_in = states('sensor.' ~ lux ~ 'current_power_consumption') | float(0) %}
{% set h = states('sensor.' ~ lux ~ 'compressor1_operation_hours') | float(0) %}
{% set n = states('sensor.' ~ lux ~ 'compressor1_impulses') | int(0) %}
cop_ecs={{ (ecs_out / ecs_in) | round(2) if ecs_in > 0.1 else 'indisponible' }}
cop_chauffage={{ (ch_out / ch_in) | round(2) if ch_out > 0.1 and ch_in > 0.1 else 'indisponible' }}
cop_instant={{ (w_out / w_in) | round(2) if w_in > 100 else 'indisponible' }}
cycle_moyen={{ (h * 60 / n) | round(0) | int if n >= 10 else 'indisponible' }}
```

- [ ] **Step 2: Lancer le test**

```bash
deploy/render-template.sh /tmp/t-cop.j2
```

Attendu au 22.09.2026 :

```
cop_ecs=3.64
cop_chauffage=indisponible
cop_instant=indisponible
cycle_moyen=indisponible
```

`cop_ecs=3.64` est le contrôle qui compte : 15,0 kWh produits ÷ 4,12 kWh consommés. Le vérifier à la main. Les trois `indisponible` sont **également des succès** : le COP chauffage n'a pas de base saine (`heat_amount_heating` vaut 0 pour `heat_energy_input` 52,86 — ce compteur-là n'a pas été remis à zéro), le COP instantané exige que le compresseur tourne, et le cycle moyen exige dix démarrages quand il n'y en a eu que deux.

- [ ] **Step 3: Ajouter les quatre capteurs au paquet**

Dans `ha/packages/pac.yaml`, sous le bloc `- sensor:`, après `PAC écart source` :

```yaml
      # LES COP SONT CALCULÉS ICI, jamais lus depuis sensor.…cop_dhw ni
      # sensor.…cop_heating : ces deux entités de l'intégration lisent
      # « unknown » alors que leurs deux ingrédients sont présents et à jour
      # (vérifié le 22.09.2026). L'intégration ne fait pas le calcul.
      #
      # La PAC estime elle-même sa consommation électrique — il n'existe aucun
      # compteur dédié, les trois phases mesurées sont globales. Cette
      # estimation est corroborée : 4,12 kWh sur 1,56 h font 2,64 kW de tirage
      # moyen, en plein dans la fourchette « 2,4 kW au démarrage, 3,3 kW en fin
      # de cycle » relevée les 20 et 21.09.2026 et consignée en tête de
      # packages/ecs_solaire.yaml. Deux sources indépendantes qui concordent.
      - name: "PAC rendement eau chaude"
        unique_id: pac_rendement_eau_chaude
        state_class: measurement
        icon: mdi:water-boiler
        availability: >-
          {{ states('sensor.luxtronik_300722_07_dhw_energy_input') | float(0) > 0.1 }}
        state: >-
          {{ (states('sensor.luxtronik_300722_07_dhw_heat_amount') | float(0)
              / states('sensor.luxtronik_300722_07_dhw_energy_input') | float(1)) | round(2) }}
        attributes:
          verdict: >-
            {% set c = (states('sensor.luxtronik_300722_07_dhw_heat_amount') | float(0)
                       / states('sensor.luxtronik_300722_07_dhw_energy_input') | float(1)) | round(2) %}
            {% if c >= 4 %}Très bon pour de l'eau chaude.
            {% elif c >= 3 %}Correct : chauffer à 54 °C coûte toujours plus que chauffer un plancher.
            {% else %}Faible : la PAC peine à monter le ballon.{% endif %}

      # PAS DE BASE SAINE TANT QUE heat_amount_heating VAUT 0. Au 22.09.2026 il
      # vaut 0 kWh et operation_hours_heating 0 h — la PAC n'a pas chauffé la
      # maison depuis la remise à zéro — mais heat_energy_input affiche
      # 52,86 kWh. Un compteur d'entrée qui tourne pour une sortie nulle est
      # incohérent : celui-là n'a pas été remis à zéro avec les autres.
      # Annoncer un rendement de 0 serait un mensonge, d'où l'availability.
      - name: "PAC rendement chauffage"
        unique_id: pac_rendement_chauffage
        state_class: measurement
        icon: mdi:radiator
        availability: >-
          {{ states('sensor.luxtronik_300722_07_heat_amount_heating') | float(0) > 0.1
             and states('sensor.luxtronik_300722_07_heat_energy_input') | float(0) > 0.1 }}
        state: >-
          {{ (states('sensor.luxtronik_300722_07_heat_amount_heating') | float(0)
              / states('sensor.luxtronik_300722_07_heat_energy_input') | float(1)) | round(2) }}
        attributes:
          verdict: >-
            {% set c = (states('sensor.luxtronik_300722_07_heat_amount_heating') | float(0)
                       / states('sensor.luxtronik_300722_07_heat_energy_input') | float(1)) | round(2) %}
            {% if c >= 4.5 %}Excellent pour de la géothermie sur plancher.
            {% elif c >= 4 %}Bon.
            {% elif c >= 3 %}Moyen : la courbe de chauffe est peut-être trop haute.
            {% else %}Faible : à regarder de près.{% endif %}

      # NON VÉRIFIÉ AU 22.09.2026 : current_heat_output et
      # current_power_consumption lisent 0 W, compresseur arrêté depuis 21 h.
      # Rien ne prouve encore qu'ils renvoient de vraies valeurs en marche.
      # À confirmer à la première chauffe.
      - name: "PAC rendement instantané"
        unique_id: pac_rendement_instantane
        state_class: measurement
        icon: mdi:speedometer
        availability: >-
          {{ states('sensor.luxtronik_300722_07_current_power_consumption') | float(0) > 100 }}
        state: >-
          {{ (states('sensor.luxtronik_300722_07_current_heat_output') | float(0)
              / states('sensor.luxtronik_300722_07_current_power_consumption') | float(1)) | round(2) }}
        attributes:
          verdict: >-
            {% set c = (states('sensor.luxtronik_300722_07_current_heat_output') | float(0)
                       / states('sensor.luxtronik_300722_07_current_power_consumption') | float(1)) | round(2) %}
            {% if c >= 4 %}Bon rendement en ce moment.
            {% elif c >= 3 %}Rendement moyen en ce moment.
            {% else %}Rendement faible en ce moment.{% endif %}

      # Durée moyenne d'un cycle de compresseur. Exige dix démarrages : au
      # 22.09.2026 il n'y en a eu que deux pour 1,56 h de marche, les compteurs
      # ayant été remis à zéro avec le nouveau système. Une moyenne sur deux
      # démarrages ne vaut rien.
      - name: "PAC cycle moyen"
        unique_id: pac_cycle_moyen
        unit_of_measurement: "min"
        state_class: measurement
        icon: mdi:restart
        availability: >-
          {{ states('sensor.luxtronik_300722_07_compressor1_impulses') | int(0) >= 10 }}
        state: >-
          {{ (states('sensor.luxtronik_300722_07_compressor1_operation_hours') | float(0) * 60
              / states('sensor.luxtronik_300722_07_compressor1_impulses') | int(1)) | round(0) | int }}
        attributes:
          verdict: >-
            {% set m = (states('sensor.luxtronik_300722_07_compressor1_operation_hours') | float(0) * 60
                       / states('sensor.luxtronik_300722_07_compressor1_impulses') | int(1)) | round(0) | int %}
            {% if m >= 20 %}Cycles longs : c'est sain pour le compresseur.
            {% elif m >= 10 %}Cycles acceptables.
            {% else %}Cycles courts : ils usent le compresseur.{% endif %}
```

- [ ] **Step 4: Déployer, recharger et vérifier**

```bash
deploy/deploy-ha.sh && curl -s -X POST -H "Authorization: Bearer $HA" \
  https://ha.lab.crog.org/api/services/homeassistant/reload_all
sleep 3
for e in sensor.pac_rendement_eau_chaude sensor.pac_rendement_chauffage sensor.pac_rendement_instantane sensor.pac_cycle_moyen; do
  curl -s -H "Authorization: Bearer $HA" "https://ha.lab.crog.org/api/states/$e" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["entity_id"], "->", d["state"], "|", d["attributes"].get("verdict",""))'
done
```

Attendu : `sensor.pac_rendement_eau_chaude -> 3.64 | Correct : chauffer à 54 °C coûte toujours plus que chauffer un plancher.` et les trois autres à `unavailable`.

- [ ] **Step 5: Commit**

```bash
git add ha/packages/pac.yaml
git commit -m "Compute the three COPs and the mean compressor cycle"
```

---

### Task 6: Le schéma du circuit

**Files:**
- Create: `ha/www/pac-circuit.svg`

**Interfaces:**
- Consumes: `deploy/deploy-ha.sh` (Task 1), qui déploie le SVG s'il existe.
- Produces: `/local/pac-circuit.svg`, fond de la carte `picture-elements` de la tâche 7.

**Contrat des repères, en % (gauche/haut), établi et vérifié au calque le 22.09.2026** — un
rectangle de 60×18 px, taille d'une étiquette réelle, posé à chaque coordonnée : aucun ne
chevauche un trait, aucun ne flotte dans le vide.

| repère | % | désigne |
|---|---|---|
| sol | 12/67 | bande libre en haut du bloc de terre |
| saumure retour | 27/70 | le tuyau qui vient du sol |
| saumure aller | 27/90 | le tuyau qui repart au sol |
| PAC | 50/50 | entre le titre et le cercle du compresseur |
| gaz chaud | 50/62 | dans le cercle, laissé creux pour cela |
| départ | 68/38 | au-dessus du tronc, loin du point de dérivation |
| retour | 68/70 | au-dessus du tuyau de retour |
| ballon | 90/22 | dans le ballon |
| plancher | 90/85 | bande libre sous la boucle du plancher |

Deux marges étroites : « gaz chaud » ne dispose que de 68 px de large, « PAC » que de 66 px de
haut — un texte sur deux lignes y toucherait le titre ou le cercle.

- [ ] **Step 1: Écrire le SVG**

`ha/www/pac-circuit.svg` — `viewBox` 800×400, sans dimensions fixes pour qu'il s'adapte à la largeur de la carte :

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" role="img"
     aria-label="Circuit de la pompe à chaleur géothermique">
  <!-- Schéma de fond de la carte picture-elements du tableau PAC.
       Aucune valeur n'est écrite ici : les températures et les pompes sont
       posées par-dessus par la carte, en positionnement pourcentage.
       Les teintes sont portées par le SVG lui-même et non héritées du thème :
       picture-elements sert cette image comme une image, elle ne suit pas le
       mode clair ou sombre. Elles sont donc choisies pour tenir sur les deux.
       Repères de position en % : voir l'en-tête de la tâche 6 du plan. -->
  <defs>
    <marker id="fleche" viewBox="0 0 10 10" refX="8" refY="5"
            markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8"/>
    </marker>
  </defs>

  <!-- Le sol -->
  <rect x="20" y="250" width="160" height="130" rx="8" fill="#78350f" opacity="0.35"/>
  <text x="100" y="242" text-anchor="middle" font-family="sans-serif"
        font-size="15" fill="#94a3b8">Le sol</text>
  <path d="M40 290 h120 M40 320 h120 M40 350 h120" stroke="#0ea5e9"
        stroke-width="5" fill="none" stroke-linecap="round" opacity="0.8"/>

  <!-- Saumure : du sol vers la PAC, puis retour au sol -->
  <path d="M180 290 H300" stroke="#0ea5e9" stroke-width="5" fill="none"
        marker-end="url(#fleche)"/>
  <path d="M300 350 H180" stroke="#38bdf8" stroke-width="5" fill="none"
        marker-end="url(#fleche)" opacity="0.7"/>

  <!-- La pompe à chaleur -->
  <rect x="300" y="120" width="200" height="230" rx="14" fill="#1e293b"
        stroke="#475569" stroke-width="3"/>
  <text x="400" y="150" text-anchor="middle" font-family="sans-serif"
        font-size="16" fill="#e2e8f0">Pompe à chaleur</text>
  <circle cx="400" cy="250" r="34" fill="none" stroke="#f59e0b" stroke-width="4"/>
  <text x="400" y="256" text-anchor="middle" font-family="sans-serif"
        font-size="13" fill="#f59e0b">compresseur</text>

  <!-- Départ vers la maison, retour de la maison -->
  <path d="M500 170 H660" stroke="#ef4444" stroke-width="5" fill="none"
        marker-end="url(#fleche)"/>
  <path d="M660 300 H500" stroke="#60a5fa" stroke-width="5" fill="none"
        marker-end="url(#fleche)"/>

  <!-- Le ballon d'eau chaude -->
  <rect x="660" y="40" width="110" height="130" rx="40" fill="#7c2d12"
        opacity="0.45" stroke="#fb923c" stroke-width="3"/>
  <text x="715" y="32" text-anchor="middle" font-family="sans-serif"
        font-size="15" fill="#94a3b8">Ballon</text>

  <!-- Le plancher chauffant -->
  <rect x="660" y="250" width="110" height="110" rx="8" fill="#0f172a"
        stroke="#475569" stroke-width="3"/>
  <path d="M676 276 h78 M676 300 h78 M676 324 h78" stroke="#ef4444"
        stroke-width="4" fill="none" stroke-linecap="round" opacity="0.75"/>
  <text x="715" y="378" text-anchor="middle" font-family="sans-serif"
        font-size="15" fill="#94a3b8">Plancher</text>

  <!-- Dérivation du départ vers le ballon -->
  <path d="M600 170 V105 H660" stroke="#ef4444" stroke-width="5" fill="none"
        marker-end="url(#fleche)" opacity="0.85"/>
</svg>
```

- [ ] **Step 2: Vérifier que le SVG est bien formé**

```bash
python3 -c "import xml.dom.minidom,sys; xml.dom.minidom.parse('ha/www/pac-circuit.svg'); print('SVG bien formé')"
```

Attendu : `SVG bien formé`. Une erreur d'analyse signale une balise mal fermée.

- [ ] **Step 3: Déployer et vérifier qu'il est servi**

```bash
deploy/deploy-ha.sh
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  -H "Authorization: Bearer $HA" https://ha.lab.crog.org/local/pac-circuit.svg
```

Attendu : `200 image/svg+xml`.

Si la réponse est `404`, Home Assistant met en cache le contenu de `www/` au démarrage : un fichier nouvellement ajouté demande un redémarrage. Le faire ici évite d'avoir à le refaire en tâche 7 :

```bash
curl -s -X POST -H "Authorization: Bearer $HA" \
  https://ha.lab.crog.org/api/services/homeassistant/restart
```

- [ ] **Step 4: Commit**

```bash
git add ha/www/pac-circuit.svg
git commit -m "Draw the geothermal circuit as the dashboard's backdrop"
```

---

### Task 7: Le tableau de bord

**Files:**
- Create: `ha/dashboards/pac.yaml`
- Modify: `configuration.yaml` sur p-cloud (une entrée sous `lovelace.dashboards`)

**Interfaces:**
- Consumes: `sensor.pac_etat`, `sensor.pac_depuis`, `sensor.pac_explication` (tâches 2 et 3) ; `sensor.pac_ecart_chauffage`, `sensor.pac_ecart_source`, `sensor.pac_temperature_du_sol` (tâche 4) ; `sensor.pac_rendement_eau_chaude`, `sensor.pac_rendement_chauffage`, `sensor.pac_rendement_instantane`, `sensor.pac_cycle_moyen` (tâche 5) ; `/local/pac-circuit.svg` (tâche 6).
- Produces: le tableau à l'URL `/pac-chauffage/pac`, cible des liens de la tâche 8.

- [ ] **Step 1: Écrire le tableau**

`ha/dashboards/pac.yaml` :

```yaml
# Tableau de bord « PAC » — pompe à chaleur géothermique Alpha Innotec.
#
# SOURCE DE VÉRITÉ : dépôt chauffage, ha/dashboards/pac.yaml, déployé par
# deploy/deploy-ha.sh. Ne pas éditer sur p-cloud.
#
# Déclaré dans configuration.yaml sous lovelace.dashboards.pac-chauffage. Le
# chemin DOIT contenir un tiret, sinon la validation refuse le bloc (règle de
# lovelace/const.py, déjà notée dans configuration.yaml). Le contenu est relu
# à chaque actualisation de la page ; seule sa déclaration exige un
# redémarrage.
#
# max_columns: 4 — la vue est centrée avec max-width = colonnes × 500 px. À 2
# elle plafonnerait à 1032 px quel que soit l'écran (vérifié au DOM le
# 21.09.2026).
#
# grid_options: {columns: full} sur les cartes posées en section : sans lui
# une carte n'occupe qu'une partie de la grille interne (une carte grid
# mesurait 436 px dans une section de 880).
#
# check_config NE VALIDE PAS ce fichier. Vérifier le YAML et le rendu
# séparément.

title: PAC
views:
  - title: PAC
    path: pac
    icon: mdi:heat-pump
    type: sections
    max_columns: 4
    sections:
      - type: grid
        cards:
          - type: heading
            heading: En ce moment
            heading_style: title
            icon: mdi:heat-pump
          - type: markdown
            grid_options:
              columns: full
            content: |-
              ## {{ states('sensor.pac_etat') }}

              *depuis {{ states('sensor.pac_depuis') }}*


              {{ states('sensor.pac_explication') }}

      - type: grid
        cards:
          - type: heading
            heading: Le circuit
            heading_style: title
            icon: mdi:pipe
          - type: picture-elements
            grid_options:
              columns: full
            image: /local/pac-circuit.svg
            elements:
              # Températures, posées où se trouve leur sonde. Les repères en
              # pourcentage sont ceux notés en tête de la tâche 6 du plan.
              - type: state-label
                entity: sensor.pac_temperature_du_sol
                style: {top: 70%, left: 27%, color: white, font-size: 14px}
              - type: state-label
                entity: sensor.luxtronik_300722_07_heat_source_output_temperature
                style: {top: 90%, left: 27%, color: white, font-size: 14px}
              - type: state-label
                entity: sensor.luxtronik_300722_07_hot_gas_temperature
                style: {top: 62%, left: 50%, color: white, font-size: 14px}
              - type: state-label
                entity: sensor.luxtronik_300722_07_flow_in_temperature
                style: {top: 38%, left: 68%, color: white, font-size: 14px}
              - type: state-label
                entity: sensor.luxtronik_300722_07_flow_out_temperature
                style: {top: 70%, left: 68%, color: white, font-size: 14px}
              - type: state-label
                entity: sensor.luxtronik_300722_07_dhw_temperature
                style: {top: 22%, left: 90%, color: white, font-size: 14px}
              - type: state-label
                entity: sensor.luxtronik_300722_07_outdoor_temperature
                style: {top: 8%, left: 12%, color: white, font-size: 14px}
              # Organes, allumés ou éteints.
              - type: state-icon
                entity: binary_sensor.luxtronik_300722_07_compressor
                title: Compresseur
                style: {top: 50%, left: 50%}
              - type: state-icon
                entity: binary_sensor.luxtronik_300722_07_pump_flow
                title: Pompe de circulation
                style: {top: 42%, left: 63%}
              - type: state-icon
                entity: binary_sensor.luxtronik_300722_07_dhw_charging_pump
                title: Pompe de charge du ballon
                style: {top: 26%, left: 78%}

      - type: grid
        cards:
          - type: heading
            heading: Est-ce que ça va bien
            heading_style: title
            icon: mdi:stethoscope
          - type: markdown
            grid_options:
              columns: full
            # Chaque indicateur dit sa valeur ET son verdict, ou pourquoi il se
            # tait. Les deux écarts ne veulent rien dire compresseur à
            # l'arrêt : l'eau stagne et les sondes s'équilibrent.
            content: |-
              {% macro ligne(nom, eid, unite, muet) %}
              **{{ nom }}** — {% if has_value(eid) %}{{ states(eid) }} {{ unite }} · {{ state_attr(eid, 'verdict') }}{% else %}{{ muet }}{% endif %}
              {% endmacro %}

              {{ ligne('Écart chauffage', 'sensor.pac_ecart_chauffage', 'K', 'non mesurable, le compresseur est à l\'arrêt') }}

              {{ ligne('Écart source', 'sensor.pac_ecart_source', 'K', 'non mesurable, le compresseur est à l\'arrêt') }}

              {{ ligne('Température du sol', 'sensor.pac_temperature_du_sol', '°C', 'sonde indisponible') }}

              {{ ligne('Rendement eau chaude', 'sensor.pac_rendement_eau_chaude', '', 'pas encore de chauffe mesurée') }}

              {{ ligne('Rendement chauffage', 'sensor.pac_rendement_chauffage', '', 'la PAC n\'a pas encore chauffé la maison depuis la remise à zéro des compteurs') }}

              {{ ligne('Rendement instantané', 'sensor.pac_rendement_instantane', '', 'le compresseur est à l\'arrêt') }}

              {{ ligne('Cycle moyen', 'sensor.pac_cycle_moyen', 'min', 'pas assez de démarrages pour se prononcer') }}

      - type: grid
        cards:
          - type: heading
            heading: La courbe de chauffe
            heading_style: title
            icon: mdi:chart-bell-curve-cumulative
          - type: markdown
            grid_options:
              columns: full
            # Seul le circuit 2 est réel : les circuits 1 et 3 lisent 75 °C,
            # valeur sentinelle de sonde absente (vérifié le 22.09.2026).
            content: |-
              À −15 °C dehors la PAC vise **{{ states('number.luxtronik_300722_07_heating_curve_circuit2_end_temperature') }} °C**
              au retour ; à +20 °C, **{{ states('number.luxtronik_300722_07_heating_curve_circuit2_parallel_shift_temperature') }} °C**.
              Abaissement de nuit : {{ states('number.luxtronik_300722_07_heating_curve_circuit2_night_temperature') }} K.


              En ce moment, dehors {{ states('sensor.luxtronik_300722_07_outdoor_temperature') }} °C,
              consigne de retour **{{ states('sensor.luxtronik_300722_07_flow_out_temperature_target') }} °C**,
              retour réel {{ states('sensor.luxtronik_300722_07_flow_out_temperature') }} °C.

      - type: grid
        cards:
          - type: heading
            heading: L'historique
            heading_style: title
            icon: mdi:chart-line
          - type: history-graph
            grid_options:
              columns: full
            hours_to_show: 48
            entities:
              - entity: sensor.luxtronik_300722_07_outdoor_temperature
                name: Dehors
              - entity: sensor.luxtronik_300722_07_flow_in_temperature
                name: Départ
              - entity: sensor.luxtronik_300722_07_flow_out_temperature
                name: Retour
              - entity: sensor.pac_temperature_du_sol
                name: Sol
              - entity: sensor.luxtronik_300722_07_dhw_temperature
                name: Ballon
          - type: statistics-graph
            grid_options:
              columns: full
            title: Heures et énergie, par jour
            days_to_show: 30
            period: day
            stat_types:
              - state
            entities:
              - entity: sensor.luxtronik_300722_07_compressor1_operation_hours
                name: Heures de compresseur
              - entity: sensor.luxtronik_300722_07_dhw_heat_amount
                name: Chaleur pour le ballon
              - entity: sensor.luxtronik_300722_07_dhw_energy_input
                name: Électricité pour le ballon

      - type: grid
        cards:
          - type: heading
            heading: Le détail
            heading_style: title
            icon: mdi:magnify
          - type: entities
            grid_options:
              columns: full
            title: Températures
            entities:
              - entity: sensor.luxtronik_300722_07_outdoor_temperature
                name: Extérieure (TA)
              - entity: sensor.luxtronik_300722_07_outdoor_temperature_average
                name: Moyenne 24 h
              - entity: sensor.luxtronik_300722_07_flow_in_temperature
                name: Départ chauffage (TVL)
              - entity: sensor.luxtronik_300722_07_flow_out_temperature
                name: Retour chauffage (TRL)
              - entity: sensor.luxtronik_300722_07_flow_out_temperature_target
                name: Consigne de retour
              - entity: sensor.luxtronik_300722_07_dhw_temperature
                name: Ballon (TBW)
              - entity: sensor.luxtronik_300722_07_heat_source_input_temperature
                name: Saumure du sol (TEE)
              - entity: sensor.luxtronik_300722_07_heat_source_output_temperature
                name: Saumure vers le sol (TAE)
              - entity: sensor.luxtronik_300722_07_hot_gas_temperature
                name: Gaz chaud (THG)
          - type: entities
            grid_options:
              columns: full
            title: Compteurs
            entities:
              - entity: sensor.luxtronik_300722_07_compressor1_operation_hours
                name: Heures de compresseur
              - entity: sensor.luxtronik_300722_07_compressor1_impulses
                name: Démarrages
              - entity: sensor.luxtronik_300722_07_dhw_heat_amount
                name: Chaleur produite pour le ballon
              - entity: sensor.luxtronik_300722_07_dhw_energy_input
                name: Électricité pour le ballon
              - entity: sensor.luxtronik_300722_07_heat_amount_heating
                name: Chaleur produite pour le chauffage
          - type: markdown
            grid_options:
              columns: full
            # Les pressions sont affichées, JAMAIS interprétées. Relevé du
            # 22.09.2026 : haute 14,57 bar, basse 15,10 — la basse au-dessus de
            # la haute. Elles s'équilibrent circuit arrêté et les décalages de
            # sonde ressortent.
            #
            # error_reason est la DERNIÈRE erreur mémorisée, pas une erreur
            # active : il vaut 721 en permanence alors que la PAC va bien.
            # L'état de panne, c'est disturbance_output.
            content: |-
              **Pressions** — haute {{ states('sensor.luxtronik_300722_07_high_pressure') }} bar,
              basse {{ states('sensor.luxtronik_300722_07_low_pressure') }} bar.
              Elles s'équilibrent à l'arrêt : ne pas les lire comme un indicateur de santé.


              **Défaut en cours** — {{ 'oui' if is_state('binary_sensor.luxtronik_300722_07_disturbance_output', 'on') else 'aucun' }}.
              Dernière erreur mémorisée : code {{ states('sensor.luxtronik_300722_07_error_reason') }}.
```

- [ ] **Step 2: Vérifier que le YAML est valide**

```bash
python3 -c "import yaml,sys; d=yaml.safe_load(open('ha/dashboards/pac.yaml')); print('YAML valide,', len(d['views'][0]['sections']), 'sections')"
```

Attendu : `YAML valide, 6 sections`.

- [ ] **Step 3: Déclarer le tableau dans `configuration.yaml`**

Sur p-cloud, ajouter l'entrée sous `lovelace.dashboards`, après `maison-pieces` :

```bash
ssh p-cloud "C=/home/rjl/homelab/homeassistant/config
  cp -p \$C/configuration.yaml \$C/configuration.yaml.bak-\$(date +%Y-%m-%d-%H%M%S)
  python3 - \$C/configuration.yaml <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
ancre = '''    maison-pieces:
      mode: yaml
      filename: dashboards/maison.yaml
      title: Maison
      icon: mdi:home
      show_in_sidebar: true
'''
ajout = '''    # Pompe a chaleur geothermique : etat explique, schema du circuit,
    # indicateurs de sante. Depot chauffage, deploye par deploy/deploy-ha.sh.
    pac-chauffage:
      mode: yaml
      filename: dashboards/pac.yaml
      title: PAC
      icon: mdi:heat-pump
      show_in_sidebar: true
'''
if 'pac-chauffage:' in s:
    print('deja declare, rien a faire')
elif ancre not in s:
    sys.exit('ancre maison-pieces introuvable : declarer a la main')
else:
    open(p, 'w', encoding='utf-8').write(s.replace(ancre, ancre + ajout))
    print('declare')
PY"
```

Attendu : `declare`.

- [ ] **Step 4: Déployer et valider la configuration**

```bash
deploy/deploy-ha.sh
```

Attendu : `check_config` sans `ERROR`. Il valide la déclaration dans `configuration.yaml`, **pas** le contenu de `dashboards/pac.yaml`.

- [ ] **Step 5: Redémarrer Home Assistant**

La déclaration d'un tableau de bord l'exige.

```bash
curl -s -X POST -H "Authorization: Bearer $HA" \
  https://ha.lab.crog.org/api/services/homeassistant/restart
```

Puis attendre le retour de l'API :

```bash
until curl -sf -m 5 -H "Authorization: Bearer $HA" \
  https://ha.lab.crog.org/api/ >/dev/null 2>&1; do sleep 5; done; echo "Home Assistant est revenu"
```

- [ ] **Step 6: Vérifier que le tableau répond**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $HA" \
  https://ha.lab.crog.org/pac-chauffage/pac
```

Attendu : `200`. Le rendu se vérifie au navigateur en tâche 9 — un `200` ne prouve que l'existence de la route.

- [ ] **Step 7: Commit**

```bash
git add ha/dashboards/pac.yaml
git commit -m "Lay out the heat pump dashboard around the circuit diagram"
```

---

### Task 8: Les liens depuis le tableau « Maison », et une inversion à corriger

**Files:**
- Modify: `/home/rjl/homelab/homeassistant/config/homelab/gen_maison.py` sur p-cloud (lignes de la grille `modes` dans `overview()`, l'entrée `pac` de `TECHNIQUE`, et l'en-tête `HEADER`)

**Interfaces:**
- Consumes: le tableau `/pac-chauffage/pac` (tâche 7), `sensor.pac_etat` (tâche 2).
- Produces: deux points d'entrée vers le tableau PAC depuis « Maison ».

**`maison.yaml` est GÉNÉRÉ. Ne jamais l'éditer à la main — modifier le script et régénérer.**

- [ ] **Step 1: Sauvegarder le script et vérifier qu'il régénère à l'identique**

```bash
ssh p-cloud "cd /home/rjl/homelab/homeassistant/config/homelab
  cp -p gen_maison.py gen_maison.py.bak-\$(date +%Y-%m-%d-%H%M%S)
  python3 gen_maison.py
  diff -q maison.yaml ../dashboards/maison.yaml && echo 'REGENERE A L IDENTIQUE' || echo 'ECART : le fichier deploye differe du script'"
```

Attendu : `REGENERE A L IDENTIQUE`. Un écart signifie que `maison.yaml` a été édité à la main depuis la dernière génération — le tirer au clair avant de continuer, sinon cette tâche écrasera cette édition.

- [ ] **Step 2: Ajouter la tuile dans la grille « Actions »**

Dans `overview()`, à la fin de la liste `modes["cards"]`, après la tuile « Énergie » :

```python
        {"type": M + "template-card", "entity": "sensor.pac_etat", "icon": "mdi:heat-pump",
         "icon_color": t("'orange' if is_state('binary_sensor.luxtronik_300722_07_compressor', 'on') else 'blue-grey'"),
         "primary": "PAC",
         # L'etat vivant plutot qu'un libelle fige : la tuile renseigne avant
         # meme qu'on la touche.
         "secondary": t("states('sensor.pac_etat') if has_value('sensor.pac_etat') else 'Tableau de la pompe a chaleur'"),
         "layout": "vertical", "fill_container": True,
         "tap_action": {"action": "navigate", "navigation_path": "/pac-chauffage/pac"}, "grid_options": {"columns": 4, "rows": 2}},
```

- [ ] **Step 3: Ajouter l'entrée dans la vue Technique**

Dans `TECHNIQUE`, entrée `id="pac"`, **en tête** de sa liste `extra` (avant la carte de chips) :

```python
      {"type": M + "template-card", "entity": "sensor.pac_etat", "icon": "mdi:heat-pump",
       "icon_color": t("'orange' if is_state('binary_sensor.luxtronik_300722_07_compressor', 'on') else 'blue-grey'"),
       "primary": t("states('sensor.pac_etat') if has_value('sensor.pac_etat') else 'Pompe a chaleur'"),
       "secondary": "Voir le tableau détaillé",
       "tap_action": {"action": "navigate", "navigation_path": "/pac-chauffage/pac"},
       "grid_options": {"columns": 12}},
```

- [ ] **Step 4: Corriger l'inversion départ / retour**

Dans la même entrée `pac` de `TECHNIQUE`, ces deux lignes sont inversées :

```python
             sensor_card(LUX + "flow_out_temperature", "Départ", "mdi:arrow-right-bold", "orange"),
             sensor_card(LUX + "flow_in_temperature", "Retour", "mdi:arrow-left-bold", "blue"),
```

Les remplacer par :

```python
             # flow_in = DEPART (Vorlauf), flow_out = RETOUR (Rucklauf).
             # Etabli le 22.09.2026 : flow_out_temperature_target vaut 15,0 et
             # correspond a temperature_target_return lu en direct sur la PAC,
             # or la regulation Alpha Innotec pilote sur le retour. La lecture
             # directe donne temperature_supply 24,0 (= flow_in) et
             # temperature_return 23,5 (= flow_out). Les deux etiquettes
             # etaient inversees.
             sensor_card(LUX + "flow_in_temperature", "Départ", "mdi:arrow-right-bold", "orange"),
             sensor_card(LUX + "flow_out_temperature", "Retour", "mdi:arrow-left-bold", "blue"),
```

- [ ] **Step 5: Retirer la mention « Compresseur à l'arrêt »**

Toujours dans l'entrée `pac` de `TECHNIQUE`, la carte de chips affiche en
permanence l'état du compresseur — « Compresseur » en marche, « Compresseur à
l'arrêt » le reste du temps. Or il est à l'arrêt l'essentiel de l'année, et le
tableau PAC porte désormais cette information. La puce ne doit apparaître que
quand le compresseur tourne.

Remplacer :

```python
                 {"type": "template", "entity": "binary_sensor.luxtronik_300722_07_compressor", "icon": "mdi:engine",
                  "icon_color": t("'blue' if is_state('binary_sensor.luxtronik_300722_07_compressor', 'on') else 'grey'"),
                  "content": t("'Compresseur' if is_state('binary_sensor.luxtronik_300722_07_compressor', 'on') else 'Compresseur à l\\'arrêt'")}]},
```

par :

```python
                 # La puce ne s'affiche QUE compresseur en marche : a l'arret
                 # elle ne disait rien d'utile, et l'etat complet vit
                 # desormais dans le tableau PAC (/pac-chauffage/pac).
                 {"type": "conditional",
                  "conditions": [{"condition": "state",
                                  "entity": "binary_sensor.luxtronik_300722_07_compressor",
                                  "state": "on"}],
                  "chip": {"type": "template",
                           "entity": "binary_sensor.luxtronik_300722_07_compressor",
                           "icon": "mdi:engine", "icon_color": "blue",
                           "content": "Compresseur"}}]},
```

La forme `conditional` avec une clé `chip` est celle qu'emploient déjà les
chips de `overview()` (voir la puce conditionnée par `CHAUD`).

**Attention à l'échappement.** La ligne remplacée contient `\\'` dans le source
Python. Repérer la ligne par `grep -n "Compresseur" gen_maison.py` et l'éditer
sur place plutôt que de coller un bloc, pour ne pas se tromper de niveau
d'échappement.

- [ ] **Step 6: Corriger le chemin annoncé dans l'en-tête**

Dans `HEADER`, remplacer :

```
# LE SCRIPT VIT ICI : p-cloud, /home/rjl/homelab/homeassistant/gen_maison.py
```

par :

```
# LE SCRIPT VIT ICI : p-cloud,
# /home/rjl/homelab/homeassistant/config/homelab/gen_maison.py
```

Le chemin annoncé était d'un niveau trop haut.

- [ ] **Step 7: Régénérer et vérifier que les changements sont là, et seulement eux**

```bash
ssh p-cloud "cd /home/rjl/homelab/homeassistant/config/homelab
  python3 gen_maison.py
  echo '--- differences avec le deploye ---'
  diff ../dashboards/maison.yaml maison.yaml | head -40"
```

Attendu : uniquement les lignes des deux nouvelles cartes, l'échange des étiquettes Départ/Retour, le passage de la puce du compresseur en `conditional`, et la ligne de l'en-tête. Aucune autre section touchée.

- [ ] **Step 8: Déployer le tableau régénéré**

```bash
ssh p-cloud "cd /home/rjl/homelab/homeassistant/config/homelab
  docker exec homeassistant cp -p /config/dashboards/maison.yaml \
    /config/dashboards/maison.yaml.bak-\$(date +%Y-%m-%d-%H%M%S)
  docker cp maison.yaml homeassistant:/config/dashboards/maison.yaml
  echo deploye"
```

Attendu : `deploye`. Le tableau « Maison » est relu à chaque actualisation de la page : pas de redémarrage.

- [ ] **Step 9: Commit d'une copie du script dans ce dépôt, pour trace**

Le script vit sur p-cloud et n'est pas versionné ici. En garder la version modifiée permet de retrouver ce qui a été changé :

```bash
scp p-cloud:/home/rjl/homelab/homeassistant/config/homelab/gen_maison.py \
    ha/reference/gen_maison.py
git add ha/reference/gen_maison.py
git commit -m "Link the house dashboard to the heat pump one, and fix swapped flow labels"
```

---

### Task 9: Vérification au navigateur et relevé final

`check_config` ne valide pas les tableaux de bord, et la largeur des cartes se constate — elle ne se déduit pas.

**Files:**
- Modify: `docs/superpowers/specs/2026-09-22-pac-tableau-home-assistant-design.md` (une section de relevé à la fin)

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: la confirmation que le tableau s'affiche correctement, et la liste écrite de ce qui reste à vérifier à la première chauffe.

- [ ] **Step 1: Ouvrir le tableau au navigateur**

Avec le MCP Chrome : ouvrir `https://ha.lab.crog.org/pac-chauffage/pac` dans un nouvel onglet, puis capturer l'écran.

Vérifier, dans l'ordre :
1. L'état en tête affiche bien `Au-dessus de la limite de chauffe` et une durée en français.
2. Le schéma du circuit s'affiche — pas d'image cassée.
3. Les températures du schéma sont posées sur les bons organes : la saumure près du sol, le ballon à droite en haut, le plancher à droite en bas.
4. Les sept lignes de « Est-ce que ça va bien » sont présentes, chacune avec un verdict ou une raison de se taire.
5. Aucune carte ne montre `unknown`, `unavailable` brut, ni un message d'erreur Lovelace rouge.

- [ ] **Step 2: Vérifier la largeur des cartes**

Toujours au navigateur, mesurer au DOM la largeur d'une carte de section :

```javascript
[...document.querySelectorAll('hui-view-container hui-card')]
  .map(c => c.getBoundingClientRect().width)
```

Attendu : des largeurs proches de celle de la section, pas la moitié. Une carte à environ 436 px dans une section de 880 signale un `grid_options: {columns: full}` oublié — c'est le piège constaté au DOM le 21.09.2026.

- [ ] **Step 3: Vérifier en largeur de téléphone**

Redimensionner la fenêtre à 390 px de large et recapturer. Vérifier qu'aucun texte n'est tronqué, qu'il n'y a pas de défilement horizontal, et que le schéma reste lisible.

- [ ] **Step 4: Vérifier les deux liens depuis « Maison »**

Ouvrir `https://ha.lab.crog.org/maison-pieces/maison`, trouver la tuile « PAC » dans « Actions », vérifier que son sous-texte affiche l'état vivant, cliquer, et confirmer l'arrivée sur le tableau PAC. Recommencer depuis `https://ha.lab.crog.org/maison-pieces/technique`.

Vérifier au passage deux choses sur la vue Technique : que « Départ » affiche maintenant la valeur la plus **haute** des deux (24,0 contre 23,5), et qu'**aucune puce « Compresseur à l'arrêt » ne subsiste** — compresseur arrêté, la puce doit avoir disparu.

- [ ] **Step 5: Consigner ce qui reste à vérifier à la première chauffe**

Ajouter à la fin du spec, `docs/superpowers/specs/2026-09-22-pac-tableau-home-assistant-design.md` :

```markdown
## Relevé de mise en service

Posé le 22 septembre 2026, PAC à l'arrêt depuis 21 h. Ces cinq points ne sont
pas observables compresseur arrêté et restent à vérifier à la première chauffe :

1. **Le COP instantané.** `current_heat_output` et `current_power_consumption`
   lisent 0 W à l'arrêt. Vérifier qu'ils rendent de vraies valeurs, et que
   `sensor.pac_rendement_instantane` sort de `unavailable`.
2. **Les deux écarts.** Vérifier qu'ils deviennent disponibles, et que l'écart
   source devient franchement positif — il valait −0,1 K à l'arrêt.
3. **Le sens des sondes.** En chauffe, `flow_in` doit dépasser `flow_out` de
   plusieurs kelvins. Si c'est l'inverse, la contrainte globale sur le sens
   des sondes est fausse et il faut reprendre l'étiquetage partout, y compris
   dans `gen_maison.py`.
4. **L'état « Chauffe la maison »** et sa phrase de causalité, qui n'ont jamais
   été rendus sur des valeurs réelles.
5. **La valeur `cooling` de `sensor.…status`**, jamais observée : sur les
   5 jours précédant le 22.09.2026, `status` ne prend que `no_request`. Si le
   rafraîchissement passif ne la produit pas, l'état « Rafraîchit » ne
   s'affichera jamais et il faudra le détecter autrement.

Les seuils des verdicts sont des valeurs de littérature, pas des mesures sur
cette installation. À revoir après une saison de chauffe.
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-09-22-pac-tableau-home-assistant-design.md
git commit -m "Record what still needs checking once the compressor runs"
```
