# Naming, renaming, rooms

## Two names, two jobs

- The **entity id** (`light.lustre_salon`) is for machines: automations,
  dashboards and scripts point at it. Lowercase ASCII letters, digits and
  underscores; its domain (`light.`) is fixed by what the entity is.
- The **name** ("Lustre du salon") is for people, in their language, with
  capitals and accents. Voice assistants use it.

A scheme decides the ids. The names follow the device's name and the room.

## Proposing a scheme

Never impose one. Read the installation first: if most ids already follow a
pattern, propose to keep it and fix the exceptions. Otherwise show two or
three schemes **with five real entities of their own house renamed in each**,
in a form, and let the user choose. The usual candidates:

| Scheme | Example | Good for |
|---|---|---|
| `<domain>.<what>_<room>` | `light.lustre_salon`, `binary_sensor.do_entree` | reading aloud; the user's own example |
| `<domain>.<room>_<what>` | `light.salon_lustre`, `binary_sensor.entree_do` | lists sorted by room |
| `<domain>.<floor>_<room>_<what>` | `light.rdc_salon_lustre` | large houses, several rooms of the same name |

Short codes for what a sensor measures keep ids short. Propose a table and
write the one the user accepts in your sheet, for example:

| Code | Meaning | Domain it lands in |
|---|---|---|
| `do` | door opening | `binary_sensor` |
| `wo` | window opening | `binary_sensor` |
| `mo` | motion or presence | `binary_sensor` |
| `temp`, `hum`, `lux` | temperature, humidity, light level | `sensor` |
| `pwr`, `nrg` | power (W), energy (kWh) | `sensor` |
| `bat` | battery level | `sensor` |

The user may write `sensor.do_entree` for a door contact: say once, simply,
that Home Assistant files a contact under `binary_sensor`, so the id will be
`binary_sensor.do_entree` — the scheme is theirs, the domain is not.

Rules that hold in every scheme:

- lowercase, `a-z0-9_`, no accent (`entrée` → `entree`), no brand or model;
- rooms written exactly as the area's id, so that an id and its room agree;
- one word order for the whole house; singular;
- a number only to tell two identical things in one room apart
  (`light.spot_cuisine_1`, `_2`), never as a default;
- the secondary entities of a device share its stem
  (`binary_sensor.do_entree`, `sensor.do_entree_bat`).

Write the chosen scheme, its codes and its exceptions in
`home/<service-id>/installation.md`. Every later job uses it without asking
again.

## Renaming in bulk

A rename changes the id everywhere the registry knows it, and in the history
of recent versions — **not** inside automations, scripts, scenes, templates
and dashboards, which keep naming the old id and silently stop working. So:

1. **Build the table.** For each entity: old id, new id, name, room. Check:
   same domain; no new id already taken (against the whole registry); no two
   entities mapped to one id; nothing disabled or from YAML slipped in.
2. **Find what names the old ids.** For each: `search/related` with
   `{"item_type": "entity", "item_id": "<old id>"}` gives the automations,
   scripts, scenes and groups. For the dashboards: read each one's
   configuration (`references/dashboards.md`) and search the old ids in it.
   Templates inside helpers and YAML files are out of your reach: list them
   as "to check by hand" when an old id is likely used there.
3. **Show the table** to the user — old, new, name, room, and where it is
   used — and get their go-ahead. Past fifty entities, go room by room.
4. **Save the way back**: the table in
   `home/<service-id>/renames/<date>-<subject>.json`. Propose a backup first
   when the table is long.
5. **Apply**, fifty commands at most per `ha_command`, with
   `continue_on_error` off: a refusal stops the batch, and you know where.
6. **Repair what named the old ids.** Automations, scripts, scenes: read the
   configuration, replace the exact ids, write it back
   (`references/automations.md`). Dashboards: read, replace, save. Replace
   whole ids only — `light.salon` must not rewrite `light.salon_2`.
7. **Verify**: the registry holds the new ids; `search/related` on a few new
   ids shows their automations again; `repairs/list_issues` and the
   `unavailable` list did not grow.

Undoing is the same job with the table reversed.

## Rooms, floors, labels

- Create the floors before the areas, the areas before placing devices.
- Place the **device**; its entities follow. Give an entity its own area only
  when it really is elsewhere (a probe on a long wire).
- A label is for what cuts across rooms: "holiday mode", "night", "critical".
  Propose a few, do not label everything.
- Hide (`hidden_by: "user"`) what clutters without being useless; disable
  (`disabled_by: "user"`) what nobody will ever read — a disabled entity
  stops updating. Say which you chose and why.
- Deleting an area unplaces what was in it. Show what it holds first.
