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
- **Batch:** at most 50 items, all or nothing. `value: null` deletes the stored row. One audit
  entry, one `settings.setting.changed` event and one `configVersion` bump per batch.
- **Not here:** `/me/config` settings and terms (card 2.2), a settings UI (card 2.7), and a
  resolve cache. Unregistered template keys are ignored until their module declares them.
