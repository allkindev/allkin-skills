# Allkin service standard

A **service** teaches Allkin how to reach one external API: where it is, how
the secret travels, how to prove the connection works, and what an agent needs
to know to call it. A service is **data, never code**: Allkin's core performs
every call, the definition only declares.

Once a service exists, the user connects it from the Services page (their key
stays in Allkin, encrypted), grants it to agents, and those agents call the API
through the single tool `call_external_service` — the secret is added by
Allkin, the agent never sees it.

"Must" is checked (an **error**); "should" is asked by the standard (a **warning**).

## 1. What a service is

One folder, named by the service's **identifier** (lowercase letters, digits,
hyphens; never renamed; must not be the identifier of a service shipped with
Allkin):

```
services/<id>/
├── service.json       must   the definition
├── README.md          must   the help, in English
├── README-FR.md       should the help, in French
├── README-ES.md       should the help, in Spanish
├── README-DE.md       should the help, in German
├── validation.json    should { "status": "pending" }
└── *.png, *.jpg…      optional images used by the README files
```

## 2. The definition: `service.json`

Plain JSON. Unknown fields are dropped; a field of the wrong type refuses the
whole definition. Texts are written in English.

### Identity — must

| Field | Value |
|-------|-------|
| `label` | the product's name, as its brand writes it |
| `authType` | `api_key`, `basic`, `session`, `oauth2`, `none` (§3) |
| `category` | `ai`, `dev`, `cloud`, `office`, `messaging`, `media`, `home`, `data`, `finance`, `marketing`, `generic` |

### Address — one of the three is a must

| Field | Use |
|-------|-----|
| `apiBaseUrl` | root of the API (`https://api.example.com/v1`), for a hosted service |
| `needsBaseUrl: true` | self-hosted: the form asks the user for the address |
| `baseUrlTemplate` | the address varies by one identifier: `{ "template": "https://{value}.example.com/api", "label": "Account", "note", "placeholder", "pattern" }` (with `needsBaseUrl: true`) |
| `extraHosts` | other hosts the API answers with links to. No secret is ever sent there |

### Presentation — should

| Field | Use |
|-------|-----|
| `description` | one line under the name; translated in `locales` (§5) |
| `logo` | the brand's mark: the `d` attribute alone of a **filled** path on a 24×24 grid (Simple Icons format) |
| `glyph` | for what has no brand: the `d` attribute of a **stroked** path, same grid |
| `icon` | an emoji, last resort |
| `color` / `colorDark` | the brand's colour; `colorDark` only when it dies on a dark ground |

### Requests

| Field | Default | Use |
|-------|---------|-----|
| `bodyFormat` | `json` | `form` for APIs that only read url-encoded bodies. The agent still writes JSON; Allkin converts |
| `responseFormat` | `json` | `xml`: the response is converted to an object before the agent reads it |
| `pathStyle` | `path` | `query`: the base URL is the endpoint, only the parameters vary |
| `extraHeaders` | — | constant headers the API demands (`Accept`, an API version) |
| `csrf` | — | `{ "header", "path", "status" }`: an anti-forgery token the API hands out itself and wants back on every call |

### Check — should

| Field | Use |
|-------|-----|
| `testPath` | a harmless request proving the connection works (`/user`, `/me`). `""` means the base URL itself |
| `testQuery` | its query parameters |
| `testMethod` / `testBody` | `POST` and a JSON body, for APIs that only answer to POST |
| `testExpect` | a fragment the answer must contain — a 200 proves nothing when a wrong address lands on a web page |
| `liveTest` | `{ "path", "method", "params", "label" }`: a test with a visible effect, for a sending service |

### Safeguards

| Field | Use |
|-------|-----|
| `sensitivePaths` | calls the agent never makes alone: `[{ "method": "DELETE", "path": "/servers/*", "action": "confirm", "label": "Delete a server", "warning": "…" }]`. `action` is `confirm` (the user validates in the conversation), `deny` (never) or `allow` (an exception placed **before** a wider rule). `method` may be `*`; `path` takes `*` and `?` |
| `pinnedParam` | `{ "name", "label", "hint", "required" }`: a parameter the user sets once and Allkin imposes on every call — what turns a bot key into a channel to one destination |

Declare as `confirm` whatever costs money, deletes for good, or speaks in the
user's name. Write `label` for someone who does not know the API.

### For the agents — should

| Field | Use |
|-------|-----|
| `agentGuide` | how to use the API, injected in the prompt of the agents that have the service. A condensed note, not a documentation: the five to ten calls that cover real use, the shape of a body, the trap to avoid. When the API can describe itself, say so |
| `docUrl` | the reference documentation, for agents with web access |

