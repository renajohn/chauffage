"""Genere dashboards/maison.yaml (Mushroom) a partir d'une description des pieces.

Source de verite : ce script. Le YAML produit est deploye tel quel sur p-cloud.
Regles :
- chaque piece = une section : titre Mushroom (sous-titre vivant), chips des
  mesures, lumiere principale sur une ligne (curseur en ligne), autres lampes
  en demi-cartes, volets avec curseur de position, prises et machines en
  cartes template (couleur selon l'etat, puissance en sous-texte).
- tout template lit les etats avec un defaut : rien ne doit planter au
  demarrage quand une entite est encore indisponible.
"""
import yaml

M = "custom:mushroom-"

# Les comptes Home Assistant de la maison. Le tableau est partage : aucune
# identite ne doit y etre ecrite en dur (corrige le 21.09.2026, la salutation
# disait « Bonjour Renault » a Violaine aussi).
PERSONNES = ["renault", "violaine"]

def t(s):  # raccourci template
    return "{{ " + s + " }}"

def duree_fr(ref):
    """Duree ecoulee, en francais. relative_time() de Home Assistant rend
    l'anglais ("14 hours"), ce qui jure dans une interface en francais.
    `ref` est un acces d'etat du genre states.binary_sensor.x ; le defaut de
    as_timestamp evite une erreur si last_changed manque."""
    d = f"(as_timestamp(now()) - as_timestamp({ref}.last_changed, as_timestamp(now()))) | int"
    return ("{% set d = " + d + " %}"
            "{% if d < 60 %}moins d'une minute"
            "{% elif d < 5400 %}{{ (d / 60) | round(0) | int }} min"
            "{% elif d < 172800 %}{{ (d / 3600) | round(0) | int }} h"
            "{% else %}{{ (d / 86400) | round(0) | int }} j{% endif %}")

def chip_entity(e, name=None, color=None):
    c = {"type": "entity", "entity": e}
    if name: c["name"] = name
    if color: c["icon_color"] = color
    return c

def temp_hum(temp, hum=None):
    parts = []
    if temp: parts.append(f"{{{{ (states('{temp}') | float(0) | round(1)) if has_value('{temp}') else '–' }}}} °C")
    if hum: parts.append(f"{{{{ (states('{hum}') | float(0) | round(0) | int) if has_value('{hum}') else '–' }}}} %")
    return " · ".join(parts)

def light_card(e, name, main=False):
    c = {"type": M + "light-card", "entity": e, "name": name, "layout": "horizontal",
         "show_brightness_control": main, "use_light_color": True, "collapsible_controls": True,
         "hold_action": {"action": "more-info"}, "grid_options": {"columns": 12 if main else 6, "rows": 1}}
    if main:
        c["icon"] = "mdi:lightbulb-group"
    return c

def cover_card(e, name, icon=None, position=True):
    """Carte d'un volet. `position` a False pour ceux dont le curseur ne veut
    rien dire (cover.porte_salon ne rend pas de position) : seuls les boutons
    restent."""
    c = {"type": M + "cover-card", "entity": e, "name": name, "layout": "horizontal"}
    if position: c["show_position_control"] = True
    # Monter / stop / descendre en plus du curseur : le curseur demande de
    # viser, les boutons se pressent sans regarder.
    c["show_buttons_control"] = True
    c["grid_options"] = {"columns": 12, "rows": 1}
    if icon: c["icon"] = icon
    return c

def my_position_chips(covers):
    """Les positions favorites, en puces sous les cartes de volets. Chaque
    volet Somfy expose un button.<objet>_my_position qui le renvoie a la
    position enregistree dans la telecommande ; la puce presse ce bouton.
    Une puce par volet de la piece, dans le meme ordre que les cartes."""
    def bouton(e):
        return "button." + e.split(".", 1)[1] + "_my_position"
    return {"type": M + "chips-card", "alignment": "end", "chips": [
        {"type": "template", "entity": bouton(c[0]), "icon": "mdi:star-outline", "content": c[1],
         "tap_action": {"action": "perform-action", "perform_action": "button.press",
                        "target": {"entity_id": bouton(c[0])}}}
        for c in covers]}

def switch_card(e, name, power=None, icon="mdi:power-socket-ch"):
    return {"type": M + "template-card", "entity": e, "icon": icon, "primary": name,
            "secondary": (f"{{{{ states('{power}') | float(0) | round(0) | int }}}} W" if power
                          else t(f"'Allumé' if is_state('{e}', 'on') else 'Éteint'")),
            "icon_color": t(f"'green' if is_state('{e}', 'on') else 'grey'"),
            "tap_action": {"action": "toggle"}, "hold_action": {"action": "more-info"},
            "grid_options": {"columns": 6, "rows": 1}}

def machine_card(running, name, power, icon):
    return {"type": M + "template-card", "entity": running, "icon": icon, "primary": name,
            "secondary": (f"{{% if is_state('{running}', 'on') %}}{{{{ states('{power}') | float(0) | round(0) | int }}}} W depuis "
                          + duree_fr(f"states.{running}") + "{% else %}À l'arrêt{% endif %}"),
            "icon_color": t(f"'blue' if is_state('{running}', 'on') else 'grey'"),
            "tap_action": {"action": "more-info"}, "grid_options": {"columns": 6, "rows": 1}}

def sensor_card(e, name, icon, color="teal"):
    return {"type": M + "entity-card", "entity": e, "name": name, "icon": icon, "icon_color": color,
            "layout": "horizontal", "grid_options": {"columns": 6, "rows": 1}}

def opening_chip(e, name):
    return {"type": "template", "entity": e, "icon": t(f"'mdi:window-open-variant' if is_state('{e}', 'on') else 'mdi:window-closed-variant'"),
            "icon_color": t(f"'orange' if is_state('{e}', 'on') else 'grey'"),
            "content": name,
            "tap_action": {"action": "more-info"}}

def motion_chip(e, name="Mouvement"):
    return {"type": "template", "entity": e, "icon": "mdi:motion-sensor",
            "icon_color": t(f"'amber' if is_state('{e}', 'on') else 'grey'"),
            "content": t(f"'{name}' if is_state('{e}', 'on') else 'Calme'"), "tap_action": {"action": "more-info"}}

def value_chip(e, icon, color, unit, digits=1):
    return {"type": "template", "entity": e, "icon": icon, "icon_color": color,
            "content": f"{{{{ states('{e}') | float(0) | round({digits}) }}}} {unit}".replace(" | round(0) }}", " | round(0) | int }}"),
            "tap_action": {"action": "more-info"}}

