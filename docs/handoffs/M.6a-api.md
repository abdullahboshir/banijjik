# Handoff: card M.6a (storefront reads and static pages, API) · IMPLEMENT · 2026-10-24

- **Branch:** `s/M.6a-api-storefront-reads`, created from `origin/main` `8493a8eb` (no rebase was needed: main had not moved). Pushed without force.
- **Model:** Claude Haiku 5.5 (Claude Code), unattended run.
- **Plan:** `docs/plans/M.6.md`, Part M.6a only (decisions 1 to 7, the M.6a rows of Files, Interfaces, Data and the M.6a test list). The plan file has no Refresh or Amendment section, so the base text was followed.
- **CI:** [run 40111781742](https://github.com/abdullahboshir/banijjik/actions/runs/40111781742) (code head `075d696c`; browser job passed on attempt 2 after one 30 s dialog timeout on attempt 1)

## Done
- **Contracts** (`@banijjik/contracts/website`, new): `SITE_PAGE_KEY`, `SitePageResponse`, `SitePageUpsertRequest`, `StorefrontSitePageResponse`, `StorefrontSiteResponse`, `WEBSITE_EVENT_TYPE.PAGE_UPDATED` (`website.page.updated`), length bounds. Add-only: `WEBSITE` permissions `website.page.read` and `website.page.update`, audit `website.page.updated` and entity type `sitePage`, the event in `EVENT_TYPE` and the event payload map, the `./website` subpath export. `directory`: `StorefrontListingField` (explicit interface, see deviations), `StorefrontDirectoryFormResponse`, `StorefrontDirectoryStatsResponse`; `IndustryTemplateDirectoryBlock.homeStatsFieldKey?`.
- **Validation:** `@banijjik/validation/website` (`sitePageUpsertRequestSchema`, `sitePageKeyParamsSchema`); template `homeStatsFieldKey` (regex, and a refine: a PUBLIC SELECT listing field of that key, absent tier = PUBLIC).
- **ids:** `SitePageId`, `DirectoryListingStatsId`.
- **i18n:** two permission labels (en and bn).
- **Module `commerce/website`** (OPTIONAL, `module.manifest.ts`, README): domain `SitePage` (create at version 1, `replaceContent` bumps version); repository through `models({})` with `updateVersioned` for saves and a duplicate-key insert; use cases `ListSitePagesUseCase`, `UpsertSitePageUseCase` (create or versioned update in `withTransaction`, audit and event with ids and flags only), `GetPublishedSitePageUseCase`, `ListPublishedSitePagesUseCase`, `GetStorefrontSiteUseCase`; routers `buildWebsiteTenantRouter` (admin) and `buildWebsiteStorefrontRouter` (`/site`, `/pages/:pageKey`); `index.ts` exports the manifest, the model registration and the two builders.
- **Directory:**
  - summary `DirectoryListingStats` (`directory_listing_stats`, unique `organizationId`, `version`, audit fields), written only by `refreshListingStats` through `saveIfChanged` (no write when the counts are equal, so a rerun leaves the row and its version as they were);
  - the handler `directory.refreshListingStats` on `LISTING_APPROVED` with `alsoHandles` HIDDEN, UNHIDDEN, ARCHIVED, UPDATED, UNORDERED;
  - the aggregation `$match { organizationId, status: APPROVED }` + `$group` on `$customFields.<homeStatsFieldKey>`, on the existing index prefix (no new index);
  - reads `GetStorefrontDirectoryFormUseCase` and `GetStorefrontDirectoryStatsUseCase` (stats read the summary row only), mounted by `presentation/directory-storefront-reads.ts` behind `requireDirectoryModule`;
  - manifest: two storefront routes, `consumes` the five listing events.
- **Organization:** the storefront organization reader returns `tagline`, `logoFileId`, `primaryColor`, `accentColor` (from `branding`, null when unset).
- **Seeds:** `matrimony.json` and `matrimony-islamic.json` get `homeStatsFieldKey: "gender"` (both have `gender` as a PUBLIC SELECT listing field).
- **Routes and wiring:** `routes/storefront.ts` (website router, directory gate, `moduleSwitch`, `customerLoginEnabled` extracted from the customer-login switch, `buildWebsiteSiteSources`), `routes/core-tenant-routers.ts` (`websiteRouter`), `routes/tenant-module-routers.ts` (one array entry), `routes/module-registry.ts` (manifest), `routes/v1.ts` (`registerWebsiteModels`), `start-worker.ts` (`registerDirectoryStatsHandler`).
- **Grants:** `system-role-grants.ts` row `website` (OWNER and MANAGER ALL, STAFF read, others none).
- **Docs:** ADR-144 (Accepted (proposed)) appended to `docs/04-DECISIONS.md`; `docs/14-API.md` §6 rows (site, pages, form, stats, staff pages); `docs/16` §3.4 pointer to `homeStatsFieldKey`; `apps/api/src/modules/commerce/website/README.md`; `commerce/directory/README.md` (kept at 30 lines).

## Deviations from the plan (and why)
1. **`routes/v1.ts`** gets one add-only line `registerWebsiteModels()`: the model must be registered at boot and the plan's file list did not name it.
2. **`routes/core-tenant-routers.ts`** builds the admin router (`websiteRouter`), and `tenant-module-routers.ts` uses it in its existing array line. Building it inside `tenant-module-routers.ts` took `buildTenantRouters` to 61 lines (lint max 60).
3. **`routes/storefront.ts`: mount order.** The website router is mounted before the directory, credit and contact routers. The contact router applies `router.use(requireCustomerLogin)` to every path, so a later mount would answer 404 for `/site` while customer sign-in is off (found by the test run).
4. **`start-worker.ts`** calls `registerDirectoryStatsHandler(buildDirectoryBlockReader())`. The directory module does not import the industry module, so the template reader is passed in by the worker.
5. **`eslint/restrictions.mjs`** domain allow-list gets `/website` (the domain entity imports `@banijjik/contracts/website`; same mechanism as the other subpaths).
6. **Validation: `sitePageKeyParamsSchema` is not strict.** The route params also carry `organizationId`; the credit params schemas are non-strict for the same reason.
7. **Title bounds read as 0 to 120 per language.** The plan says "1–120 per locale" and also refuses publishing with no title in either language. Only the 0 to 120 reading makes both rules meaningful, so each locale may be empty and a published page needs one non-empty title.
8. **Test names:** `reports customer sign-in off until the business switches it on` replaces the plan's `customerLogin is false while the SMS driver is disabled` (the test environment's SMS driver is not switched). `answers 404 for pages while the website module is off, and the site lists none` is added for the storefront off-path. The plan's `answers 404 for pages when the website module is off` is covered by that test plus the generated module-off test.
9. **Contract probes.** The `website` contract probe is removed (the real module answers its key); `workflow` now depends on the real `website`. The probe setting `website.probeEnabled` goes with it. `resolved-config-api.test.ts` no longer uses a website probe; its `/website/disable` case asserts `requiredBy: ["workflow"]` against the real module. The weaker assertion in commit 87a903e4 was reverted on the lead's decision.
9b. **`website` is tenant-disableable** (`tenantCanDisable: true`, lead decision for M.6a, like `credit`): a business may switch its public site off. The plan did not say this; the lead added it.
10. **Expected module lists.** RETAIL and SALON now resolve `website` as effective (their templates allow it). `industry-template-api.test.ts`, `industry-template-write-api.test.ts` and `entitlement-api.test.ts` gained `"website"`. This is the behaviour the template data asks for, not a change of rule.
11. **Form and stats gate:** only the two new routes are gated by `requireDirectoryModule` (plan: 404 when directory is off).
12. **Stats tests** drive `refreshListingStats` after direct updates of listing documents, not through the staff API and the event worker (the directory tests have no event processing; the worker needs Redis). The stats test names are the plan's, with the "approve, hide, reveal, archive, update" steps done as status updates.

