# Plan: card M.2 · Directory API (listings, visibility tiers, moderation, filters)

Tier: **T1** (sensitive personal data; privacy is enforced only by the server) · Planned by: Opus 5.5 (Claude) · Implemented by: Cursor or a Claude Code session · Date: 2026-10-19 · Based on commit: `main aa084d2` (M.1 merged)

Track M (`docs/16-MATRIMONY-TRACK.md`, approved), second card. **Can start now**: it depends on M.1, 3.0 and the custom field engine, all merged. Read doc 16 §3.1 and §4 first. Reserved ADR number: **ADR-127**.

## Goal
The generic **directory** capability (doc 16 §3.1):
- customers submit a **listing** (a biodata, a tutor profile, a room) built from the template's fields
- staff **review** it
- once approved it is **published** and searchable with filters

Every field has a **visibility tier**, and the API never sends a field to a caller below its tier. Nothing in code knows about marriage; the matrimony words and rules are template data (card M.8).

## Inputs read
- `docs/16-MATRIMONY-TRACK.md` §2, §3.1, §3.4 (pages that will call this API), §3.5 (safety: reports come in M.7), ADR-102 (custom fields, attribute-pattern search), ADR-107 (sensitive), ADR-109 (files), ADR-113 (field properties per entity), ADR-118, ADR-119 (customer accounts, `authenticateCustomer`, storefront surface)
- Code: `commerce/contact` (customer accounts, storefront router), `core/custom-field` (effective fields, template field schema in `packages/validation/src/platform/industry-template-schemas.ts`), `core/file` (purposes, public and private serving), `kernel/sequence`, `routes/storefront.ts`, `platform/industry` (template schema and additive rule)

## Decisions
**Module** (`commerce/directory`, OPTIONAL, new `MODULE_KEY.DIRECTORY` in contracts, `tenantCanDisable: false`). No template turns it on yet except a test fixture; M.8 adds the matrimony templates.

1. **Template field properties for entity `listing`** (extending the template field schema; additive):
   - `listingTier`: `PUBLIC | MEMBERS | UNLOCKED | PRIVATE`, default `PUBLIC`
   - `isFilterable`: boolean; allowed for SELECT, MULTI_SELECT, NUMBER, DATE and the new geography type
   - `sectionKey`: groups fields into the multi-step form (sections are listed in the template with labels)
   - `minAgeYears`: on a DATE field, the age the date must give at submission
   - `mustDifferFromAccountPhone`: on a PHONE field
   - Template-level `directory` block: `sections[{ sectionKey, label }]`, `consents[{ consentKey, text: { bn, en } }]`, `rejectionReasons[{ reasonKey, label, isFinal }]`, `listingNumberPrefix`
   - Organization definitions (2.3) may add listing fields with the same properties.

2. **Geography field type `GEO_BD`** (new custom field type): the value `{ divisionKey, districtKey, upazilaKey? }` is checked against a **Bangladesh geography registry** (contracts data file: 8 divisions, 64 districts, upazilas with bn and en names).
   - Source the list from the official Bangladesh Bureau of Statistics administrative list, and note the source and date in the file header.
   - A filter on a GEO_BD field matches division, district or upazila.
   - Other countries' geography is later; the type name carries the country.

3. **Listing** (organization scope, versioned), fields as doc 16 §3.1:
   - `listingNumber` from sequence `LISTING`, shown as `<prefix>-<n>`
   - `ownerCustomerAccountId` (one non-archived listing per account, setting `directory.oneListingPerAccount` default true)
   - `status`, `customFields`, `customFieldSearch` (filterable fields only)
   - `photoFileIds` (new file purpose `LISTING_PHOTO`, PRIVATE)
   - `consentsAccepted[{ consentKey, textVersionHash, acceptedAt }]`
   - `submittedAt`, `reviewedAt`, `reviewedByUserId`, `rejection { reasonKeys[], note }`, `publishedAt`, audit fields

4. **Statuses** (doc 16 §3.1): `DRAFT → SUBMITTED → APPROVED | REJECTED`; `APPROVED → HIDDEN → APPROVED` (staff); an edit of an APPROVED listing goes back to SUBMITTED when `directory.reviewEdits` (default true) is on, staying hidden from search until approved; any → ARCHIVED (deleted by the owner: personal data cleared as in 3.1a anonymize, the number kept). A REJECTED listing can be fixed and resubmitted unless a reason is final.

**Customer API** (storefront surface `/api/v1/storefront/orgs/{organizationId}`, `authenticateCustomer` from M.1)

5. Endpoints:

   | Endpoint | Notes |
   |---|---|
   | `GET /my/listing` | own listing with all tiers (owner sees everything) |
   | `PUT /my/listing` | create or replace the DRAFT/REJECTED/APPROVED data; validated with the custom field builder for audience `STOREFRONT` and mode by section (partial saves allowed while DRAFT) |
   | `POST /my/listing/submit` | `{ consents[] }`: all required fields present, all consents accepted, `minAgeYears` met, guardian phone ≠ the account phone |
   | `DELETE /my/listing` | archive and clear |
   | `POST /my/listing/photos` | via 3.0 upload, purpose `LISTING_PHOTO`; obeys `directory.photoPolicy`: `NONE` refuses |

**Public search** (same surface, no sign-in for PUBLIC tier)