def room_section(r):
    cards = []
    sub = temp_hum(r.get("temp"), r.get("hum"))
    cards.append({"type": M + "title-card", "title": r["name"], "subtitle": sub, "alignment": "start"})
    chips = []
    if r.get("temp"): chips.append(value_chip(r["temp"], "mdi:thermometer", "red", "°C"))
    if r.get("hum"): chips.append(value_chip(r["hum"], "mdi:water-percent", "blue", "%", 0))
    for e, n, icon, color, unit, d in r.get("values", []): chips.append(value_chip(e, icon, color, unit, d))
    for e, n in r.get("openings", []): chips.append(opening_chip(e, n))
    for e in r.get("motion", []): chips.append(motion_chip(e))
    if chips: cards.append({"type": M + "chips-card", "chips": chips, "alignment": "start"})
    if r.get("main_light"): cards.append(light_card(r["main_light"][0], r["main_light"][1], main=True))
    for e, n in r.get("lights", []): cards.append(light_card(e, n))
    for c in r.get("covers", []): cards.append(cover_card(*c))
    if r.get("covers"): cards.append(my_position_chips(r["covers"]))
    for e, n, p in r.get("switches", []): cards.append(switch_card(e, n, p))
    for m in r.get("machines", []): cards.append(machine_card(*m))
    for s in r.get("sensors", []): cards.append(sensor_card(*s))
    cards += r.get("extra", [])
    return {"type": "grid", "cards": cards}

# ----------------------------------------------------------------------------
LUX = "sensor.luxtronik_300722_07_"
MS = "sensor.terrasse_principale_meteo_suisse_at_1318_mah_"
SALON_T = "sensor.salon_capteur_temperature_et_humidite_piano_"
BUAND = "sensor.capteur_temperature_et_humidite_"

REZ = [
 dict(id="salon", name="Salon", short="Salon", icon="mdi:sofa-outline", temp=SALON_T + "temperature", hum=SALON_T + "humidity",
      values=[(SALON_T + "voc_index", "COV", "mdi:air-filter", "purple", "COV", 0)],
      openings=[("binary_sensor.salon_porte_vitree", "Porte vitrée")],
      main_light=("light.salon_salon", "Salon"),
      lights=[("light.poele", "Poêle"), ("light.salon_bande_led_salon", "Bande LED"),
              ("light.salon_mur_phonique_1", "Mur phonique 1"), ("light.salon_mur_phonique_2", "Mur phonique 2")],
      covers=[("cover.baie_vitree_gauche", "Baie gauche"), ("cover.baie_vitree_centre", "Baie centre"),
              ("cover.baie_vitree_droit", "Baie droite"), ("cover.porte_salon", "Porte salon", None, False),
              ("cover.store_banne", "Store banne", "mdi:storefront-outline")],
      switches=[("switch.prise_home_cinema", "Home cinéma", "sensor.prise_home_cinema_power"),
                ("switch.prise_subwoofer", "Subwoofer", "sensor.prise_subwoofer_power"),
                ("switch.prise_humidificateur", "Humidificateur", "sensor.prise_humidificateur_power"),
                ("switch.salon_prise_tv_media_player", "TV et lecteur", "sensor.salon_prise_tv_media_player_power")]),
 # Plus de carte media_player pour la LG : son reseau a ete coupe le
 # 21.09.2026 et l'integration webostv supprimee. L'etat de la television se
 # lit desormais sur la puissance de sa prise, deja affichee ci-dessus.
 dict(id="cuisine", name="Cuisine", icon="mdi:silverware-fork-knife",
      openings=[("binary_sensor.cuisine_fenetre", "Fenêtre"), ("binary_sensor.cuisine_porte_vitree", "Porte vitrée")],
      main_light=("light.cuisine_cuisine", "Cuisine"),
      lights=[("light.spots_cuisine", "Spots"), ("light.ilot", "Îlot"), ("light.cuisine_kitchen_lower_counter", "Sous le plan")],
      covers=[("cover.store_cuisine", "Store cuisine"), ("cover.porte_cuisine", "Porte cuisine")]),
 dict(id="bureau", name="Bureau", icon="mdi:desk", temp="sensor.bureau_temperature_et_humidite_bureau_temperature",
      hum="sensor.bureau_temperature_et_humidite_bureau_humidity",
      main_light=("light.bureau_bureau", "Bureau"),
      lights=[("light.spots_bureau", "Spots"), ("light.chu", "Chu")],
      covers=[("cover.bureau", "Screen")],
      switches=[("switch.prise_bureau", "Écrans et dock", "sensor.prise_bureau_power")]),
 dict(id="entree", name="Entrée, couloir, sas", short="Entrée", icon="mdi:door-open", temp="sensor.entree_entree_temperature",
      values=[("sensor.entree_entree_illuminance", "Lumière", "mdi:brightness-6", "amber", "lx", 0)],
      motion=["binary_sensor.entree_entree_motion", "binary_sensor.groupe_couloir_motion"],
      main_light=("light.entree_entree", "Entrée"),
      lights=[("light.couloir_couloir", "Couloir"), ("light.sas_sas", "Sas"), ("light.sas_sas_mur_blanc", "Sas mur blanc"),
              ("light.sas_sas_mur_vert", "Sas mur vert"), ("light.sas_sas_portes", "Sas portes"),
              ("light.sous_escalier_sous_escalier", "Sous-escalier")],
      openings=[("binary_sensor.sous_escalier_porte_sous_escalier", "Porte sous-escalier")]),
 dict(id="salle_de_bain_bas", name="Salle de bain du bas", short="SdB bas", icon="mdi:shower",
      temp="sensor.salle_de_bain_du_bas_temperature", hum="sensor.salle_de_bain_du_bas_humidity",
      openings=[("binary_sensor.salle_de_bain_du_bas_imposte", "Imposte")],
      motion=["binary_sensor.salle_de_bain_du_bas_salle_de_bain_du_bas_sdb_du_bas"],
      main_light=("light.salle_de_bain_du_bas_salle_de_bain_du_bas", "Salle de bain"),
      lights=[("light.douche_du_bas", "Douche"), ("light.wc_du_bas", "WC"), ("light.salle_de_bain_du_bas_wc_miroir", "Miroir WC")]),
 dict(id="buanderie", name="Buanderie", icon="mdi:washing-machine", temp=BUAND + "temperature", hum=BUAND + "humidity",
      values=[(BUAND + "voc_index", "COV", "mdi:air-filter", "purple", "COV", 0), (BUAND + "pm2_5", "PM2.5", "mdi:blur", "grey", "µg/m³", 0)],
      openings=[("binary_sensor.buanderie_porte", "Porte"), ("binary_sensor.fenetre_buanderie", "Fenêtre")],
      main_light=("light.buanderie", "Buanderie"),
      machines=[("binary_sensor.lave_linge_en_marche", "Lave-linge", "sensor.prise_machine_a_laver_power", "mdi:washing-machine"),
                ("binary_sensor.seche_linge_en_marche", "Sèche-linge", "sensor.prise_seche_linge_power", "mdi:tumble-dryer")],
      switches=[("switch.prise_desumidificateur", "Déshumidificateur", "sensor.prise_desumidificateur_power")]),
 dict(id="atelier", name="Atelier", icon="mdi:hammer-wrench", temp="sensor.atelier_temperature",
      motion=["binary_sensor.atelier_motion"],
      main_light=("light.atelier_atelier", "Atelier"),
      switches=[("switch.prise_makita", "Chargeur Makita", "sensor.prise_makita_power")]),
]

