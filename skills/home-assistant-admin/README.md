# Home Assistant administration

For any agent that looks after a Home Assistant installation, reached through
Allkin's **Home Assistant** service. It gives the agent a method and the
exact commands for four jobs:

- **New devices** — it listens to the Zigbee (ZHA or Zigbee2MQTT), Z-Wave and
  RFXCOM networks on request, sees what joins, tells you what each device is,
  and asks you what to do with it: its name, its room, what to hide.
- **Names and rooms** — it proposes a naming scheme with examples from your
  own house (`light.lustre_salon`, `binary_sensor.do_entree`…), renames in
  bulk, and repairs the automations and dashboards that named the old ids.
- **Automations, scripts, scenes** — it restates your wish as "when, only if,
  then", checks that every entity exists, validates, creates, and tests with
  your agreement.
- **Dashboards** — it asks who looks at it and on what, builds views by use,
  and never overwrites a dashboard without keeping its previous version.

Each job follows the same order: read, propose, get your go-ahead, save the
way back, change, verify, report. What the agent could not check — how a
dashboard looks, how a physical device reacts — it says.

## What it needs

- The **Home Assistant** service, with a long-lived access token of an
  administrator, granted to the agent — with writing, or the agent can only
  read and listen.
- Nothing else: it grants nothing. The agent keeps exactly the rights it has.

## What you will see

Reading the installation asks you nothing. Every change — a rename, a room, a
dashboard saved, a network opened for pairing — shows an approval card in the
conversation, once for the whole batch, which you may approve for the session.

## Limits

- Files written by hand in YAML (`configuration.yaml`, packages, dashboards
  in YAML mode) are out of reach: the agent says what to change there.
- An integration that asks for an account or a password is added by you, in
  Home Assistant.
- Stopping Home Assistant or shutting its machine down is refused to every
  agent. A restart is possible, on its card.
