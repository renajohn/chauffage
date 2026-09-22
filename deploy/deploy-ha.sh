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

# La sortie du ssh est capturée : check_config sort en 0 même quand il
# signale une ERROR, donc le seul garde-fou est de relire ce qu'il a écrit.
SORTIE=$(ssh "$HOST" "set -eu
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
  docker exec homeassistant python -m homeassistant --script check_config -c /config 2>&1")
echo "$SORTIE"
if echo "$SORTIE" | grep -q 'ERROR'; then
  echo "check_config signale une erreur : ne rien recharger, corriger d'abord." >&2
  exit 1
fi
echo "OK. Recharger la configuration YAML dans Home Assistant."