ETAGE = [
 dict(id="chambre_parents", name="Chambre des parents", short="Parents", icon="mdi:bed-king-outline",
      temp="sensor.chambre_des_parents_capteur_temperature_et_humidite_parent_temperature",
      hum="sensor.chambre_des_parents_capteur_temperature_et_humidite_parent_humidity",
      openings=[("binary_sensor.chambre_des_parents_fenetre", "Fenêtre"), ("binary_sensor.chambre_des_parents_velux", "Velux")],
      main_light=("light.bedroom_bedroom", "Chambre"),
      lights=[("light.bedroom_renault", "Renault"), ("light.bedroom_violaine", "Violaine"), ("light.bedroom_sphere", "Sphère"),
              ("light.bedroom_tulipe", "Tulipe"), ("light.bedroom_pendant_bedroom", "Suspension")],
      covers=[("cover.store_parents", "Store"), ("cover.velux_bedroom", "Volet velux")]),
 dict(id="chambre_alice", name="Chambre d'Alice", short="Alice", icon="mdi:bed-outline", temp="sensor.temperature_alice_temperature",
      hum="sensor.temperature_alice_humidity",
      openings=[("binary_sensor.chambre_d_alice_fenetre", "Fenêtre"), ("binary_sensor.chambre_d_alice_velux", "Velux")],
      main_light=("light.alices_bedroom_alices_bedroom", "Chambre"),
      lights=[("light.alices_bedroom_alice", "Alice"), ("light.alices_bedroom_alice_pendante", "Suspension"), ("light.lit_alice", "Lit")],
      covers=[("cover.store_alice", "Store"), ("cover.velux_alice", "Volet velux")],
      switches=[("switch.prise_chambre_alice", "Prise", None)]),
 dict(id="chambre_oriane", name="Chambre d'Oriane", short="Oriane", icon="mdi:bed-outline",
      temp="sensor.capteur_temperature_et_humidite_oriane_temperature", hum="sensor.capteur_temperature_et_humidite_oriane_humidity",
      openings=[("binary_sensor.chambre_d_oriane_fenetre_1", "Fenêtre 1"), ("binary_sensor.chambre_d_oriane_fenetre_2", "Fenêtre 2")],
      main_light=("light.orianes_bedroom_orianes_bedroom", "Chambre"),
      lights=[("light.orianes_bedroom_oriane_pendante", "Suspension")],
      covers=[("cover.oriane_gauche", "Store gauche"), ("cover.store_oriane_droit", "Store droit")]),
 dict(id="salle_de_bain_haut", name="Salle de bain du haut", short="SdB haut", icon="mdi:shower-head",
      temp="sensor.salle_de_bain_du_haut_capteur_temperature_et_humidite_temperature",
      hum="sensor.salle_de_bain_du_haut_capteur_temperature_et_humidite_humidity",
      openings=[("binary_sensor.velux_salle_de_bain_haut", "Velux")],
      main_light=("light.upstairs_bathroom_upstairs_bathroom", "Salle de bain"),
      lights=[("light.upstairs_mirror_light", "Miroir")]),
 dict(id="dressing", name="Dressing et couloir", short="Dressing", icon="mdi:wardrobe-outline", temp="sensor.walk_in_closet_sensor_temperature",
      motion=["binary_sensor.walk_in_closet_sensor_motion"],
      main_light=("light.walk_in_closet_walk_in_closet", "Dressing"),
      lights=[("light.couloirs_de_distribution", "Couloir de l'étage")],
      covers=[("cover.velux_couloir", "Fenêtre de toit")],
      switches=[("switch.prise_dressing", "Prise dressing", None)]),
]

EXTERIEUR = [
 dict(id="terrasse", name="Terrasse principale", short="Terrasse", icon="mdi:table-chair", temp="sensor.terrasse_baie_vitree_temperature",
      values=[("sensor.terrasse_baie_vitree_illuminance", "Lumière", "mdi:brightness-6", "amber", "lx", 0)],
      motion=["binary_sensor.terrasse_baie_vitree_motion"],
      main_light=("light.dehors_dehors", "Tout dehors"),
      lights=[("light.dehors_dehors_baie_vitree", "Baie vitrée"), ("light.dehors_dehors_salle_a_manger", "Salle à manger"),
              ("light.dehors_dehors_terrasse", "Terrasse"), ("light.dehors_dehors_lavandes", "Lavandes")],
      covers=[("cover.store_banne", "Store banne", "mdi:storefront-outline")],
      extra=[{"type": M + "template-card", "entity": "binary_sensor.store_banne_a_rentrer", "icon": "mdi:weather-windy",
              "primary": "Store et météo",
              "secondary": "{{ 'À rentrer : ' ~ state_attr('binary_sensor.store_banne_a_rentrer', 'raison') if is_state('binary_sensor.store_banne_a_rentrer', 'on') else 'Rafale ' ~ (states('" + MS + "wind_gusts_peak_1s_at_1318') | float(0) | round(0) | int) ~ ' km/h, rien à signaler' }}",
              "icon_color": t("'red' if is_state('binary_sensor.store_banne_a_rentrer', 'on') else 'green'"),
              "tap_action": {"action": "more-info"}, "grid_options": {"columns": 12}}]),
 dict(id="meteo", name="Météo à Mathod", icon="mdi:weather-partly-cloudy",
      extra=[{"type": "weather-forecast", "entity": "weather.terrasse_principale_meteo_suisse_at_1318_mah_weather_at_1318",
              "forecast_type": "daily", "name": "Mathod"},
             sensor_card(LUX + "outdoor_temperature", "Dehors (sonde PAC)", "mdi:thermometer", "red"),
             sensor_card(MS + "wind_gusts_peak_1s_at_1318", "Rafale", "mdi:weather-windy", "cyan")]),
 dict(id="entree_ext", name="Entrée et compost", short="Dehors entrée", icon="mdi:door-closed",
      values=[("sensor.dehors_entree_illuminance", "Lumière", "mdi:brightness-6", "amber", "lx", 0)],
      motion=["binary_sensor.dehors_entree_motion", "binary_sensor.terrasse_composte_motion"],
      lights=[("light.dehors_dehors_entree", "Entrée"), ("light.dehors_compost", "Compost")],
      extra=[{"type": "picture-entity", "entity": "camera.porte_d_entree_snapshot", "name": "Porte d'entrée",
              "show_state": False, "camera_view": "auto"}]),
]