## Test names
- `packages/contracts`: updated counts (permission keys 122, audit entity list with `sitePage`, event list with the website event).
- `packages/validation/src/platform/industry-template-schemas.test.ts`: `accepts a home statistics field that is a PUBLIC SELECT listing field`; `refuses a home statistics field that is a TEXT field`; `refuses a home statistics field that is a MEMBERS tier field`; `refuses a home statistics field key that names no listing field`.
- `apps/api/src/modules/commerce/website/website-api.test.ts`:
  - `stores a page, then answers it on the storefront once published`
  - `refuses a stale page version with 409 and changes nothing`
  - `refuses a title over 120 characters and a body over 20,000 with 400`
  - `refuses publishing a page with no title in either language`
  - `lets a staff member read pages but not change them`
  - `does not show one organization's page to another`
  - `lists all six page keys, a missing one as an empty unpublished page`
  - `returns branding, features and published page titles only`
  - `answers 404 for pages while the website module is off, and the site lists none`
  - `reports customer sign-in off until the business switches it on`
- `apps/api/src/modules/commerce/directory/directory-stats-api.test.ts`:
  - `stats count approved listings by the template's field and ignore other statuses`
  - `stats read zeros before the first listing event and never scans listings`
  - `a second delivery of the same listing event leaves the stats row unchanged`
  - `the form read returns only storefront-visible listing fields with their tiers and sections`
  - `form and stats answer 404 when the directory module is off`
- Module-off generated tests (`module-contracts.test.ts`, `module-registry-contracts.test.ts`) run for `website` and the directory's new routes; they passed locally (see the verification log below).

