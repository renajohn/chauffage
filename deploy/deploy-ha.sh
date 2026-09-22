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
  SAUVES="$SAUVES www/pac-circuit.svg"
fi

# Remet les fichiers dans l'état d'avant le déploiement, et dit lesquels.
# L'échec du retour en arrière est le pire cas : il laisse /config invalide.
# Il se crie, il ne se tait pas — et la capture du ssh évite que set -e tue le
# script avant que le message soit écrit.
restaure() {
  # Le fragment distant tourne sous « set -u » seul, sans -e, et c'est
  # délibéré : avec -e, le premier mv refusé emporterait la boucle entière et
  # les fichiers suivants — dont la sauvegarde est pourtant saine — ne
  # seraient jamais remis en place. /config sortirait plus abîmé que sans
  # retour en arrière du tout. Chaque mv et chaque rm est donc jugé sur place
  # par un if, la boucle va au bout, et c'est le test final « [ $ECHEC = 0 ] »
  # qui porte l'échec. Ce test est la dernière commande exprès : le statut ne
  # doit pas être celui du « rm -f » du témoin, dont l'échec ne dit rien de la
  # restauration.
  #
  # La sortie est capturée parce que le fragment est seul à savoir quelles
  # sauvegardes restent en place : le message de détresse ne doit nommer que
  # celles-là, jamais un .bak qu'un mv réussi a déjà consommé.
  if SORTIE_R=$(ssh "$HOST" "docker exec homeassistant sh -c '
    set -u
    ECHEC=0
    N=0
    for f in $SAUVES; do
      if [ -f /config/\$f.bak-$STAMP ]; then
        if mv /config/\$f.bak-$STAMP /config/\$f; then
          echo \"restauré : /config/\$f\"
          N=\$((N+1))
        else
          ECHEC=1
          echo \"ÉCHEC : /config/\$f non restauré\" >&2
        fi
      # Le témoin ne garde que cette branche-ci, jamais la boucle entière : une
      # sauvegarde déjà écrite se remet en place même si le témoin a disparu.
      # Il ne sert qu à distinguer « ce fichier était absent avant ce
      # déploiement, je le retire » de « la sauvegarde n a jamais tourné, je ne
      # touche à rien » — sans quoi on supprimerait un fichier valide.
      elif [ -f $ABSENTS ] && grep -qx \"\$f\" $ABSENTS; then
        if rm -f /config/\$f; then
          echo \"retiré : /config/\$f, absent avant ce déploiement\"
          N=\$((N+1))
        else
          ECHEC=1
          echo \"ÉCHEC : /config/\$f toujours en place\" >&2
        fi
      fi
    done
    if [ \"\$ECHEC\" = 1 ]; then
      RESTES=
      for f in $SAUVES; do
        if [ -f /config/\$f.bak-$STAMP ]; then
          RESTES=\"\$RESTES /config/\$f.bak-$STAMP\"
        fi
      done
      echo \"RESTES:\$RESTES\"
    elif [ \"\$N\" = 0 ]; then
      echo \"rien à restaurer : la sauvegarde n a pas eu lieu\"
    fi
    rm -f $ABSENTS
    [ \"\$ECHEC\" = 0 ]'"); then
    ECHEC_R=0
  else
    ECHEC_R=1
  fi
  # « RESTES: » s'adresse à ce script, pas à l'opérateur : on le lui épargne
  # ici et on le relit plus bas.
  if [ -n "$SORTIE_R" ]; then
    echo "$SORTIE_R" | grep -v '^RESTES:' || true
  fi
  if [ "$ECHEC_R" = 0 ]; then return 0; fi
  echo "LE RETOUR EN ARRIÈRE A ÉCHOUÉ. /config contient peut-être une" >&2
  echo "configuration invalide : la corriger avant tout redémarrage de Home" >&2
  echo "Assistant." >&2
  RESTES=$(echo "$SORTIE_R" | sed -n 's/^RESTES://p')
  # Le repli s'arme sur « le fragment n'a rien dit du tout », jamais sur
  # « il n'a pas dit RESTES: ». Muet, c'est que ni le ssh ni le docker exec
  # n'ont abouti : aucun mv n'a eu lieu, toutes les sauvegardes sont là et les
  # nommer est juste. Dès qu'il a parlé, seule sa parole compte — une liste
  # déduite de $SAUVES nommerait des .bak qu'un mv a consommés, ou qui n'ont
  # jamais existé, et le message se contredirait dans le même écran.
  if [ -z "$SORTIE_R" ]; then
    echo "Le fragment distant n'a rien dit : aucun fichier n'a bougé, les" >&2
    echo "sauvegardes sont toutes en place. Les remettre à la main :" >&2
    for f in $SAUVES; do echo "  /config/$f.bak-$STAMP" >&2; done
  elif [ -n "$RESTES" ]; then
    echo "Sauvegardes encore en place, à remettre à la main :" >&2
    for b in $RESTES; do echo "  $b" >&2; done
  else
    echo "Aucune sauvegarde à remettre en place : ce qui est resté en l'état" >&2
    echo "est nommé plus haut, par les lignes « ÉCHEC : » et par la sortie du" >&2
    echo "retour en arrière." >&2
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
# check_config sort en 0 même quand il refuse la configuration, et il ne dit
# pas « ERROR » dans tous les cas. Une faute de syntaxe YAML donne bien
# « ERROR:annotatedyaml.loader: » et un code 1 ; mais un paquet qui ne se monte
# pas — le mode d'échec le plus probable ici, une faute dans un gabarit —
# donne « Incorrect config » et « Setup of package 'pac' failed », sans une
# seule majuscule et sans code d'erreur (vérifié en 2026.9.3). Ce garde-fou
# laissait passer ce cas-là : le script annonçait « OK. Recharger » sur une
# configuration que Home Assistant venait de refuser, et le retour en arrière
# ne partait pas. On cherche donc les trois formules, sans distinction de
# casse. Un faux positif est bruyant mais sans dégât : il rend /config à
# l'état d'avant, et il se voit. Un faux négatif laisse une configuration
# invalide que le premier redémarrage venu lira.
if echo "$SORTIE" | grep -qiE 'error|incorrect config|failed'; then
  echo "check_config refuse la configuration : retour en arrière, rien à" >&2
  echo "recharger. La raison est dans la sortie ci-dessus." >&2
  restaure
  exit 1
fi
echo "OK. Recharger la configuration YAML dans Home Assistant."