## 3. Authentication

**`api_key`** — one secret, placed by `secretPlacement`:

| `secretPlacement` | Fields | Result |
|-------------------|--------|--------|
| `header` (default) | `apiKeyHeader` (default `Authorization`), `apiKeyPrefix`, `apiKeySuffix` | `Authorization: Bearer <key>` with `"apiKeyPrefix": "Bearer "` |
| `query` | `apiKeyHeader` = the parameter's name | `?apikey=<key>` |
| `path` | `apiKeyPrefix` | the key is part of the path (`/bot<key>/…`) |

**`basic`** — a login and a password sent as HTTP Basic on every call.

**`none`** — a public API, no secret at all.

**`session`** — a login and a password exchanged once for a proof replayed on
every call, declared in `sessionLogin`:

```json
"sessionLogin": { "path": "/api/v2/auth/login", "userField": "username", "passField": "password", "cookieName": "SID" }
```

- `cookieName`: the proof comes back as a cookie (a fragment of its name is enough).
- `tokenField`: it comes back in the JSON answer (a dotted path if nested) and
  is replayed as `Authorization: Bearer …`, or in `tokenHeader`.
- `bodyFormat` (`form` by default, or `json`), `bodyTemplate` (the whole body,
  with `{user}` and `{password}`, for a JSON-RPC envelope).
- `expiresField` or `ttlSeconds` (1800 by default); `failureBody` for a 200
  that means failure; `userLabel` / `passLabel` for the form.

**`oauth2`** — `tokenUrl`, plus:

- on behalf of a person (`oauthGrant` absent or `authorization_code`):
  `authorizeUrl` and `commonScopes: [{ "value", "label" }]`;
- as an application (`"oauthGrant": "client_credentials"`): no `authorizeUrl`;
  `tokenClientAuth` (`body` or `basic`), `tokenGrantType`, `oauthAccountField`
  when the token request carries a third value.

Not available to a declarative service: request signing and mail transport
(IMAP/SMTP) — those are shipped with Allkin only.

## 4. The help: `README.md`

The Help tab of the service's page. It says, with the exact names of the
screens: where to create the key (or the application) on the service's side,
which permissions or scopes to tick, what to paste where in Allkin, and what a
failed test usually means. Images sit in the same folder.

## 5. Languages

`service.json` is written in English. `locales` carries the description in the
three other languages:

```json
"locales": { "fr": { "description": "…" }, "es": { "description": "…" }, "de": { "description": "…" } }
```

`README.md` is English; `README-FR.md`, `README-ES.md`, `README-DE.md` are the
translations. `agentGuide` is written for a model, in English, once.

## 6. Validation: `validation.json`

`{ "status": "pending" }` — always, for a new service. Only the owner of Allkin
writes `validated`, after connecting it for real.

## 7. A complete example

```json
{
  "label": "Example",
  "authType": "api_key",
  "category": "dev",
  "description": "Issues and projects of Example.",
  "apiBaseUrl": "https://api.example.com/v1",
  "secretPlacement": "header",
  "apiKeyHeader": "Authorization",
  "apiKeyPrefix": "Bearer ",
  "extraHeaders": { "Accept": "application/json" },
  "testPath": "/me",
  "sensitivePaths": [
    { "method": "DELETE", "path": "/projects/*", "action": "confirm", "label": "Delete a project" }
  ],
  "agentGuide": "GET /me to check. GET /projects lists projects, GET /projects/<id>/issues?state=open their issues. Create: POST /projects/<id>/issues with {\"title\": \"…\", \"body\": \"…\"}. Pagination: ?page= and ?per_page= (100 at most).",
  "docUrl": "https://docs.example.com/api",
  "glyph": "M4 6h16M4 12h16M4 18h10",
  "color": "#2563eb",
  "locales": {
    "fr": { "description": "Tickets et projets d'Example." },
    "es": { "description": "Incidencias y proyectos de Example." },
    "de": { "description": "Tickets und Projekte von Example." }
  }
}
```

## 8. Conformance checklist

1. The folder name is a valid identifier, not one of Allkin's own services.
2. `service.json` parses, with `label`, `authType`, `category` and an address.
3. The authentication fields match `authType`.
4. `testPath` proves the key works, not only that the host answers.
5. Whatever costs, deletes or speaks for the user is in `sensitivePaths`.
6. `agentGuide` covers the real use in a few lines; `docUrl` gives the rest.
7. `description` exists in four languages; the tile has a `logo` or a `glyph`.
8. `README.md` and its three translations explain where to get the key.
9. `validation.json` says `pending`.
