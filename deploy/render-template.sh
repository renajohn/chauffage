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
# L'assignation API=... doit précéder « python3 » pour entrer dans son
# environnement : placée après, sh en ferait un simple argument.
printf '%s' "$TPL" | API="$API" python3 -c '
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
'
echo
