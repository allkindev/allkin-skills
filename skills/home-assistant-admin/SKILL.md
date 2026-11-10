---
name: home-assistant-admin
description: Use when the user asks to add, pair, rename, tidy, automate or display anything in Home Assistant — "listen for new Zigbee / Z-Wave / RFXCOM devices", "rename my entities properly", "put this in the kitchen", "create an automation / a script / a scene", "make me a dashboard", "what is wrong with my installation". The method and the exact commands to administer a Home Assistant installation through Allkin's Home Assistant service, without breaking what already runs.
---

# Home Assistant administration

You administer a house people live in. A light that no longer answers its
switch because you renamed it is a failure, whatever else went well. So every
job here has the same shape: **read, propose, get the go-ahead, save the way
back, change, verify, report**.

## Your two ways in

Both use the same `service_id`, the Home Assistant service the user granted
you (listed under External services). You never see its token.

- **`call_external_service`** — the REST API. Read a state, switch a device,
  render a template, and create or replace an automation, a script or a scene.
- **`ha_command`** and **`ha_listen`** — the WebSocket API, the one Home
  Assistant's own interface uses. Registries (entities, devices, areas,
  floors, labels), dashboards, helpers, the Zigbee and Z-Wave networks, and
  events as they happen.

A read runs at once. A change shows the user **one approval card per call**:
put what belongs together in one `ha_command` (up to 50 commands), and write
an explanation a person can judge — "Rename the 14 entities of the living
room as agreed", not "update registry". Never ask in prose for what the card
asks.

`references/commands.md` lists the commands you will need, with their fields.
Read it before your first job on an installation. Home Assistant changes with
its versions: when a command is refused (`unknown_command`, `invalid_format`),
do not insist and do not guess variants — read what this installation offers
(`get_config` for its version, a `…/list` beside the command), then adapt.

Large answers (`get_states`, the entity registry) are thousands of lines: use
`extract` to keep what you need, or `save_as` and search the file.

## First contact: the survey

Before the first change on an installation, and again when your sheet is more
than a month old, read it (all reads, no card):

1. `get_config` — version, time zone, units, the components loaded.
2. `config_entries/get` — the integrations and their state; note the radios:
   `zha`, `zwave_js`, `rfxtrx`, and `mqtt` (Zigbee2MQTT lives behind it).
3. `config/floor_registry/list`, `config/area_registry/list`,
   `config/label_registry/list`.
4. `config/device_registry/list` and `config/entity_registry/list`, saved to
   files; count by integration, by area, and those with no area.
5. `repairs/list_issues`, and the entities whose state is `unavailable`.

Write what you found in `home/<service-id>/installation.md` in your folder:
version, radios, floors and areas with their ids, the naming scheme in use
(or "none"), what looks wrong, the date. That sheet is your memory of the
house; your memory tool keeps only two or three lasting preferences of the
user.

## Never

- Never invent an entity id, a device id, an area id or a service name. Read it.
- Never rename, delete or overwrite without the list shown to the user first
  and its copy saved in your folder.
- Never save the **default dashboard** unless the user asked for exactly
  that: saving it stops Home Assistant from generating it. Create a new one.
- Never put a password, a token or a key in a file, a message or an
  automation. An integration that asks for an account is added by the user,
  in Home Assistant's interface.
- Never restart Home Assistant for convenience. When a restart is needed,
  check the configuration first (`POST /api/config/core/check_config`), say
  that the house's automations stop for a minute, and let the card decide.
  Stopping Home Assistant or shutting its machine down is refused to every
  agent: do not look for another way.
- Never leave a network open for pairing, nor RFXCOM's automatic add on,
  when you are done.

## The jobs

Each has its file; read it before doing the job, not from memory.

| Job | File |
|---|---|
| Hear and take in new Zigbee, Z-Wave or RFXCOM devices | `references/pairing.md` |
| Name entities by a scheme, rename in bulk, areas and labels | `references/naming.md` |
| Automations, scripts, scenes, helpers | `references/automations.md` |
| Dashboards | `references/dashboards.md` |

What follows is the part common to all of them.

### Asking the user

Use `ask_form` for choices: a room among the areas that exist (plus "create
a new room"), a name with your proposal already filled in, a scheme among
three shown with real examples from their own house. One form for several
devices rather than one per device. Free questions go in prose.

### The way back

Before a call that renames, deletes or overwrites, write in your folder what
would be needed to undo it:

- a rename: `home/<service-id>/renames/<date>-<subject>.json`, the list of
  `{ "old": …, "new": … }`;
- a dashboard: `home/<service-id>/dashboards/<url_path>-<date>.json`, its
  configuration as it was;
- an automation, a script or a scene you replace: its configuration as it
  was, in `home/<service-id>/automations/`.

Before a job that touches more than about twenty things, propose a backup of
Home Assistant first (`references/commands.md`, "Backup").

### Verifying

A command that answered `success` proves the registry took it, not that the
house works. After a change, read back what you changed, then look for what
it may have broken: `search/related` on a renamed entity, `repairs/list_issues`,
the entities that became `unavailable`, the trace of an automation you
triggered. Say what you could not check — a dashboard's look, a physical
device's reaction.

### What the API does not reach

YAML files (`configuration.yaml`, packages, dashboards in YAML mode,
automations written outside `automations.yaml`), HACS, and anything that
needs a browser sign-in. When the job needs one of them, say exactly what
the user has to change and where, and carry on with the rest.

## The report

End every job with a short report in the user's language:

- **Done** — what changed, in their words (names, rooms), with counts.
- **Check** — what they should try themselves (a switch, a dashboard).
- **Not done** — what you left and why, what needs them.
- **Way back** — the file that undoes it, when there is one.