## T1 self-review (guide §11)
| # | Item | Test or file / reason |
|---|---|---|
| 1 | Every balance change writes its ledger entry | n/a: M.6a moves no money, stock or credit |
| 2 | Limits checked in the same transaction; double action stopped by unique index | n/a: no limits. Page insert uses the unique `{organizationId, pageKey}` index; the save is a versioned write inside `unitOfWork.run` |
| 3 | Currency compared, never assumed | n/a: no money |
| 4 | Percentage clamped | n/a: no percentage |
| 5 | Reversals undo everything | n/a: no reversal in M.6a |
| 6 | Updates use `version`; stale 409; repository never turns unknown errors into `false` | `refuses a stale page version with 409 and changes nothing`; `updateVersioned` throws the conflict; `insert` returns `duplicate` only for a duplicate-key error, every other error is rethrown |
| 7 | Money/credit/stock POST replays with `Idempotency-Key` | n/a: the page PUT is idempotent by `version`; no money or stock POST |
| 8 | One bad row never stops the loop | n/a: no batch job; the stats handler is one event |
| 9 | Keyset batches, not collected arrays | n/a: the stats aggregation returns one row per option value (bounded by the template's options) |
| 10 | Jobs catch up, rerun does nothing twice | `a second delivery of the same listing event leaves the stats row unchanged` |
| 11 | Every state has a way out | pages: a page is published or not, and a save can change either; stats: each listing event recomputes |
| 12 | Settings read in a job resolve outside a request | n/a: the handler reads the template block through `buildDirectoryBlockReader` (tested through the handler in `directory-stats-api.test.ts`) |
| 13 | Business dates use the organization's local date | n/a: no business date in M.6a (`computedAt` is an instant) |
| 14 | Date tests use a fixed clock | n/a: no date logic |
| 15 | `$regex` input escaped and anchored | n/a: no search or regex input. The stats field key comes from a validated template (plain key, no `.` or `$`) |
| 16 | No secret, token or part stored, logged or returned | `returns branding, features and published page titles only` (no other organization field) |
| 17 | Rules ask for permission keys, not role keys | `lets a staff member read pages but not change them` (403 on PUT); grants table keyed by permission |
| 18 | Location-owned data registered with LOCATION tenancy | n/a: pages and the stats row are ORGANIZATION tenancy (no location field) |
| 19 | No `as unknown as` in production code | checked: none in the changed production files (`grep`) |
| 20 | No optional dependency that silently changes behaviour | the stats handler requires `template`; the site read requires `siteSources`; `registerDirectoryStatsHandler` takes the template as a required argument |
| 21 | Event names, posting keys, error codes, audit actions from contracts | `WEBSITE_EVENT_TYPE`, `AUDIT_ACTION.SITE_PAGE_UPDATED`, `ERROR_CODE`, `DIRECTORY_EVENT_TYPE` |
| 22 | Schemas carry audit fields and `version`; indexes start with `organizationId` | `site_pages` `{organizationId, pageKey}` unique, `{organizationId, isPublished}`; `directory_listing_stats` `{organizationId}` unique; both carry `version` and audit fields |
| 23 | Other modules imported only through `index.ts` | website imports `kernel` and contracts only; the storefront composition imports `website/index.js`; the directory test imports `platform/industry/index.js` |
| 24 | Each plan test exists and checks its name; ADR, docs and handoff match | the list above; the two name deviations are in deviations 8 |

## Verification (local)
- `npx turbo run typecheck --filter=@banijjik/api`: `Tasks: 5 successful, 5 total`.
- `npx eslint` on every changed folder: exit 0. `prettier --check` on the changed folders: `All matched files use Prettier code style!`.
- Local tests (single files, `VITEST_MAX_WORKERS=1`): `website-api.test.ts` 10 passed; `directory-stats-api.test.ts` 5 passed; `module-contracts.test.ts`, `module-registry-contracts.test.ts`, `system-role-grants.test.ts`, `entitlement-api.test.ts`, `customer-auth-api.test.ts` passed (202 tests with the website tests); `industry-template-api.test.ts`, `industry-template-write-api.test.ts`, `resolved-config-api.test.ts` 32 passed; `packages/contracts` 76, `packages/validation` 271, `packages/ids` 14, `packages/i18n` 25 passed.

## Known gaps (also in STATUS)
- The stats handler is exercised by calling `refreshListingStats` directly; the event worker path (outbox to handler) is not tested for directory stats.
- Option values containing `.` or `$` are not checked before they become Mongo keys in `countsByOption` (template options are not restricted in this card).
- After a template change of `homeStatsFieldKey`, the counts show zeros until the next listing event recomputes the row.
- The existing directory storefront routes (listings, detail, my listing) are not gated by the directory module in `routes/storefront.ts`. This predates M.6a and is not changed here; the two new reads are gated.
