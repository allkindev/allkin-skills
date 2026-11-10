# Commands

Field names are those of recent Home Assistant versions (2024 and later). A
command refused with `invalid_format` tells you which field it did not
expect: read the message, do not guess.

## Shape of a call

`ha_command` takes a list; each command is its `type` and its fields at the
same level, never an `id`:

```json
{ "service_id": "home", "explanation": "…",
  "commands": [ { "type": "config/area_registry/list" } ] }
```

## Reading the installation (no card)

| Command | Gives |
|---|---|
| `get_config` | version, location name, time zone, units, `components` |
| `get_states` | every entity with state and attributes — large: `extract` or `save_as` |
| `get_services` | every service by domain, with its fields |
| `config_entries/get` | integrations: `entry_id`, `domain`, `title`, `state` |
| `config/entity_registry/list` | entities: `entity_id`, `unique_id`, `platform`, `device_id`, `area_id`, `name`, `original_name`, `disabled_by`, `hidden_by`, `labels` |
| `config/entity_registry/get` `{entity_id}` | one entity, with `device_class`, `original_device_class`, `capabilities` |
| `config/device_registry/list` | devices: `id`, `name`, `name_by_user`, `manufacturer`, `model`, `area_id`, `via_device_id`, `config_entries`, `identifiers` |
| `config/area_registry/list` | areas: `area_id`, `name`, `floor_id`, `labels`, `aliases` |
| `config/floor_registry/list` | floors: `floor_id`, `name`, `level` |
| `config/label_registry/list` | labels: `label_id`, `name`, `color` |
| `search/related` `{item_type, item_id}` | what uses an item: `automation`, `script`, `scene`, `group`, `device`, `area`… (`item_type`: `entity`, `device`, `area`, `automation`…) |
| `repairs/list_issues` | what Home Assistant itself reports as wrong |
| `system_log/list` | recent errors and warnings |

Useful extracts on the entity registry: `[platform=zha]`, `[area_id=kitchen]`,
`[device_id=<id>]`, `[].entity_id`.

A template answers many questions in one call (REST, no card):
`POST /api/template` with `{"template": "{{ area_entities('kitchen') }}"}`.
Others: `{{ device_entities('<device id>') }}`,
`{{ states | selectattr('state','eq','unavailable') | map(attribute='entity_id') | list }}`,
`{{ states.sensor | selectattr('attributes.device_class','eq','battery') | map(attribute='entity_id') | list }}`.

## Changing the registries (a card)

| Command | Fields |
|---|---|
| `config/entity_registry/update` | `entity_id`, then any of `new_entity_id`, `name` (null = back to the default), `area_id`, `icon`, `labels`, `disabled_by` (`"user"` or null), `hidden_by` (`"user"` or null), `device_class` |
| `config/entity_registry/remove` | `entity_id` — only an entity its integration no longer provides |
| `config/device_registry/update` | `device_id`, then any of `name_by_user`, `area_id`, `labels`, `disabled_by` |
| `config/device_registry/remove_config_entry` | `device_id`, `config_entry_id` — removes a device its integration lets go |
| `config/area_registry/create` | `name`, optional `floor_id`, `icon`, `labels`, `aliases` |
| `config/area_registry/update` | `area_id`, then the same fields |
| `config/area_registry/delete` | `area_id` |
| `config/floor_registry/create` / `update` / `delete` | `name`, `level`, `icon` / `floor_id` |
| `config/label_registry/create` / `update` / `delete` | `name`, `color`, `icon`, `description` / `label_id` |

`new_entity_id` keeps the domain: `light.x` stays a `light.…`. An entity
without a `unique_id` is not in the registry and cannot be renamed there (it
is defined in YAML).

A device's area is inherited by its entities unless an entity has its own.
Set the device's; set an entity's only for the exception.

## Acting on devices

REST, no card: `POST /api/services/<domain>/<service>` with a JSON body
(`{"entity_id": "light.lustre_salon", "brightness_pct": 60}`).

Through the WebSocket (a card), when it belongs to a batch:

```json
{ "type": "call_service", "domain": "light", "service": "turn_on",
  "service_data": { "brightness_pct": 60 },
  "target": { "entity_id": "light.lustre_salon" } }
```

Add `"return_response": true` for a service that answers data.

## Helpers (a card)

`input_boolean`, `input_number`, `input_select`, `input_text`,
`input_datetime`, `input_button`, `counter`, `timer`, `schedule`:

- `<domain>/list`
- `<domain>/create` — `name`, `icon`, then the domain's own (`min`, `max`,
  `step`, `mode`, `unit_of_measurement` for a number; `options` for a select;
  `duration` for a timer; `has_date`, `has_time` for a datetime)
- `<domain>/update` — `<domain>_id`, then the fields
- `<domain>/delete` — `<domain>_id`

## Backup

Which one exists depends on the installation: read `get_services` first.

- `backup.create_automatic` (recent versions, uses the backup settings the
  user made) — or `backup.create`;
- `hassio.backup_full` on an installation with the Supervisor.

Called with `call_service`. It takes minutes: say so, do not wait on it in a
loop; `backup/info` (read) lists the backups and says whether one is running.

## Health

- `repairs/list_issues`, `system_log/list`
- integrations whose `state` is not `loaded` in `config_entries/get`
- entities `unavailable` or `unknown` (template above)
- batteries under 20 % (template above, then the states)
- `zha/devices` — `available`, `lqi`, `last_seen` of each Zigbee device
- `zwave_js/network_status` `{entry_id}` — controller and nodes, `status` of each
- `update.*` entities in state `on`: updates waiting
