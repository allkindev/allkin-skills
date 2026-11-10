# Automations, scripts, scenes

## From a wish to an automation

1. **Say it back** as *when* (triggers), *only if* (conditions), *then*
   (actions), with the real entities, read from the installation. Ask what is
   missing and matters: the hours, the threshold, how long a state must hold,
   what happens when nobody is home, who is told. Do not ask what has an
   obvious answer.
2. **Check every piece exists**: each entity (`GET /api/states/<entity_id>`),
   each service (`get_services`), each notification target.
3. **Mirror this installation's syntax.** Read one existing automation
   (`GET /api/config/automation/config/<id>`; ids are in the `id` attribute
   of the `automation.*` states) and write yours the same way. Recent
   versions write `triggers` / `conditions` / `actions`, a trigger as
   `{"trigger": "state", …}` and an action as `{"action": "light.turn_on", …}`;
   older ones write `trigger` / `condition` / `action`, `{"platform": "state", …}`
   and `{"service": "light.turn_on", …}`.
4. **Validate** before creating (`ha_command`, a read):
   `{ "type": "validate_config", "triggers": […], "conditions": […], "actions": […] }`
   — each part comes back `valid` or with its error.
5. **Show it**: the sentence in the user's words, then the configuration.
   The approval card will show the call; the user must already know what it
   does.
6. **Create it** (REST, on a card): `POST /api/config/automation/config/<id>`
   with the whole configuration as body. `<id>` is a new unique string — the
   current time in milliseconds does. Home Assistant reloads by itself; the
   entity is `automation.<alias in lowercase with underscores>`.
7. **Test it**, with the user's agreement — a test really acts on the house.
   Either they do the real thing (open the door), or you call
   `automation.trigger` with `{"entity_id": "automation.…", "skip_condition": false}`.
   Then read what ran: `{ "type": "trace/list", "domain": "automation", "item_id": "<id>" }`,
   and `trace/get` with its `run_id` when it did not do what was expected.

```json
{ "alias": "Entrée – lumière à l'ouverture de la porte, la nuit",
  "description": "Asked on 2026-11-10: light the hall for 3 minutes when the door opens after sunset.",
  "mode": "restart",
  "triggers": [ { "trigger": "state", "entity_id": "binary_sensor.do_entree", "to": "on" } ],
  "conditions": [ { "condition": "sun", "after": "sunset", "before": "sunrise" } ],
  "actions": [
    { "action": "light.turn_on", "target": { "entity_id": "light.plafonnier_entree" } },
    { "delay": "00:03:00" },
    { "action": "light.turn_off", "target": { "entity_id": "light.plafonnier_entree" } } ] }
```

## What makes one good

- **One intention per automation.** Two wishes are two automations.
- **A name people recognise**: "<Room> – <what happens>", in their language;
  the description says why it exists and when it was asked.
- **`mode` chosen on purpose**: `restart` for "light on, then off after a
  while" (a new opening restarts the countdown); `single` for a notification;
  `queued` when each event must be handled in turn.
- **`for`** on a state trigger that can bounce (a door ajar, a power reading):
  "open for 10 minutes", not "open".
- **Entities, not devices**: a trigger or an action written with an
  `entity_id` survives the replacement of the device; one written with a
  `device_id` does not.
- **A trigger, not a poll**: a state, a numeric threshold, a time, the sun —
  never a template evaluated every minute when a trigger exists.
- **The exit is planned**: what turns it off, what happens at a restart of
  Home Assistant in the middle of a delay (it is lost: prefer a `timer`
  helper for anything longer than a few minutes).
- **Nothing dangerous unattended**: heating appliances, locks, garage doors,
  alarms — say the risk, and add the condition that someone is home, or a
  confirmation by notification, unless the user says otherwise.

## Changing or removing one

Read it, save its configuration in
`home/<service-id>/automations/<id>-<date>.json`, then `POST` the new whole
configuration to the same path, or `DELETE` it. To switch one off without
deleting it: the services `automation.turn_off` / `automation.turn_on`.

Only the automations Home Assistant manages itself (`automations.yaml`) can
be written this way. One defined in another YAML file answers that it is not
editable: tell the user where it lives.

## Scripts

A script is a named sequence the user or an automation runs.
`POST /api/config/script/config/<object_id>` — `<object_id>` is what follows
`script.` in its id, chosen with the naming scheme — with
`{ "alias": …, "description": …, "mode": …, "sequence": [ …actions… ], "fields": { … } }`.
Run it with the service `script.<object_id>` or `script.turn_on`. Prefer a
script when two automations would repeat the same actions.

## Scenes

A scene is a set of states to restore.
`POST /api/config/scene/config/<id>` with
`{ "id": "<id>", "name": …, "entities": { "light.lustre_salon": { "state": "on", "brightness": 120 }, "cover.volet_salon": "closed" } }`.
Read the current states first when the user says "like it is now".
Activate with `scene.turn_on`.

## Helpers

A switch the user flips ("holiday mode"), a threshold they tune, a countdown:
create a helper (`references/commands.md`, "Helpers") instead of writing the
value into the automation. Name it by the scheme, and say where it shows.
