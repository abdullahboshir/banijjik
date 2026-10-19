# Handoff: card M.2 · IMPLEMENT · 2026-10-19

- **Branch / commit:** `s/m2-directory-api` @ `959bb49` in worktree `E:\WEB-DEVELOPMENT\PROJECTS\business-platform\banijjik-m2` (based on `main` ~`1331be1`). Not merged/pushed.
- **Model:** Cursor (Composer)
- **Done:**
  - OPTIONAL module `commerce/directory` (`MODULE_KEY.DIRECTORY`, `tenantCanDisable: false`): Listing entity, statuses, storefront my-listing + public search, staff queue/approve/reject/hide/unhide
  - Visibility only via `projectListing*` (PUBLIC / MEMBER / UNLOCKED_MEMBER / OWNER / STAFF); UNLOCKED never to customers until M.4
  - Template/org listing field properties (`listingTier`, `isFilterable`, `sectionKey`, `minAgeYears`, `mustDifferFromAccountPhone`) + template `directory` block
  - `GEO_BD` field type + BBS-backed registry (`packages/contracts/src/directory/geo-bd-registry.ts`; source noted in file header; not generated)
  - Attribute-pattern search filters (incl. age range, GEO_BD prefix, MULTI_SELECT any-of); index excludes UNLOCKED/PRIVATE
  - `LISTING_PHOTO` PRIVATE + `FILE_VARIANT.blurred`; public serve only blurred for LISTING_PHOTO; `directory.photoPolicy` NONE refuses photos
  - Optional customer auth for MEMBERS tier on search; search rate limits; sequence `LISTING`
  - Directory vocabulary on `@banijjik/contracts/directory` and `@banijjik/validation/directory` (root indexes stay ≤ 300 lines)
  - ADR-127 (Accepted proposed), docs 09/12/14 rows, module README, i18n EN/BN (API + platform labels)
  - Tests: projection matrix, submission rules, entity transitions, GEO registry, directory API (photos/cross-org), file blurred variants, permission catalog counts, platform i18n coverage
- **Verified with** (env from `docs/ops/implement-with-cursor.md`; nothing else on ports 4000/3101):
  - `npm run lint` → exit 0 (max-warnings 0)
  - `npm run format:check` → All matched files use Prettier code style
  - `npx turbo run build typecheck test --force --env-mode=loose --concurrency=1` → **Tasks: 29 successful, 29 total**; `TURBO_EXIT=0` (~10m51s). Package test totals: lint-tests 274; contracts 74; ids 14; ui 230; i18n 24; validation 238; web-client 97; **api 1806 passed | 1 skipped**; platform 123; admin 496
  - `npm run test:tools` → Test Files 6 passed; Tests **274 passed**
  - `VITEST_MAX_WORKERS=1 npm run test:browser -w @banijjik/admin` → Test Files **10 passed | 1 skipped**; Tests **81 passed | 8 skipped**; exit 0 (~154s)
  - `VITEST_MAX_WORKERS=1 npm run test:browser -w @banijjik/platform` → Test Files **1 passed**; Tests **16 passed | 2 skipped**; exit 0 (~80s)
  - Index line counts after R1-1: `packages/contracts/src/index.ts` **299**; `packages/validation/src/index.ts` **287**
- **Not done / known gaps:**
  - Opus T1 **REVIEW** not run
  - Admin moderation UI (M.3), unlocks (M.4), matrimony templates (M.8) out of scope
- **Deviations from plan (and why):**
  - Cross-org staff probe expects **404** (ADR-080 membership concealment), not 403 — matches tenant isolation elsewhere
  - Images always produce a fourth `blurred` variant; file delete object-count test updated from 3 → 4
  - ESLint: `geo-bd-registry.ts` exempt from `max-lines` in `eslint.config.mjs` (static BBS data; `noInlineConfig` forbids file comments)
  - R1-1: no new root-index lines for directory; subpaths + package exports + eslint restriction + new-module alias (like catalog). Validation uses `@banijjik/validation/directory`. Deleted one-off `scripts/fix-geo-registry.mjs` (R1-3). Dropped the temporary `public-settings.ts` barrel compaction.
  - `v1` tenant assembly extracted to `v1-tenant-assembly.ts` for line limits
- **Decisions made:** ADR-127 Accepted (proposed) as in the plan; no extra product decisions
- **Notes for the next session:**
  1. Work in **worktree** `banijjik-m2` on `s/m2-directory-api`.
  2. Mandatory **T1 REVIEW** (Opus) before merge.
  3. Merge check: re-run the Done-means block on a free machine.
- **Next suggested card / pair:** M.2 REVIEW → merge; then M.3 (admin moderation) or continue Phase 3 cards in the main tree