6. Search and read:
   - `GET /listings?filters…&page&limit` (≤ 50 per page): APPROVED listings only.
     - Filters: only template filterable fields, with ranges for NUMBER and DATE (age range from date of birth), MULTI_SELECT any-of, GEO_BD prefix. Plus `listingNumber` exact.
     - Results carry PUBLIC fields, and MEMBERS fields when signed in.
     - Sorted by `publishedAt` desc.
     - Backed by the attribute-pattern index; one indexed branch per filter combined with `$and`; measure with an explain test.
   - `GET /listings/{listingNumber}`: the same tier rule. UNLOCKED fields appear only for accounts that unlocked the listing (unlocks come in M.4; until then UNLOCKED is never sent to customers). PRIVATE is never sent to customers.
   - Rate limit per IP and per account (scraping).
   - Photos follow the policy: `BLURRED_PUBLIC` serves a server-made blurred variant publicly and the clear image only with UNLOCKED; `UNLOCKED_ONLY` serves none publicly.

**Staff API** (tenant pipeline, permissions `directory.listing.{read,review,hide}`)

7. Endpoints:
   - `GET /directory/queue?status=SUBMITTED&page&limit` (oldest first)
   - `GET /directory/listings/{listingId}`: every tier, with the review checklist from the template
   - `POST …/approve`
   - `POST …/reject { reasonKeys, note }`
   - `POST …/hide`, `…/unhide`

   Each transition is audited (personal values masked as in 3.1a) and emits an event with `orderingKey: listing:<listingId>`; approve and reject emit the notification events M.8 sends as SMS. Grants: OWNER, MANAGER all; STAFF read and review; VIEWER read.

8. **Privacy rules enforced in one place:** a `projectListing(listing, viewer)` function decides the fields per viewer (`PUBLIC`, `MEMBER`, `UNLOCKED_MEMBER`, `OWNER`, `STAFF`). Every endpoint uses it, and tests cover each viewer against each tier. Search indexes never contain UNLOCKED or PRIVATE values (a filterable field must be PUBLIC or MEMBERS; the template schema refuses otherwise).

9. **Records:**
   - ADR-127 ("Accepted (proposed)"): template field properties, GEO_BD and its source, listing statuses, the projection function, filter rules, photo policies
   - `09` (Listing), `12` (template listing fields), `14` rows, the module README, STATUS row M.2

## Files
| Path | Change |
|---|---|
| `packages/contracts` (`MODULE_KEY.DIRECTORY`; `@banijjik/contracts/directory` subpath with exports, lint exception and new-module alias; tiers, statuses, geography registry data and types, file purpose `LISTING_PHOTO`, permission keys, events, sequence key, message keys) | add-only |
| `packages/validation` (template field properties and the `directory` block, GEO_BD value, listing requests, filters) | change, create |
| `apps/api/src/modules/commerce/directory/**` | create |
| `apps/api/src/modules/core/custom-field/**` (new properties pass through `EffectiveCustomField`; GEO_BD type), `core/file/**` (purpose, blurred variant), `platform/industry/**` (additive rule for the new properties) | change |
| `apps/api/src/routes/{storefront.ts, v1.ts or core routers, module-registry.ts}`, `system-role-grants.ts` | add-only |
| `packages/i18n` | add-only |
| `docs/04-DECISIONS.md` (ADR-127), `docs/09`, `docs/12`, `docs/14`, `docs/handoffs/M.2.md`, `docs/STATUS.md` | |

## Tests (must exist and pass)
- [ ] **Projection matrix:** each viewer × each tier (PRIVATE never to customers, UNLOCKED never before M.4, MEMBERS only when signed in, owner and staff see all), on the list and on the detail.
- [ ] **Submission rules:** missing required field, missing consent, under the minimum age (today's date edge), guardian phone = account phone, one listing per account.
- [ ] **Statuses:** every transition and refusal; edit after approval returns to SUBMITTED and leaves search; final rejection cannot be resubmitted; archive clears personal data.
- [ ] **Filters:** age range from date of birth; GEO_BD division, district and upazila; MULTI_SELECT any-of; an unknown or non-filterable field refused; explain test shows the index use.
- [ ] **Geography registry:** 8 divisions and 64 districts; every district under its division; bn and en names present.
- [ ] **Photos:** policy NONE refuses upload; BLURRED_PUBLIC serves the blurred variant publicly and not the clear one; files are PRIVATE.
- [ ] **Scraping limit** on search.
- [ ] **Isolation:** another organization's listing never appears; a customer token of organization A at B is refused (M.1 rule).
- [ ] **Staff:** permission denied, cross-org, audit masking.
- [ ] Module-off suite includes `directory`.
- [ ] Every existing suite green; full "Done means" list.

## Out of scope
- Admin moderation screens (M.3)
- Unlocks and credits (M.4)
- Reports and blocks (M.7)
- The public site pages (M.6)
- The matrimony templates (M.8)

## Risks & checks
- **One projection function;** never filter fields in a controller.
- **The geography data must be correct:** take it from the official list, do not generate it.
- Stop and ask if a doc 16 rule conflicts with M.1's code.

## Done when
- Customers can create, submit and manage a listing.
- Staff can review it.
- The public can search approved listings with filters.
- Each field is visible only to the tiers allowed.
- The Opus review passes.
