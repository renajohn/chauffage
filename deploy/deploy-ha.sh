#!/bin/sh
# Déploie le côté Home Assistant : le paquet, le tableau de bord et le schéma
# du circuit. Sauvegarde horodatée de chaque fichier remplacé, puis
# check_config.
#
# TOUT OU RIEN. Si une copie échoue ou si check_config signale une ERROR, les
# fichiers sont remis dans l'état où ils étaient et le script sort en 1. Sans
# ce retour en arrière, une configuration invalide resterait dans /config :
# personne ne la rechargerait, mais Home Assistant la lirait au premier
# redémarrage venu — et Watchtower en provoque.
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
# Témoin, dans le /tmp du conteneur : il liste les fichiers qui n'existaient
# pas encore avant ce déploiement. Son existence prouve que la sauvegarde a bien
# eu lieu ; sans lui, le retour en arrière ne saurait pas distinguer « ce
# fichier était absent, donc je le supprime » de « la sauvegarde n'a jamais
# tourné, donc je ne touche à rien ».
ABSENTS="/tmp/pac-absents-$STAMP"

scp -q ha/packages/pac.yaml "$HOST:/tmp/pac-package.yaml"
# Une copie par ligne, jamais chaînée par « && » : dans une liste AND, l'échec
# d'une commande autre que la dernière n'est pas vu par set -e. Le paquet
# pourrait alors ne pas être copié, le tableau non plus, et check_config
# validerait l'ancien fichier en annonçant « OK ».
COPIES="docker cp -q /tmp/pac-package.yaml homeassistant:/config/packages/pac.yaml"
SAUVES="packages/pac.yaml"

if [ -f ha/dashboards/pac.yaml ]; then
  scp -q ha/dashboards/pac.yaml "$HOST:/tmp/pac-dashboard.yaml"
  COPIES="$COPIES
docker cp -q /tmp/pac-dashboard.yaml homeassistant:/config/dashboards/pac.yaml"
  SAUVES="$SAUVES dashboards/pac.yaml"
fi
if [ -f ha/www/pac-circuit.svg ]; then
  scp -q ha/www/pac-circuit.svg "$HOST:/tmp/pac-circuit.svg"
  COPIES="$COPIES
docker cp -q /tmp/pac-circuit.svg homeassistant:/config/www/pac-circuit.svg"
fi

# Remet les fichiers dans l'état d'avant le déploiement, et dit lesquels.
# L'échec du retour en arrière est le pire cas : il laisse /config invalide.
# Il se crie, il ne se tait pas — et « if ! » évite que set -e tue le script
# avant que le message soit écrit.
restaure() {
  # set -eu, et non set -u : sans le -e, un mv en échec n'interromprait rien,
  # « restauré » s'afficherait sur un fichier qui ne l'est pas, et le statut du
  # fragment serait celui du rm -f final — donc 0 quoi qu'il arrive, ce qui
  # rendrait le « if ! » ci-dessous toujours faux. Les conditions de if et de
  # elif restent exemptées de -e, elles peuvent échouer sans tout arrêter.
  if ! ssh "$HOST" "docker exec homeassistant sh -c '
    set -eu
    N=0
    for f in $SAUVES; do
      if [ -f /config/\$f.bak-$STAMP ]; then
        mv /config/\$f.bak-$STAMP /config/\$f
        echo \"restauré : /config/\$f\"
        N=\$((N+1))
      # Le témoin ne garde que cette branche-ci, jamais la boucle entière : une
      # sauvegarde déjà écrite se remet en place même si le témoin a disparu.
      # Il ne sert qu à distinguer « ce fichier était absent avant ce
      # déploiement, je le retire » de « la sauvegarde n a jamais tourné, je ne
      # touche à rien » — sans quoi on supprimerait un fichier valide.
      elif [ -f $ABSENTS ] && grep -qx \"\$f\" $ABSENTS; then
        rm -f /config/\$f
        echo \"retiré : /config/\$f, absent avant ce déploiement\"
        N=\$((N+1))
      fi
    done
    [ \"\$N\" -gt 0 ] || echo \"rien à restaurer : la sauvegarde n a pas eu lieu\"
    rm -f $ABSENTS'"; then
    echo "LE RETOUR EN ARRIÈRE A ÉCHOUÉ. /config contient peut-être une" >&2
    echo "configuration invalide. La remettre à la main depuis :" >&2
    for f in $SAUVES; do
      echo "  /config/$f.bak-$STAMP" >&2
    done
    echo "avant tout redémarrage de Home Assistant." >&2
  fi
}

# La sortie du ssh est capturée pour être relue : check_config sort en 0 même
# quand il signale une ERROR. On récupère le code au lieu de laisser set -e
# tuer le script, sinon un échec distant emporterait tout ce stdout avec lui,
# et il ne resterait que la stderr, sans le contexte qui la rend lisible.
set +e
SORTIE=$(ssh "$HOST" "set -eu
  grep -q 'packages: !include_dir_named packages' '$HA_CONFIG/configuration.yaml' || {
    echo 'configuration.yaml ne charge pas packages/ (voir l en-tete de ce script)' >&2
    exit 1; }
  docker exec homeassistant sh -c '
    set -eu
    mkdir -p /config/packages /config/dashboards /config/www
    rm -f /tmp/pac-absents-*
    : > $ABSENTS
    for f in $SAUVES; do
      if [ -f /config/\$f ]; then cp -p /config/\$f /config/\$f.bak-$STAMP
      else echo \$f >> $ABSENTS; fi
    done'
  $COPIES
  rm -f /tmp/pac-package.yaml /tmp/pac-dashboard.yaml /tmp/pac-circuit.svg
  echo '== check_config'
  docker exec homeassistant python -m homeassistant --script check_config -c /config 2>&1")
CODE=$?
set -e
echo "$SORTIE"

if [ "$CODE" -ne 0 ]; then
  echo "le déploiement a échoué sur p-cloud (code $CODE) : retour en arrière." >&2
  restaure
  exit 1
fi
if echo "$SORTIE" | grep -q 'ERROR'; then
  echo "check_config signale une erreur : retour en arrière, rien à recharger." >&2
  restaure
  exit 1
fi
echo "OK. Recharger la configuration YAML dans Home Assistant."
