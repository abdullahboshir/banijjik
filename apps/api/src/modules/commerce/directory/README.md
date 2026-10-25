# commerce/directory

OPTIONAL module: customer-submitted **listings** (biodata, tutor profile, room, …) with
template custom fields, per-field visibility tiers, staff moderation and public search.
`GEO_BD` values are checked against the Bangladesh BBS registry (`@banijjik/contracts/directory`).

## Surface

- Storefront (`/api/v1/storefront/orgs/{organizationId}`): my listing CRUD/submit, public
  search and detail, photo upload (`LISTING_PHOTO`), reports, listing blocks.
- Tenant (`/orgs/{organizationId}/directory/…`): config, review queue, all listings, detail,
  approve/reject/hide/unhide (ADR-129), report queue and resolve (ADR-134).

## Trust and safety (ADR-134)

Reports name a template `reportReasons` key on an APPROVED listing; one OPEN per reporter per
listing, capped per business day. The queue groups OPEN reports by listing, oldest first.
`LISTING_HIDDEN` also needs `directory.listing.hide`, `ACCOUNT_BLOCKED` also
`contact.customerAccount.block`, through `moderationAccess`. No owner-facing body or event
carries the reporter or note. `directory.hideOnAccountBlocked` hides a blocked account's
listing as the system actor; unblock does not unhide. Detail is rate limited per IP and account.

**Privacy.** Every response goes through `projectListingFields` / `projectListingPhotos` (ADR-127).
**Blocks and erasure (M.7).** `ListingBlock` hides a listing from one customer's search; erasure and export use `directory-erasure-participants.ts`.
**Review SMS (M.8b).** `directory.notifyReviewResult` sends one SMS per approved/rejected listing through the contact module's `CustomerSmsNotifier`; the `CustomerSmsSent` record stops a retry from sending twice.

## Settings

- `directory.oneListingPerAccount` (default true); `directory.reviewEdits` (default true): an edit of an APPROVED listing returns it to SUBMITTED
- `directory.photoPolicy`: `NONE` | `BLURRED_PUBLIC` | `UNLOCKED_ONLY`; `directory.notifyReviewBySms` (default true): one SMS per review result
