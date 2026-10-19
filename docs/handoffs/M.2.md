# Handoff: card M.2 · IMPLEMENT · 2026-10-19

- **Branch / commit:** `s/m2-directory-api` @ `12fb592` in worktree `E:\WEB-DEVELOPMENT\PROJECTS\business-platform\banijjik-m2` (based on `main` ~`1331be1`). Not merged/pushed.
- **Model:** Cursor (Composer)
- **Done:**
  - OPTIONAL module `commerce/directory` (`MODULE_KEY.DIRECTORY`, `tenantCanDisable: false`): Listing entity, statuses, storefront my-listing + public search, staff queue/approve/reject/hide/unhide
  - Visibility only via `projectListing*` (PUBLIC / MEMBER / UNLOCKED_MEMBER / OWNER / STAFF); UNLOCKED never to customers until M.4
  - Template/org listing field properties (`listingTier`, `isFilterable`, `sectionKey`, `minAgeYears`, `mustDifferFromAccountPhone`) + template `directory` block
  - `GEO_BD` field type + BBS-backed registry (`packages/contracts/src/directory/geo-bd-registry.ts`; source noted in file header; not generated)
  - Attribute-pattern search filters (age range, GEO_BD prefix, MULTI_SELECT any-of); range-only query keys work; index excludes UNLOCKED/PRIVATE
  - `LISTING_PHOTO` PRIVATE + `FILE_VARIANT.blurred`; public serve only blurred for LISTING_PHOTO; `directory.photoPolicy` NONE refuses photos
  - Optional customer auth for MEMBERS tier on search; search rate limits; sequence `LISTING`
  - Directory vocabulary on `@banijjik/contracts/directory` and `@banijjik/validation/directory`; accounting/pricing moved to `@banijjik/validation/{accounting,pricing}` so root indexes stay ≤ 300
  - ADR-127 (Accepted proposed), docs 09/12/14 rows, module README, i18n EN/BN (API + platform labels)
  - Tests: projection matrix, submission rules, entity transitions, GEO registry, listing-filters unit, directory API (filters+explain, scrape 429, viewer 403, audit redact, photos/cross-org), file blurred variants, module-contract suite covers `directory`
- **Verified with** (env from `docs/ops/implement-with-cursor.md`):
  - Earlier full Done-means (R1): lint/format; turbo **29/29**; api **1806 passed | 1 skipped**; test:tools **274**; admin browser **81**; platform browser **16**
  - Finish session: `npm run lint` → exit 0; validation build ok; directory + module-contract tests → **127 passed** (36 directory + contracts); index lines: contracts **299**, validation **271**
- **Not done / known gaps:**
  - Opus T1 **REVIEW** not run (required before merge)
  - Admin moderation UI (M.3), unlocks (M.4), matrimony templates (M.8) out of scope
- **Deviations from plan (and why):**
  - Cross-org staff probe expects **404** (ADR-080 membership concealment), not 403
  - Images always produce a fourth `blurred` variant; file delete object-count test updated from 3 → 4
  - ESLint: `geo-bd-registry.ts` exempt from `max-lines` (static BBS data)
  - R1-1/lanes: directory and (on this branch) accounting/pricing validation subpaths so root indexes stay ≤ 300
  - Fixed `listingFiltersFromQuery` so `f.<key>.ageMin` / `.min` / GEO suffixes alone build filters (range keys were previously skipped)
  - Restored a broken `v1.ts` import of missing `./tenant-routers.js` (duplicate `buildTenantRouters`) that blocked the API test transform
- **Decisions made:** ADR-127 Accepted (proposed) as in the plan; no extra product decisions
- **Notes for the next session:**
  1. Work in **worktree** `banijjik-m2` on `s/m2-directory-api`.
  2. Mandatory **T1 REVIEW** (Opus) before merge.
  3. Stash `wip-unrelated-accounting-pricing-not-m2` may still exist; validation subpath pieces were applied into this branch.
- **Next suggested card / pair:** M.2 REVIEW → merge; then M.3 (admin moderation)
