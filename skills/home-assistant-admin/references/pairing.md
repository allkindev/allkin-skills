# Hearing and taking in new devices

The user says "listen for new devices", "I am adding a sensor", "pair this".
A session has five steps. Do them in order; do not open a network before you
are listening.

## 1. Know the radios

From your sheet, or `config_entries/get`: which of `zha`, `mqtt`
(Zigbee2MQTT), `zwave_js`, `rfxtrx` exist, with their `entry_id`. If the user
did not say which technology, ask — or open the ones that fit the device they
describe. Do not open every network "to be sure".

## 2. Start listening

One watch, kept open, before anything is opened:

```json
{ "service_id": "home", "wait_seconds": 0, "keep_seconds": 300,
  "explanation": "Hear the devices that join",
  "subscribe": [
    { "type": "subscribe_events", "event_type": "device_registry_updated" },
    { "type": "subscribe_events", "event_type": "entity_registry_updated" } ] }
```

Keep its `watch_id`. Each later `ha_listen` with that id and a new
`keep_seconds` keeps it alive; it ends by itself otherwise.

## 3. Open the network

**Zigbee with ZHA** — the service `zha.permit`, 120 seconds (254 at most):

```json
{ "type": "call_service", "domain": "zha", "service": "permit",
  "service_data": { "duration": 120 } }
```

**Zigbee with Zigbee2MQTT** — if the entity
`switch.zigbee2mqtt_bridge_permit_join` exists, turn it on. Otherwise publish
on the bridge (the base topic is `zigbee2mqtt` unless the user changed it):

```json
{ "type": "call_service", "domain": "mqtt", "service": "publish",
  "service_data": { "topic": "zigbee2mqtt/bridge/request/permit_join",
                    "payload": "{\"time\": 120}" } }
```

To follow the join itself, add to your watch a subscription
`{ "type": "mqtt/subscribe", "topic": "zigbee2mqtt/bridge/event" }` (events
`device_joined`, `device_interview`).

**Z-Wave JS** — the inclusion is itself a subscription: it goes through
`ha_listen`, on a watch of its own, kept open so that you can answer it.

```json
{ "service_id": "home", "wait_seconds": 60, "until_events": 1,
  "keep_seconds": 300, "explanation": "Include a Z-Wave device",
  "subscribe": [ { "type": "zwave_js/add_node", "entry_id": "<zwave_js entry id>" } ] }
```

Read the `event` field of what comes back. Typically: `inclusion started`,
then `node added` / `device registered`, then `interview completed` or
`interview failed`, and `inclusion stopped`. Two events wait for an answer,
sent with `ha_command` while the watch stays open:

- `grant security classes` (its `requested_grant` lists them) → answer
  `{ "type": "zwave_js/grant_security_classes", "entry_id": "…",
  "security_classes": [the classes requested], "client_side_auth": false }`;
- `validate dsk and enter pin` → ask the user, with a form, the five digits
  printed on the device or its box, then
  `{ "type": "zwave_js/validate_dsk_and_enter_pin", "entry_id": "…", "pin": "12345" }`.

Then listen again with the same `watch_id`. To give up:
`{ "type": "zwave_js/stop_inclusion", "entry_id": "…" }`. Removing a device
from the network is the mirror: `zwave_js/remove_node`, `zwave_js/stop_exclusion`.

**RFXCOM (rfxtrx)** — there is no pairing: the receiver hears whatever
transmits, and creates a device only while the integration's option
"automatic add" is on. Turn it on through the options flow of the entry
(REST, on a card):

1. `POST /api/config/config_entries/options/flow` with `{"handler": "<rfxtrx entry id>"}`
   — the answer is a form: its `flow_id`, its `step_id`, and `data_schema`,
   the fields it expects.
2. `POST /api/config/config_entries/options/flow/<flow_id>` with those
   fields, `automatic_add` set to `true`, the others as the form gave them.
   Fill what the schema asks, not what you remember.

Tell the user what this means: **every** 433 MHz device in range that
transmits is added, the neighbours' included. Keep the session short, and
turn `automatic_add` off the same way at the end.

## 4. Have the device join, and hear it

Tell the user the network is open and for how long, and what to do — the
pairing gesture of their device (usually: hold its button until a light
blinks; for RFXCOM: make it transmit — press the remote, open the door).

Then listen: `ha_listen` with the `watch_id`, `wait_seconds` 60 to 120,
`until_events` 1, `keep_seconds` 300. A device arrives as a burst — one
`device_registry_updated` with `"action": "create"` and its `device_id`, then
an `entity_registry_updated` per entity. Nothing after the wait: say so, ask
whether they tried, and listen again or stop. Several devices: one at a
time, it keeps them apart.

## 5. Close, then take the devices in

Close first, whatever happened: ZHA `zha.permit` with `duration` 0;
Zigbee2MQTT the switch off or `{"time": 0}`; Z-Wave `stop_inclusion` if it
did not stop; RFXCOM `automatic_add` false. Then close the watch
(`watch_id` with `close: true`).

For each new device, read (no card):

- its device: `config/device_registry/list` with `extract` `[id=<device_id>]`
  — manufacturer, model, name;
- its entities: `config/entity_registry/list` with `extract`
  `[device_id=<device_id>]`, and for each `config/entity_registry/get` when
  you need its device class.

Tell the user what joined, in their words: "an Aqara door sensor: an
opening contact, a battery level, a temperature". Then ask, in **one form**
for the device (or one for all of them when there are several):

- what it is and where: its room, among the areas that exist, or a new one;
- its name — your proposal filled in, built with the scheme of the house
  (`references/naming.md`);
- what to do with the secondary entities (signal quality, identify button,
  firmware): keep, hide or disable — propose to hide diagnostics.

Apply everything in **one** `ha_command`: the device first
(`config/device_registry/update` with `name_by_user`, `area_id`), then each
entity (`config/entity_registry/update` with `new_entity_id`, and `name` only
when the device's name does not already give a good one). Read back, and
offer what comes next: an automation, a place on a dashboard.

A device that joined by mistake (a neighbour's, with RFXCOM): propose to
remove it — `config/device_registry/remove_config_entry` — rather than leave it.
