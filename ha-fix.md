# Corrections Home Assistant — Nussbaum Therm-Control

## Bug 1 — URLs inversées entre contrôleurs

Les entités `nb_controller_rez` et `nb_controller_etage` pointent vers les mauvais hosts.

**Mapping correct :**

| Contrôleur | Host | Pièces |
|------------|------|--------|
| Rez-de-chaussée | `therm-control.local` | Salon, Bureau, SDB Bas (3 pièces) |
| Étage | `therm-control-2.local` | SDB Haut, Réduit, Oriane, Parent (4 pièces) |

**Problème :** `nb_controller_rez` pointe actuellement vers `therm-control-2.local` (= étage) et `nb_controller_etage` vers `therm-control.local` (= rez). Toutes les URLs doivent être permutées :
- Settings URLs
- Rooms URLs
- XSRF token URLs
- rest_commands

## Bug 2 — Batteries toutes sur id:1

Les templates batterie de **Réduit, Parent, Oriane, Bureau, SDB Bas** utilisent tous `selectattr('id','equalto',1)` au lieu de l'id correct de chaque pièce.

**Mapping correct des ids :**

| Contrôleur | id | Pièce |
|------------|-----|-------|
| Rez (`therm-control.local`) | 1 | Salon |
| Rez | 2 | Bureau |
| Rez | 3 | SDB Bas |
| Étage (`therm-control-2.local`) | 1 | SDB Haut |
| Étage | 2 | Réduit |
| Étage | 3 | Oriane |
| Étage | 4 | Parent |

Chaque template batterie doit utiliser le bon `id` correspondant à la pièce.

## Bug 3 — Typo dans le nom d'entité

`"NB - Bureau - Temparature"` → `"NB - Bureau - Temperature"`

(Faute de frappe : "Temparature" au lieu de "Temperature")
