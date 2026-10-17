# core/settings: the settings engine

Resolves a declared setting in ADR-016 order: location row, organization row, a valid industry
template default, then the system default. Later modules only add `settings` entries on their
manifest. This module does not know those keys.

- **Collection:** `setting_values` in the tenant database, tenancy `ORGANIZATION`. `locationId`
  null is the organization-level row. The location plugin is not used, because that plugin
  requires a location on every row (ADR-103).
- **Endpoints:** `GET` and `PATCH /api/v1/orgs/{organizationId}/settings`. Read permission
  `settings.setting.read`, write permission `settings.setting.update`. An organization-level
  write needs the permission at every location; a location write needs it at that location.
- **Location:** an ACTIVE location of this organization, asked through organization's
  `buildLocationLookup`. An archived location, or another organization's, is 404.
- **Batch:** at most 50 items, all or nothing. `value: null` deletes the stored row. A batch
  that changes something writes one audit entry, one `settings.setting.changed` event and one
  `configVersion` bump. A delete of a missing row, or a value equal to the stored one, is left
  out. A batch that changes nothing writes none of those.
- **Terms:** `term_overrides` in the tenant database. Allowed keys come from the template.
  `GET` and `PATCH /terms`. A batch that changes something writes one audit entry, one
  `settings.term.changed` event and one `configVersion` bump (ADR-104).
- **Module switches:** `GET /modules` and `POST /modules/{moduleKey}/disable|enable`. The write is
  a `TENANT_DISABLE` override through `platform/entitlement`. One audit entry, one
  `settings.module.toggled` event and one `configVersion` bump.
- **Resolver:** `buildResolvedTermTexts` and `buildClientSettingsSource` are the ports the
  resolver calls with the effective module set. They do not read `OrgConfigReader`.
- **Menu and screens (card 2.7b, ADR-108):** the manifest declares the menu entries `settings.general`, `settings.terms` and `settings.modules` (group `settings`, orders 50 to 70, permission `settings.setting.read`); the admin app draws the screens. `GET` and `PATCH /settings` also return `definitions` (value spec and `allowsLocationOverride` per returned key) so a client draws inputs from the registry.
- **Not here:** Unregistered template setting keys are
  ignored until their module declares them.
