# commerce/directory

OPTIONAL module: customer-submitted **listings** (biodata, tutor profile, room, …) with
template custom fields, per-field visibility tiers, staff moderation and public search.

## Surface

- Storefront (`/api/v1/storefront/orgs/{organizationId}`): my listing CRUD/submit, public
  search and detail, listing photo upload (`LISTING_PHOTO`).
- Tenant (`/orgs/{organizationId}/directory/…`): review queue, approve/reject/hide/unhide.

## Privacy

Every response goes through `projectListingFields` / `projectListingPhotos` (ADR-127). Controllers
never filter fields themselves. Until M.4, `UNLOCKED` fields are never sent to customers.

## Settings

- `directory.oneListingPerAccount` (default true)
- `directory.reviewEdits` (default true): an edit of an APPROVED listing returns it to SUBMITTED
- `directory.photoPolicy`: `NONE` | `BLURRED_PUBLIC` | `UNLOCKED_ONLY`

## Geography

`GEO_BD` custom-field values are checked against the Bangladesh BBS administrative registry in
`@banijjik/contracts/directory` (8 divisions, 64 districts, upazilas).