TECHNIQUE = [
 dict(id="pac", name="Pompe à chaleur", icon="mdi:heat-pump-outline",
      extra=[{"type": M + "template-card", "entity": "sensor.pac_etat", "icon": "mdi:heat-pump",
              "icon_color": t("'orange' if is_state('binary_sensor.luxtronik_300722_07_compressor', 'on') else 'blue-grey'"),
              "primary": t("states('sensor.pac_etat') if has_value('sensor.pac_etat') else 'Pompe a chaleur'"),
              "secondary": "Voir le tableau détaillé",
              "tap_action": {"action": "navigate", "navigation_path": "/pac-chauffage/pac"},
              "grid_options": {"columns": 12}},
             {"type": M + "chips-card", "alignment": "start", "chips": [
                 chip_entity(LUX + "status", "Statut", "blue"),
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
             {"type": M + "climate-card", "entity": "climate.luxtronik_300722_07_heating", "name": "Chauffage",
              "layout": "horizontal", "grid_options": {"columns": 12}},
             {"type": M + "climate-card", "entity": "climate.luxtronik_300722_07_cooling", "name": "Rafraîchissement",
              "layout": "horizontal", "grid_options": {"columns": 12}},
             {"type": M + "template-card", "entity": "water_heater.luxtronik_300722_07_domestic_water", "icon": "mdi:water-boiler",
              "primary": "Eau chaude", "secondary": "Ballon " + t("states('" + LUX + "dhw_temperature') | float(0) | round(1)") + " °C, consigne " + t("states('number.luxtronik_300722_07_dhw_target_temperature') | float(0) | round(0) | int") + " °C" + t("' · chauffe solaire' if is_state('input_boolean.ecs_solaire_boost_actif', 'on') else ''"),
              "icon_color": t("'amber' if is_state('input_boolean.ecs_solaire_boost_actif', 'on') else 'orange'"),
              "tap_action": {"action": "more-info"}, "grid_options": {"columns": 12}},
             sensor_card(LUX + "room_thermostat_temperature", "Thermostat RBE", "mdi:thermostat", "red"),
             # flow_in = DEPART (Vorlauf), flow_out = RETOUR (Rucklauf). Mesure
             # du 22.09.2026, compresseur en marche et PAC chargeant le ballon :
             # flow_in_temperature 49,2 °C contre flow_out_temperature 46,6 °C.
             # L'eau qui part vers l'emetteur est la plus chaude ; les deux
             # etiquettes etaient inversees, et la vue annoncait un retour plus
             # chaud que le depart.
             sensor_card(LUX + "flow_in_temperature", "Départ", "mdi:arrow-right-bold", "orange"),
             sensor_card(LUX + "flow_out_temperature", "Retour", "mdi:arrow-left-bold", "blue"),
             sensor_card(LUX + "additional_heat_generator_energy", "Appoint (doit rester 0)", "mdi:resistor", "grey")]),
 dict(id="solaire", name="Solaire et réseau", icon="mdi:solar-power",
      extra=[{"type": M + "template-card", "entity": "sensor.solaredge_i1_m1_ac_power", "icon": "mdi:transmission-tower",
              "primary": t("'Export ' ~ (states('sensor.solaredge_i1_m1_ac_power') | int(0)) ~ ' W' if states('sensor.solaredge_i1_m1_ac_power') | int(0) >= 0 else 'Import ' ~ (states('sensor.solaredge_i1_m1_ac_power') | int(0) | abs) ~ ' W'"),
              "secondary": "Production " + t("states('sensor.solaredge_i1_ac_power') | int(0)") + " W",
              "icon_color": t("'green' if states('sensor.solaredge_i1_m1_ac_power') | int(0) >= 0 else 'red'"),
              "tap_action": {"action": "more-info"}, "grid_options": {"columns": 12}},
             sensor_card("sensor.puissance_phase_a", "Phase A (buanderie)", "mdi:alpha-a-circle-outline", "grey"),
             sensor_card("sensor.puissance_phase_b", "Phase B (maison)", "mdi:alpha-b-circle-outline", "grey"),
             sensor_card("sensor.puissance_phase_c", "Phase C (cuisine)", "mdi:alpha-c-circle-outline", "grey"),
             sensor_card("sensor.lumieres_power", "Lampes", "mdi:lightbulb-group", "amber"),
             sensor_card("sensor.prise_rack_power", "Rack", "mdi:server", "indigo"),
             sensor_card("sensor.electricity_maps_co2_intensity", "CO₂ du réseau", "mdi:molecule-co2", "green"),
             {"type": "energy-distribution", "link_dashboard": True}]),
 dict(id="local", name="Local technique et garage", icon="mdi:garage-variant",
      openings=[("binary_sensor.fenetre_cave", "Fenêtre cave"), ("binary_sensor.garage_porte_gauche", "Garage voiture"),
                ("binary_sensor.garage_porte_droite", "Garage vélo")],
      lights=[("light.local_technique", "Local technique")],
      switches=[("switch.prise_cave", "Congélateur", "sensor.prise_cave_power")],
      extra=[sensor_card("binary_sensor.zigbee2mqtt_bridge_connection_state", "zigbee2mqtt", "mdi:zigbee", "green"),
             sensor_card("binary_sensor.porch_ring_link", "Chaîne Ring", "mdi:doorbell-video", "green")]),
]

# ----------------------------------------------------------------------------
def room_nav_card(r, path):
    lights_on = (f"expand(area_entities('{r['id']}')) | selectattr('domain', 'eq', 'light') | selectattr('state', 'eq', 'on') "
                 "| rejectattr('attributes.is_hue_group', 'defined') | list | count")
    sec = []
    if r.get("temp"): sec.append(f"{{{{ (states('{r['temp']}') | float(0) | round(1)) if has_value('{r['temp']}') else '–' }}}} °C")
    if r.get("hum"): sec.append(f"{{{{ (states('{r['hum']}') | float(0) | round(0) | int) if has_value('{r['hum']}') else '–' }}}} %")
    secondary = " · ".join(sec) if sec else ""
    lamp = "" if sec else "{% set n = " + lights_on + " %}{{ n ~ ' lampe' ~ ('s' if n > 1) if n else 'Éteint' }}"
    open_ids = [e for e, _ in r.get("openings", [])]
    badge = ""
    if open_ids:
        cond = " or ".join(f"is_state('{e}', 'on')" for e in open_ids)
        badge = t(f"'mdi:window-open-variant' if ({cond}) else ''")
    return {"type": M + "template-card", "icon": r["icon"], "primary": r.get("short", r["name"]), "secondary": secondary + lamp,
            "icon_color": t(f"'amber' if ({lights_on}) > 0 else 'blue-grey'"),
            "badge_icon": badge, "badge_color": "orange", "layout": "vertical", "fill_container": True,
            "tap_action": {"action": "navigate", "navigation_path": path}, "grid_options": {"columns": 4, "rows": 2}}

AREA_IDS = {"salon": "salon", "cuisine": "cuisine", "bureau": "bureau", "entree": "entree", "salle_de_bain_bas": "salle_de_bain_bas",
            "buanderie": "buanderie", "atelier": "atelier", "chambre_parents": "chambre_parents", "chambre_alice": "chambre_alice",
            "chambre_oriane": "chambre_oriane", "salle_de_bain_haut": "salle_de_bain_haut", "dressing": "dressing",
            "terrasse": "terrasse_principale", "entree_ext": "entree_exterieure"}

def overview():
    lampes = ("states.light | selectattr('state', 'eq', 'on') | rejectattr('attributes.is_hue_group', 'defined') | list | count")
    ouvrants = ("states.binary_sensor | selectattr('attributes.device_class', 'in', ['window', 'door', 'opening']) | selectattr('state', 'eq', 'on') "
                "| rejectattr('entity_id', 'in', ['binary_sensor.dishwasher_door', 'binary_sensor.buanderie_porte', 'binary_sensor.sous_escalier_porte_sous_escalier']) | list | count")
    head = {"type": "grid", "cards": [
        {"type": M + "title-card",
         # « user » est fourni par Home Assistant et par Mushroom a leurs
         # gabarits (hass.user.name) : chacun lit son propre prenom.
         "title": t("'Bonjour' if now().hour < 18 else 'Bonsoir'") + " " + t("user"),
         "subtitle": "{% set j = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'] %}{% set m = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'] %}{{ j[now().weekday()] | capitalize }} {{ now().day }} {{ m[now().month - 1] }} · " + t("states('" + MS + "temperature_at_1318') | float(0) | round(0) | int") + " °C à Mathod",
         "alignment": "start"},
        {"type": M + "chips-card", "alignment": "start", "chips": [
            {"type": "weather", "entity": "weather.terrasse_principale_meteo_suisse_at_1318_mah_weather_at_1318", "show_conditions": True, "show_temperature": True},
            # content_info: name affiche le prenom et non l'etat : sans lui,
            # deux puces « Home » identiques ne se distinguent pas.
            *[{"type": "entity", "entity": f"person.{p}", "content_info": "name",
               "icon_color": t(f"'green' if is_state('person.{p}', 'home') else 'grey'")}
              for p in PERSONNES],
            {"type": "entity", "entity": "input_select.maison_mode", "icon": "mdi:home-switch-outline", "icon_color": "indigo"},
            {"type": "template", "icon": "mdi:lightbulb-group", "icon_color": t(f"'amber' if ({lampes}) > 0 else 'grey'"),
             # Le compte porte sur toute la maison : il mene au panneau Lights
             # de Home Assistant (url_path « light », au singulier ; « lights »
             # renvoie un 404) et non au seul rez-de-chaussee.
             "content": "{% set n = " + lampes + " %}{{ n }} lampe{{ 's' if n != 1 }}", "tap_action": {"action": "navigate", "navigation_path": "/light"}},
            {"type": "conditional", "conditions": CHAUD,
             "chip": {"type": "template", "entity": "binary_sensor.etage_ouvrants",
                      "icon": "mdi:sun-thermometer", "icon_color": "red",
                      "content": "Fermer l'étage",
                      "tap_action": {"action": "navigate", "navigation_path": "/maison-pieces/ouvrants"}}},
            {"type": "template", "entity": "sensor.maison_ouvrants",
             "icon": t("'mdi:window-open-variant' if states('sensor.maison_ouvrants') | int(0) > 0 else 'mdi:window-closed-variant'"),
             "icon_color": t("'orange' if states('sensor.maison_ouvrants') | int(0) > 0 else 'green'"),
             "content": t("states('sensor.maison_ouvrants') | int(0)") + " ouvert" + t("'s' if states('sensor.maison_ouvrants') | int(0) != 1 else ''"),
             "tap_action": {"action": "navigate", "navigation_path": "/maison-pieces/ouvrants"}},
            {"type": "template", "entity": "sensor.solaredge_i1_m1_ac_power", "icon": "mdi:solar-power",
             "icon_color": t("'green' if states('sensor.solaredge_i1_m1_ac_power') | int(0) >= 0 else 'red'"),
             "content": t("(states('sensor.solaredge_i1_ac_power') | int(0) / 1000) | round(1)") + " kW · " + t("'export' if states('sensor.solaredge_i1_m1_ac_power') | int(0) >= 0 else 'import'") + " " + t("(states('sensor.solaredge_i1_m1_ac_power') | int(0) | abs / 1000) | round(1)") + " kW",
             "tap_action": {"action": "navigate", "navigation_path": "/maison-pieces/technique"}},
            {"type": "template", "entity": LUX + "dhw_temperature", "icon": "mdi:water-boiler",
             "icon_color": t("'amber' if is_state('input_boolean.ecs_solaire_boost_actif', 'on') else 'orange'"),
             "content": t("states('" + LUX + "dhw_temperature') | float(0) | round(0) | int") + " °C", "tap_action": {"action": "more-info"}},
        ]},
    ]}
    modes = {"type": "grid", "cards": [
        {"type": M + "title-card", "title": "Actions", "alignment": "start"},
        {"type": M + "template-card", "icon": "mdi:weather-night", "icon_color": "indigo", "primary": "Bonne nuit",
         "secondary": "Lumières, rez et garage", "layout": "vertical", "fill_container": True,
         "tap_action": {"action": "perform-action", "perform_action": "script.maison_nuit",
                        "confirmation": {"text": "Éteindre toutes les lumières et contrôler le rez et le garage ?"}}, "grid_options": {"columns": 4, "rows": 2}},
        {"type": M + "template-card", "icon": "mdi:home-export-outline", "icon_color": "orange", "primary": "Je pars",
         "secondary": "Lumières et tous les ouvrants", "layout": "vertical", "fill_container": True,
         "tap_action": {"action": "perform-action", "perform_action": "script.maison_absent",
                        "confirmation": {"text": "Éteindre toutes les lumières et contrôler tous les ouvrants ?"}}, "grid_options": {"columns": 4, "rows": 2}},
        {"type": M + "template-card", "icon": "mdi:chart-line", "icon_color": "teal", "primary": "Courbes",
         "secondary": "24 h, toutes les pièces", "layout": "vertical", "fill_container": True,
         "tap_action": {"action": "navigate", "navigation_path": "/maison-pieces/courbes"}, "grid_options": {"columns": 4, "rows": 2}},
        {"type": M + "template-card", "entity": "sensor.maison_ouvrants",
         "icon": t("'mdi:shield-check' if (" + OUV_N + ") == 0 else 'mdi:window-open-variant'"),
         "icon_color": t("'green' if (" + OUV_N + ") == 0 else 'orange'"), "primary": "Ouvrants",
         "secondary": "{% set n = " + OUV_N + " %}{{ 'Tout est fermé' if n == 0 else n ~ ' ouvert' ~ ('s' if n > 1 else '') }}",
         "layout": "vertical", "fill_container": True,
         "tap_action": {"action": "navigate", "navigation_path": "/maison-pieces/ouvrants"}, "grid_options": {"columns": 4, "rows": 2}},
        {"type": M + "template-card", "icon": "mdi:tune-variant", "icon_color": "blue-grey", "primary": "Réglages",
         "secondary": "Seuils et automatismes", "layout": "vertical", "fill_container": True,
         "tap_action": {"action": "navigate", "navigation_path": "/reglages-maison"}, "grid_options": {"columns": 4, "rows": 2}},
        {"type": M + "template-card", "icon": "mdi:doorbell-video", "icon_color": "cyan", "primary": "Sonnette",
         "secondary": "Journal du jour", "layout": "vertical", "fill_container": True,
         "tap_action": {"action": "navigate", "navigation_path": "/sonnette-cam"}, "grid_options": {"columns": 4, "rows": 2}},
        {"type": M + "template-card", "icon": "mdi:lightning-bolt", "icon_color": "green", "primary": "Énergie",
         "secondary": "Tableau du jour", "layout": "vertical", "fill_container": True,
         "tap_action": {"action": "navigate", "navigation_path": "/energy"}, "grid_options": {"columns": 4, "rows": 2}},
        {"type": M + "template-card", "entity": "sensor.pac_etat", "icon": "mdi:heat-pump",
         "icon_color": t("'orange' if is_state('binary_sensor.luxtronik_300722_07_compressor', 'on') else 'blue-grey'"),
         "primary": "PAC",
         # L'etat vivant plutot qu'un libelle fige : la tuile renseigne avant
         # meme qu'on la touche.
         "secondary": t("states('sensor.pac_etat') if has_value('sensor.pac_etat') else 'Tableau de la pompe a chaleur'"),
         "layout": "vertical", "fill_container": True,
         "tap_action": {"action": "navigate", "navigation_path": "/pac-chauffage/pac"}, "grid_options": {"columns": 4, "rows": 2}},
    ]}
    def rooms_section(title, rooms, path):
        cards = [{"type": M + "title-card", "title": title, "alignment": "start"}]
        for r in rooms:
            rr = dict(r); rr["id"] = AREA_IDS.get(r["id"], r["id"])
            cards.append(room_nav_card(rr, path))
        return {"type": "grid", "cards": cards}
    machines = {"type": "grid", "cards": [
        {"type": M + "title-card", "title": "En ce moment", "alignment": "start"},
        machine_card("binary_sensor.lave_linge_en_marche", "Lave-linge", "sensor.prise_machine_a_laver_power", "mdi:washing-machine"),
        machine_card("binary_sensor.seche_linge_en_marche", "Sèche-linge", "sensor.prise_seche_linge_power", "mdi:tumble-dryer"),
        {"type": M + "template-card", "entity": "binary_sensor.garage_porte_gauche", "icon": "mdi:garage-variant", "primary": "Garage voiture",
         "secondary": "{% if is_state('binary_sensor.garage_porte_gauche', 'on') %}Ouvert depuis " + duree_fr("states.binary_sensor.garage_porte_gauche") + "{% else %}Fermé{% endif %}",
         "icon_color": t("'orange' if is_state('binary_sensor.garage_porte_gauche', 'on') else 'grey'"), "grid_options": {"columns": 6, "rows": 1}},
        {"type": M + "template-card", "entity": "binary_sensor.garage_porte_droite", "icon": "mdi:bicycle", "primary": "Garage vélo",
         "secondary": "{% if is_state('binary_sensor.garage_porte_droite', 'on') %}Ouvert depuis " + duree_fr("states.binary_sensor.garage_porte_droite") + "{% else %}Fermé{% endif %}",
         "icon_color": t("'orange' if is_state('binary_sensor.garage_porte_droite', 'on') else 'grey'"), "grid_options": {"columns": 6, "rows": 1}},
        {"type": M + "template-card", "entity": "sensor.prise_cave_power", "icon": "mdi:fridge-outline",
         "primary": "Congélateur",
         "secondary": t("states('sensor.prise_cave_power') | float(0) | round(0) | int") + " W" + t("' · PRISE COUPÉE' if is_state('switch.prise_cave', 'off') else ''"),
         "icon_color": t("'red' if is_state('switch.prise_cave', 'off') else 'cyan'"),
         "tap_action": {"action": "more-info"}, "grid_options": {"columns": 6, "rows": 1}},
        {"type": M + "template-card", "entity": "cover.store_banne", "icon": "mdi:storefront-outline", "primary": "Store banne",
         "secondary": t("'Sorti' if is_state('cover.store_banne', 'open') else 'Rentré'"),
         "icon_color": t("'amber' if is_state('cover.store_banne', 'open') else 'grey'"),
         "tap_action": {"action": "more-info"}, "grid_options": {"columns": 6, "rows": 1}},
    ]}
    head["cards"] += machines["cards"][1:]
    return {"title": "Maison", "path": "maison", "icon": "mdi:home", "type": "sections", "max_columns": 3,
            "sections": [head, modes, rooms_section("Rez", [r for r in REZ], "/maison-pieces/rez"),
                         rooms_section("Étage", ETAGE, "/maison-pieces/etage"),
                         rooms_section("Extérieur", [r for r in EXTERIEUR if r["id"] != "meteo"], "/maison-pieces/exterieur")]}

def floor_view(title, path, icon, rooms):
    return {"title": title, "path": path, "icon": icon, "type": "sections", "max_columns": 4,
            "sections": [room_section(r) for r in rooms]}

def courbes():
    def hg(title, ents):
        return {"type": "history-graph", "title": title, "hours_to_show": 24, "entities": [{"entity": e, "name": n} for e, n in ents]}
    return {"title": "Courbes 24 h", "path": "courbes", "subview": True, "type": "sections", "max_columns": 3, "sections": [
        {"type": "grid", "cards": [{"type": M + "chips-card", "chips": [{"type": "back"}]}, hg("Températures", [
            (SALON_T + "temperature", "Salon"), ("sensor.bureau_temperature_et_humidite_bureau_temperature", "Bureau"),
            ("sensor.entree_entree_temperature", "Entrée"), ("sensor.salle_de_bain_du_bas_temperature", "SdB bas"),
            ("sensor.chambre_des_parents_capteur_temperature_et_humidite_parent_temperature", "Parents"),
            ("sensor.temperature_alice_temperature", "Alice"), ("sensor.capteur_temperature_et_humidite_oriane_temperature", "Oriane"),
            ("sensor.salle_de_bain_du_haut_capteur_temperature_et_humidite_temperature", "SdB haut"),
            (LUX + "outdoor_temperature", "Dehors")])]},
        {"type": "grid", "cards": [hg("Humidités", [
            (SALON_T + "humidity", "Salon"), ("sensor.bureau_temperature_et_humidite_bureau_humidity", "Bureau"),
            ("sensor.salle_de_bain_du_bas_humidity", "SdB bas"),
            ("sensor.chambre_des_parents_capteur_temperature_et_humidite_parent_humidity", "Parents"),
            ("sensor.capteur_temperature_et_humidite_oriane_humidity", "Oriane"),
            ("sensor.salle_de_bain_du_haut_capteur_temperature_et_humidite_humidity", "SdB haut"),
            (BUAND + "humidity", "Buanderie")])]},
        {"type": "grid", "cards": [hg("COV et particules", [
            (SALON_T + "voc_index", "COV salon"), (BUAND + "voc_index", "COV buanderie"),
            (SALON_T + "pm2_5", "PM2.5 salon"), (BUAND + "pm2_5", "PM2.5 buanderie")]),
            hg("Solaire, réseau et ballon", [("sensor.solaredge_i1_ac_power", "Production"),
                                            ("sensor.solaredge_i1_m1_ac_power", "Compteur"), (LUX + "dhw_temperature", "Ballon")])]},
    ]}

# ----------------------------------------------------------------------------
# Sous-vue « Ouvrants » : les quatorze ouvrants de la maison, ouverts ET fermes,
# groupes par etage. Elle est en subview (pas d'onglet) : on y arrive par la
# tuile de la vue Maison et par la notification. Huit ouvrants ont un capteur
# compagnon sensor.<base>_position (Fermee / Ouverte / Imposte) ; quand il vaut
# Imposte le sous-texte le dit. cover.velux_couloir est un cover : ouvert = son
# etat est dans ['open', 'opening'].
ICONES_OUVRANT = {"window": ("mdi:window-open-variant", "mdi:window-closed-variant"),
                  "door": ("mdi:door-open", "mdi:door-closed"),
                  "garage": ("mdi:garage-open-variant", "mdi:garage-variant")}

# Genre du nom de l'ouvrant, pour accorder « Ouverte » et « Fermee ». Le
# feminin est la regle dans la maison (fenetre, porte, imposte, baie) ; seuls
# ces premiers mots-la sont masculins.
MASCULIN = {"vélux", "velux", "volet", "store", "portail", "battant"}

def opening_card(e, name, court, kind="window", position=None):
    """Demi-carte d'un ouvrant. Le titre nomme la piece ET l'ouvrant
    (« Alice — fenetre ») : la vue les melange tous, « Fenetre » seul ne disait
    pas laquelle. Le sous-texte dit l'etat plutot que de repeter la piece,
    accorde en genre."""
    dom, obj = e.split(".")
    ouvert = f"states('{e}') in ['open', 'opening']" if dom == "cover" else f"is_state('{e}', 'on')"
    inconnu = f"states('{e}') in ['unavailable', 'unknown']"
    fem = name.split()[0].lower() not in MASCULIN
    on_icon, off_icon = ICONES_OUVRANT[kind]
    sec = "{% if " + inconnu + " %}Indisponible"
    if position:
        sec += ("{% elif is_state('" + position + "', 'Imposte') %}"
                "En imposte depuis " + duree_fr("states." + position))
    sec += ("{% elif " + ouvert + " %}" + ("Ouverte" if fem else "Ouvert") + " depuis "
            + duree_fr("states." + dom + "." + obj)
            + "{% else %}" + ("Fermée" if fem else "Fermé") + "{% endif %}")
    # Les portes de garage n'ont pas de piece a nommer : leur bloc le dit deja.
    titre = f"{court} — {name.lower()}" if court else name
    return {"type": M + "template-card", "entity": e, "primary": titre, "secondary": sec,
            "icon": t(f"'{on_icon}' if {ouvert} else '{off_icon}'"),
            "icon_color": t(f"'grey' if {inconnu} else ('orange' if {ouvert} else 'green')"),
            "tap_action": {"action": "more-info"}, "grid_options": {"columns": 6, "rows": 1}}

# Le troisieme champ est le nom COURT de la piece, celui qui prefixe le titre
# (« Alice — fenetre »), pas le nom complet de la zone : la vue melange les
# etages, le titre doit tenir sur une demi-carte. None pour le garage, dont le
# bloc nomme deja la piece.
OUVRANTS = [
 ("Rez", None, [
  ("binary_sensor.cuisine_fenetre", "Fenêtre", "Cuisine", "window", "sensor.cuisine_fenetre_position"),
  ("binary_sensor.cuisine_porte_vitree", "Porte vitrée", "Cuisine", "door", "sensor.cuisine_porte_vitree_position"),
  ("binary_sensor.salon_porte_vitree", "Porte vitrée", "Salon", "door", "sensor.salon_porte_vitree_position"),
  ("binary_sensor.salle_de_bain_du_bas_imposte", "Fenêtre", "Salle de bain", "window", "sensor.salle_de_bain_du_bas_imposte_position"),
 ]),
 ("Étage", None, [
  ("binary_sensor.chambre_d_alice_fenetre", "Fenêtre", "Alice", "window", "sensor.chambre_d_alice_fenetre_position"),
  ("binary_sensor.chambre_d_alice_velux", "Vélux", "Alice", "window", None),
  ("binary_sensor.chambre_d_oriane_fenetre_1", "Fenêtre 1", "Oriane", "window", "sensor.chambre_d_oriane_fenetre_1_position"),
  ("binary_sensor.chambre_d_oriane_fenetre_2", "Fenêtre 2", "Oriane", "window", "sensor.chambre_d_oriane_fenetre_2_position"),
  ("binary_sensor.chambre_des_parents_fenetre", "Fenêtre", "Parents", "window", "sensor.chambre_des_parents_fenetre_position"),
  ("binary_sensor.chambre_des_parents_velux", "Vélux", "Parents", "window", None),
  ("binary_sensor.velux_salle_de_bain_haut", "Vélux", "Salle de bain", "window", None),
  ("cover.velux_couloir", "Fenêtre de toit", "Couloir", "window", None),
 ]),
 ("Garage", "Ces deux portes ne comptent que dans le contrôle du coucher, pas dans celui du départ.", [
  ("binary_sensor.garage_porte_gauche", "Porte voiture", None, "garage", None),
  ("binary_sensor.garage_porte_droite", "Porte vélo", None, "garage", None),
 ]),
]

OUV_N = "states('sensor.maison_ouvrants') | int(0)"

# Le systeme "demande de fermer" quand le package chaleur_etage juge qu'il
# fait plus chaud dehors que dedans ET qu'un ouvrant de l'etage est reste
# ouvert. Les cartes portant ces conditions disparaissent le reste du temps :
# visibility: pour une carte, chip conditionnel pour une puce.
CHAUD = [{"condition": "state", "entity": "binary_sensor.etage_il_fait_chaud", "state": "on"},
         {"condition": "state", "entity": "binary_sensor.etage_ouvrants", "state": "on"}]
OUV_NUIT = "state_attr('sensor.maison_ouvrants', 'nb_nuit') | int(0)"

def ouvrants():
    titre = ("{% if not has_value('sensor.maison_ouvrants') %}Ouvrants : état inconnu"
             "{% else %}{% set n = " + OUV_N + " %}"
             "{{ 'Tout est fermé' if n == 0 else n ~ ' ouvrant' ~ ('s' if n > 1 else '') ~ ' ouvert' ~ ('s' if n > 1 else '') }}"
             "{% endif %}")
    # Le sous-titre nomme l'endroit plutot que de repeter "au rez ou au garage" :
    # nb_nuit compte les deux ensemble, on redecoupe ici en interrogeant les
    # deux portes de garage, les seules du lot qui ne soient pas au rez.
    sous = ("{% set g = " + OUV_NUIT + " %}"
            "{% set gar = ['binary_sensor.garage_porte_gauche', 'binary_sensor.garage_porte_droite']"
            " | select('is_state', 'on') | list | count %}"
            "{% set rez = g - gar %}"
            "{% if g == 0 %}Coucher : rien d'ouvert"
            "{% elif gar == 0 %}Coucher : {{ rez }} ouvrant{{ 's' if rez > 1 else '' }} au rez"
            "{% elif rez == 0 %}Coucher : {{ gar }} porte{{ 's' if gar > 1 else '' }} de garage"
            "{% else %}Coucher : {{ rez }} au rez, {{ gar }} au garage{% endif %}")
    banniere = {"type": M + "template-card", "entity": "binary_sensor.etage_il_fait_chaud",
                "icon": "mdi:sun-thermometer", "icon_color": "red",
                "primary": "Il fait chaud dehors, fermez l'étage",
                "secondary": t("state_attr('binary_sensor.etage_il_fait_chaud', 'raison')"),
                "tap_action": {"action": "more-info"},
                "grid_options": {"columns": 12},
                "visibility": CHAUD}
    sections = [{"type": "grid", "cards": [
        {"type": M + "chips-card", "chips": [{"type": "back"}]},
        {"type": M + "title-card", "title": titre, "subtitle": sous, "alignment": "start"},
        banniere]}]
    for bloc, sstitre, items in OUVRANTS:
        tc = {"type": M + "title-card", "title": bloc, "alignment": "start"}
        if sstitre: tc["subtitle"] = sstitre
        sections.append({"type": "grid", "cards": [tc] + [opening_card(*o) for o in items]})
    return {"title": "Ouvrants", "path": "ouvrants", "icon": "mdi:window-open-variant", "subview": True,
            "type": "sections", "max_columns": 2, "sections": sections}

HEADER = """# Tableau de bord « Maison » (Mushroom) — GENERE par gen_maison.py, ne pas
# editer a la main : modifier le script et regenerer.
#
# LE SCRIPT VIT ICI : p-cloud, /home/rjl/homelab/homeassistant/gen_maison.py
# (copie de secours dans le dossier memoire de Claude, gen_maison.py.txt).
#
# ATTENTION, IL EN EXISTE DEUX EXEMPLAIRES, fichiers distincts au contenu
# identique (constate le 22.09.2026) :
#   /home/rjl/homelab/homeassistant/gen_maison.py
#   /home/rjl/homelab/homeassistant/config/homelab/gen_maison.py
# Modifier l'un laisse l'autre perime SANS AUCUN BRUIT : la prochaine personne
# qui lance le mauvais exemplaire regenere une version ancienne et efface le
# travail. Toujours modifier LES DEUX, et le verifier par un md5sum des deux
# chemins ci-dessus, qui doit rendre la meme empreinte.
# Une copie de reference est aussi versionnee dans le depot chauffage, en
# ha/reference/gen_maison.py.
# Le lancer depuis ce dossier ecrit maison.yaml a cote, a copier ensuite dans
# le conteneur : docker cp maison.yaml homeassistant:/config/dashboards/
#
# Une carte par piece : titre avec temperature et humidite vivantes, chips des
# mesures et ouvrants, lumiere principale sur une ligne (curseur de
# luminosite, couleur de la lampe), autres lampes en demi-cartes, volets avec
# curseur de position, prises et machines en cartes template (couleur selon
# l'etat, puissance en sous-texte). La vue Maison : salutation, chips d'etat,
# actions (modes, courbes, autres tableaux), une carte de navigation par piece
# (icone ambre si une lampe est allumee, badge si un ouvrant est ouvert).
#
# Cartes : Mushroom v5 (HACS piitaya/lovelace-mushroom, installe le
# 2026-09-20), ressource /hacsfiles/lovelace-mushroom/mushroom.js. Fichier
# YAML : /config/dashboards/maison.yaml, declare dans configuration.yaml
# (lovelace.dashboards.maison-pieces). Relu a chaque actualisation de la page.
# Tous les templates lisent les etats avec un defaut (float(0), int(0)) : rien
# ne plante quand une entite est indisponible au demarrage.

"""

doc = {"title": "Maison", "views": [
    overview(),
    floor_view("Rez", "rez", "mdi:home-floor-0", REZ),
    floor_view("Étage", "etage", "mdi:home-floor-1", ETAGE),
    floor_view("Extérieur", "exterieur", "mdi:tree-outline", EXTERIEUR),
    floor_view("Technique", "technique", "mdi:heat-pump-outline", TECHNIQUE),
    courbes(),
    ouvrants(),
]}
out = HEADER + yaml.dump(doc, allow_unicode=True, sort_keys=False, width=1000)
open("maison.yaml", "w").write(out)
print("maison.yaml :", len(out.splitlines()), "lignes")
