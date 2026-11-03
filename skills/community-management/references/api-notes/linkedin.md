# LinkedIn (service `linkedin`)

Base `https://api.linkedin.com`, header `LinkedIn-Version: 2024xx` and
`X-Restli-Protocol-Version: 2.0.0` (the service sets them). Tokens live 60 days: a 401 means the
user has to reconnect the service. A **personal profile** publishes with `w_member_social`; a
**company page** needs `w_organization_social` and the Community Management API (partner
programme) — a 403 on an organisation URN means the access is missing.

- **Who am I**: `GET /v2/userinfo` → `sub` (the person id) → author `urn:li:person:<sub>`. An organisation: `urn:li:organization:<id>`.
- **Publish text**: `POST /rest/posts` `{"author": "urn:li:person:<sub>", "commentary": "…", "visibility": "PUBLIC", "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []}, "lifecycleState": "PUBLISHED", "isReshareDisabledByAuthor": false}`. The post URN comes back in the `x-restli-id` header (Allkin returns the headers it gets); url `https://www.linkedin.com/feed/update/<urn>`.
- **Link in the first comment** (what `adapt_post` prepares): `POST /rest/socialActions/<post urn>/comments` `{"actor": "urn:li:person:<sub>", "message": {"text": "…"}}`.
- **Comments of a post**: `GET /rest/socialActions/<post urn>/comments` → `elements[]` with `actor`, `message.text`, `created.time` (ms), `id`. **Reply**: same POST with `"parentComment": "<comment urn>"`. **Delete**: `DELETE /rest/socialActions/<post urn>/comments/<id>?actor=<urn>`.
- **Metrics (organisation only)**: `GET /rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:<id>` → `elements[].totalShareStatistics` (impressionCount, likeCount, commentCount, shareCount, clickCount, engagement); followers `GET /rest/networkSizes/urn:li:organization:<id>?edgeType=CompanyFollowedByMember` → `firstDegreeSize`. A personal profile has no metrics API: say so.
