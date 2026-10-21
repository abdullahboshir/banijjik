# T1 Review: card M.4 (credits and connections)

| | |
|---|---|
| Card | M.4 credits and connections (matrimony track) |
| Branch | `s/m4-credits`, worktree `banijjik-m2` |
| Reviewed commit | `783c46f5` (19 commits over `main`, `3b2331c8`..`783c46f5`; feature commit `522b9bc9`) |
| Reviewer | T1 review session (Opus) |
| Date | 2026-10-21 |
| Method | Read-only review: `docs/plans/M.4.md`, `docs/handoffs/M.4.md`, ADR-130, `docs/plans/phase-3-lanes.md`, and the full `git diff main...HEAD`. No file was changed and no test suite was run during the review; the handoff's green runs were checked against the test source, not re-executed. This report is the only file this session adds. |

## Verdict

**PASS WITH FIXES**

The core money path is sound: guarded atomic balance updates inside `withTransaction`, append-only ledger writes, FIFO allocation, natural-key unlock idempotency with unique-index race recovery, in-transaction approval-token consumption, API-enforced permissions, contracts-first vocabulary, and BN/EN parity. Two blockers and one major must be fixed before merge; the rest are minors and polish. Re-review only the delta after the fixes.

## What the diff gets right

- **Guarded balance math.** `applyDelta` decrements only when `balance >= -delta` in the same atomic `findOneAndUpdate`, and upserts on positive deltas (`apps/api/src/modules/commerce/credit/infrastructure/mongo-credit.repository.ts:61-85`). Money is integer minor units via the `Money` contract; no float math.
- **One transaction per unlock.** Balance decrement, SPEND entries, `ListingUnlock`, and events all run inside `unitOfWork.run` (`apps/api/src/modules/commerce/credit/application/use-cases/unlock-listing.use-case.ts:122-151`); the balance write and ledger insert cannot diverge.
- **Idempotent unlocks.** The natural `(customer, listing)` key is checked first (`unlock-listing.use-case.ts:51-55`), the unique index backs it (`apps/api/src/modules/commerce/credit/infrastructure/listing-unlock.schema.ts:30-33`), and the loser of a race re-reads the winner and returns `creditsSpent: 0` (`unlock-listing.use-case.ts:78-88`). Covered by the 3-of-5 parallel test (`apps/api/src/modules/commerce/credit/presentation/credit-api.test.ts:404`) and the duplicate-in-parallel test (`:458`).
- **FIFO allocation and expiry.** The allocator is pure and tested: unexpired purchases first, then expired, remainder unattributed (`apps/api/src/modules/commerce/credit/domain/spend-allocation.ts:15-41`). Expiry idempotency is DB-enforced by the partial unique index on `(organizationId, source.sourceId)` for EXPIRE rows (`credit-entry.schema.ts:61-69`) and the duplicate-key catch (`expire-credits.use-case.ts:16-18,88-91`).
- **Approvals.** Missing token without OWNER → `APPROVAL_REQUIRED` (`adjust-credits.use-case.ts:36-42`); the token is consumed inside the same transaction as the write (`:44-51`); single-use is tested (`credit-api.test.ts:757-826`); the owner path is exercised through `grantCredits` (`apps/api/src/test-support/credit-world.ts:42-54`).
- **Tenancy and permissions.** All four models are registered with `MODEL_TENANCY.ORGANIZATION` (`apps/api/src/modules/commerce/credit/infrastructure/register-credit-models.ts:24-52`); credit repositories take the organization from the request context only; the tenant router applies permission middleware on every route and idempotency middleware on every POST (`apps/api/src/modules/commerce/credit/presentation/credit-tenant.router.ts:67-68,83,113,130-131,152`). Cross-org denial is tested (`credit-api.test.ts:866`).
- **Directory decoupling.** Directory owns the ports; routes own the adapters (`apps/api/src/modules/commerce/directory/application/ports/directory-context-ports.ts:40`; `apps/api/src/routes/directory-storefront-adapters.ts`). Directory does not import the credit module; its only credit import is the `ListingUnlockCountResponse` type from `@banijjik/contracts/credit`, which is the shared vocabulary layer.
- **Contracts, i18n, manifest.** New `@banijjik/contracts/credit` subpath (the root index stays at its cap), error codes, permission keys, audit actions, module key/class, event types; BN/EN parity including `CREDIT_API_MESSAGE_KEY_LIST`; the manifest is complete (OPTIONAL, depends on DIRECTORY, `tenantCanDisable`, 4 permissions, SALES menu, 3 settings, 2 emitted events, storefront section) at `apps/api/src/modules/commerce/credit/module.manifest.ts:14-82`.
- **Indexes.** Every credit index starts with `organizationId` (`credit-entry.schema.ts:59-71`, `credit-balance.schema.ts:28`, `listing-unlock.schema.ts:30-35`, `credit-pack.schema.ts:56-57`).
- **Admin screens.** Permission-gated packs page (`apps/admin/src/credit/credit-packs-page.tsx:20,44-46`); contact credits section requires the module plus both contact-account and credit permissions (`apps/admin/src/credit/contact-credits.tsx:33-48`); owner/manager approval flows, no-approver and PIN-lock states are tested (`apps/admin/src/credit/contact-credits.test.tsx:137,244,261-273`); E2E covers pack creation and an owner adjustment (`apps/admin/src/credit/credit-screens.browser.test.ts:164`).
- **Hygiene.** No `console.*`, no empty catch, no v4/UUID/nanoid generators in the credit module; every ID comes from `newId()`.

## Blockers

### B1 — Storefront credit routes are not gated by the credit module

**Evidence**

- The entitlement gate is mounted only on the tenant pipeline: `apps/api/src/routes/v1.ts:181` sits inside `router.use("/orgs/:organizationId", …)`. The storefront is mounted outside it (`apps/api/src/routes/v1.ts:169`).
- The storefront mounts `creditRouter` unconditionally after `businessContext` and next to the directory/contact routers: `apps/api/src/routes/storefront.ts:266-269`.
- `buildCreditStorefrontRouter` registers all four credit routes with no module check: unlock, `/my/credits`, `/my/unlocks`, `/credit-packs` (`apps/api/src/modules/commerce/credit/presentation/credit-storefront.router.ts:133-139`).
- The module-off behaviour already exists for the directory side: `apps/api/src/routes/directory-storefront-adapters.ts:21-36` checks `orgConfig.isModuleEffective(…, MODULE_KEY.CREDIT)` before hiding UNLOCKED fields, and `apps/api/src/routes/directory-tenant-router.ts:22-31` returns null for the unlock counter so the count route 404s.
- The module-off test checks only the projection, the count and the tenant packs API (`credit-api.test.ts:718-753`, especially `:750-752`). It never calls the storefront credit routes.
- `docs/handoffs/M.4.md:12` claims "with the credit module off ... the credit routes are absent". That is true for the tenant API only; the storefront routes stay live.

**Why it matters**

With the credit module disabled for an organization, a signed-in customer can still call `POST /storefront/orgs/{organizationId}/listings/{listingNumber}/unlock`, spend credits, see `/my/credits` and `/my/unlocks`, and list `/credit-packs`. This contradicts the plan's module-off rule (`docs/plans/M.4.md:52`, `:89`) and creates a split state: UNLOCKED fields are hidden by the projection while unlocks still charge and unlock records are still written. Disabling a module must remove its storefront surface, not only its staff API and its projection effect.

**Required fix**

- Gate the whole credit storefront router on module effectiveness. Cleanest place: in `apps/api/src/routes/storefront.ts`, mount a middleware between `businessContext` (`:266`) and `creditRouter` (`:268`) that reads the organization from the request context and throws `notAvailable()` (404) when `input.orgConfig.isModuleEffective(organizationId, MODULE_KEY.CREDIT)` is false. Equivalently, pass the same check into `buildCreditStorefrontRouter` and have it wrap all four routes. Do not gate the directory or contact routers.
- Extend `credit-api.test.ts:718` to assert 404 for all four credit paths after `disableCreditModule`, and assert the customer's balance and ledger are unchanged (no charge).

### B2 — `CreditEntry` is not registered as append-only

**Evidence**

- The kernel supports and enforces the flag (`apps/api/src/kernel/db/model-registry.ts:14-18,91-94`): `appendOnly: true` applies `appendOnlyPlugin`, which rejects updates, replaces and deletes.
- The `CreditEntry` registration omits it: `apps/api/src/modules/commerce/credit/infrastructure/register-credit-models.ts:32-38`.
- Every sibling ledger sets it: `apps/api/src/modules/commerce/accounting/infrastructure/register-accounting-models.ts:26`, `apps/api/src/modules/commerce/inventory/infrastructure/register-inventory-models.ts:34`, `apps/api/src/modules/core/audit/infrastructure/register-audit-models.ts:25,34`.
- The plan requires append-only credit entries: "every change is an append-only credit entry" and "CreditEntry (append-only)" (`docs/plans/M.4.md:12,25`).

**Why it matters**

ADR-130's guarantee currently rests only on the repository never calling update/delete. Any future code, migration, or ad-hoc query can rewrite history, and the kernel's guard — the project-wide mechanism for ledgers (ADR-014/ADR-089) — will not fire. The balance is a projection of this ledger; a mutable ledger breaks the reconciliation property the whole design rests on. The existing registry meta-test cannot catch this because it only asserts `guarded.length >= 8` (`apps/api/src/kernel/tenancy/middleware-bypass.test.ts:183-185`).

**Required fix**

- Add `appendOnly: true` to the `CreditEntry` registration in `register-credit-models.ts:32-38` (next to `tenancy`).
- Add a regression test that an update and a delete on the compiled `CreditEntry` model reject with `errors.append_only_model`, following `apps/api/src/kernel/db/append-only-plugin.test.ts:44-123` (or assert the compiled schema carries `APPEND_ONLY_PLUGIN_MARKER` as the registry meta-test does).

## Major

### Ma1 — The daily unlock cap is checked outside the transaction

**Evidence**

- `assertWithinDailyLimit` runs before `performUnlock` (`apps/api/src/modules/commerce/credit/application/use-cases/unlock-listing.use-case.ts:69`; method at `:107-114`), while the transaction starts later (`:122`).
- The unlock daily limit is per customer (`credit.unlocksPerDay`, default 20), and the only serialization today is the `(customer, listing)` unique index. Unlocks of different listings do not contend on it.

**Why it matters**

Two or more unlocks of different listings for the same customer, issued in parallel at the boundary, all read `count = limit - 1` and pass the check; each then enters its own transaction. The balance guard serializes them and may refuse for insufficient credits, but a customer with enough credits can exceed `credit.unlocksPerDay`. The plan states a hard daily cap (`docs/plans/M.4.md:48`), and the current test only exercises sequential requests (`credit-api.test.ts:502-546`).

**Required fix**

- Move the count check inside `performUnlock`'s `unitOfWork.run`, before `applyDelta` (`unlock-listing.use-case.ts:122-126`). `withTransaction` retries the whole callback on `TransientTransactionError` (`apps/api/src/kernel/db/with-transaction.ts:106-123`), so a losing transaction re-reads the count after the winner commits.
- Read the count with the active session so it is part of the transaction snapshot: pass `sessionOption(getActiveSession())` in `MongoListingUnlockRepository.countByCustomerToday` (`apps/api/src/modules/commerce/credit/infrastructure/mongo-listing-unlock.repository.ts:73-84`), as `insert` already does (`:27`). Add the session parameter to the port if needed.
- Add a concurrency test: set `unlocksPerDay` to N, grant enough credits, fire N+2 parallel unlocks of different listings, assert exactly N succeed, the rest return 429 `UNLOCKS_PER_DAY_EXCEEDED`, and the ledger contains exactly N SPEND entries.

## Minors

1. **Zero-credit adjustment is accepted by the API.** `creditAdjustRequestSchema` uses `z.number().int()` (`packages/validation/src/credit/credit-schemas.ts:37`), so `credits: 0` validates; the use case writes a zero-value ADJUST entry, records audit, and (for a non-owner) consumes a single-use approval token (`apps/api/src/modules/commerce/credit/application/use-cases/adjust-credits.use-case.ts:44-67`). The admin form rejects zero (`apps/admin/src/credit/credit-form.ts:98`). Fix: reject zero at the schema (or use disjoint positive/negative integer schemas) and add a validation test.
2. **Unreachable empty-string fallback.** `creditEntryId: entries[0]?.creditEntryId ?? ""` (`unlock-listing.use-case.ts:137`) can only produce an invalid stored ID. The allocator always returns at least one allocation for a positive cost (`spend-allocation.ts:39`), and the cost setting is forced to a positive integer (`unlock-listing.use-case.ts:97-105`). Fix: assert the first entry exists (internal error) instead of persisting `""`.
3. **Three clock reads for one unlock.** `unlockedAt` and `createdAt` call `clock.now()` separately (`unlock-listing.use-case.ts:138-139`), and `createSpendEntries` takes its own `now` (`:165`). Fix: read the clock once and thread the timestamp through.
4. **Hard 1000-row ceilings.** `listPurchases` and `listExpiringPurchases` end with `.limit(1000)` (`mongo-credit.repository.ts:96,131`). At more than 1000 purchase entries, later purchases never receive spend attribution, and the expiry job leaves their remainders unexpired (credits stay in the balance past expiry). There is no expiry scheduler yet (handoff gap), so this is not live money damage today, but it must be fixed before the scheduler ships: keyset-page by `occurredAt`/`creditEntryId` until exhausted.
5. **Reads that skip `lean()`.** `findExisting` and `findByCustomerAndListing` (`mongo-listing-unlock.repository.ts:40,50`), `listByCustomer` (`:60-64`), and the pack reads `findById`/`listActive` (`mongo-credit-pack.repository.ts:48-60`) hydrate full documents; AGENTS.md asks for `lean()` plus projection on reads. Add projections where the full document is not needed.
6. **Pack insert always stores `createdByUserId: null`.** `toDocument` hardcodes both audit fields (`mongo-credit-pack.repository.ts:102-103`); `save` overrides `updatedByUserId` (`:41`) but `insert` has no actor, so `createdByUserId` is never populated even though the audit log records the creator (`credit-pack.use-cases.ts:99`). Pass the actor into `insert` (port change + call site at `credit-pack.use-cases.ts:73`) and persist it.
7. **Dead and duplicated repository API.** `findPurchaseEntry` is declared (`credit-repository.ts:31`) and implemented (`mongo-credit.repository.ts:136-144`) but has no production caller (only a test fake at `expire-credits.use-case.test.ts:95`). `findExisting` and `findByCustomerAndListing` are identical in the port (`listing-unlock-repository.ts:7,11`) and in the adapter (`mongo-listing-unlock.repository.ts:34-52`), and only `findExisting` is used. Delete both leftovers.
8. **Unpaginated storefront pack list.** `GET /credit-packs` returns every ACTIVE pack (`credit-storefront.router.ts:127-131`; `mongo-credit-pack.repository.ts:54-61`). The plan calls it a public list (M.4.md:57), but AGENTS.md requires every list endpoint to be paginated (limit ≤ 100). Add a server-side cap (e.g. first 100 by `sortOrder`) or a page query.
9. **Repository methods take `organizationId` as an argument.** `findById`/`listActive` accept it and build the tenant model from it (`mongo-credit-pack.repository.ts:48-60`) while the other credit repositories use `getRequestContext()` only. All current callers pass `organizationIdOf()` from the context (`credit-pack.use-cases.ts:36,49,114,158`), so there is no bypass today; keep it that way and prefer the context-only helper for consistency.
10. **Duplicated dependency assembly.** `buildCreditRouterDeps` (`routes/storefront.ts:66`) and `creditDeps` (`routes/credit-tenant-router.ts:70`) build the same repositories and settings adapters twice. A shared builder would prevent staff/storefront drift; not a defect.
11. **Handoff statement is inaccurate.** `docs/handoffs/M.4.md:12` says the credit routes are absent with the module off; only the tenant API is. Update the handoff when B1 is fixed.

## Deviation assessments (a)–(e)

Both the plan and `docs/handoffs/M.4.md` were read before the diff. All five declared deviations are acceptable.

| # | Deviation | Assessment |
|---|---|---|
| **a** | Browser test seeds the platform catalog by patching `industry_templates.allowedModuleKeys` and bumping `organizations.configVersion` (`apps/admin/src/credit/credit-screens.browser.test.ts:103-115`) | **ACCEPT.** Test-only. The browser harness has no platform session, and the patch mirrors what a platform grant produces, including the config-version bump that invalidates caches. The real entitlement path is covered by the API test helpers (`apps/api/src/test-support/credit-world.ts:11-19`), so this does not hide a gate defect. |
| **b** | `platform.module.credit` labels added to the platform catalog | **ACCEPT.** `platform.module.<moduleKey>` is the established key convention (`apps/platform/src/packages/module-catalog.ts:19`); the platform module list and grant sheet need a name for every module. Add-only. |
| **c** | EXPIRE idempotency through `source.sourceId` plus a partial unique index instead of a business-date key | **ACCEPT.** The index is the narrowest correct constraint: `(organizationId, source.sourceId)` filtered to `type: EXPIRE` and `source.sourceType: EXPIRY_JOB` (`apps/api/src/modules/commerce/credit/infrastructure/credit-entry.schema.ts:61-69`). A duplicate means the purchase's remainder was already expired; the catch treats it as done (`expire-credits.use-case.ts:88-91`). Documented in ADR-130. |
| **d** | Extra `ListingUnlockCounter` port | **ACCEPT.** It keeps directory free of credit imports, preserves the count-only privacy decision, and carries the module-off 404 through a null adapter (`apps/api/src/routes/directory-tenant-router.ts:22-31`; test at `credit-api.test.ts:744-748`). The plan names `ListingUnlockReader.isUnlocked`; the implementation's `hasUnlocked` + batch `unlockedListingIds` is an interface adaptation that avoids N+1, with the same behaviour. The counter is genuinely separate. |
| **e** | New-module generator test alias list extended with `@banijjik/contracts/credit` | **ACCEPT.** Matches the new package export (`packages/contracts/package.json:46-48`) and the lint domain exception (`eslint/restrictions.mjs:42`); the generator test alias list is at `scripts/new-module/new-module.test.mjs:67,84`. Mechanical, add-only, keeps `npm run new-module` green. |

## Test-coverage gaps

The suite is strong on the DoD cases: happy path, validation, permission denied, cross-org, own-listing refusal, insufficient credits, daily limit, replay, parallel duplicates, projection/privacy, approval single-use, and a partial module-off test (`credit-api.test.ts:210-905`). The gaps left:

1. **Module-off storefront (B1).** No assertion for unlock / `/my/credits` / `/my/unlocks` / `/credit-packs` with the module off, and no assertion that no credits are charged.
2. **Daily-cap concurrency (Ma1).** The cap is only tested sequentially (`credit-api.test.ts:502`); a parallel boundary test is missing.
3. **Append-only regression (B2).** No test that `CreditEntry` rejects update/delete through the compiled model.
4. **Expiry index race.** The expiry unit test fakes `CreditEntryAlreadyExistsError` (`apps/api/src/modules/commerce/credit/application/use-cases/expire-credits.use-case.test.ts:95`); no integration test proves the partial unique index triggers the duplicate on two real concurrent runs.
5. **Invalid settings fallback.** `amountSetting` falls back for non-positive/non-integer values (`unlock-listing.use-case.ts:97-105`); no test covers `credit.unlockCost = 0`/negative or a non-integer value.
6. **Pagination of customer lists.** `/my/credits` and `/my/unlocks` accept pages (`credit-storefront.router.ts:40-42,93-125`), but no test reads a second page or checks the page envelope.
7. **Unpaginated pack list (Minor 8).** No test bounds the number of active packs the storefront returns.

## Lane and process compliance

- **Card placement.** `docs/plans/phase-3-lanes.md` adds M.4 on 2026-10-20 beside 3.6 with ADR-130 (reserved 128/129/130); the branch is allowed to run now. One card per branch is respected (`s/m4-credits`).
- **Worktree discipline.** The review read only `banijjik-m2`; no other worktree was touched.
- **Shared hot files are add-only.** The contracts root index stays at its cap and the new vocabulary arrives through the `./credit` subpath; the validation index, `permission-key.ts`, `system-role-grants.ts`, `routes/*` composition, `module-registry.ts`, the i18n catalogs, `04-DECISIONS.md` and `14-API.md` received additions, not rewrites. The `GET /listings` row edit in `14-API.md` documents the new `viewer` value required by the plan's projection item (`docs/plans/M.4.md:52`), so it is a plan-mandated row update rather than an unauthorized rewrite.
- **Contact module overlap.** `apps/api/src/modules/commerce/contact/index.ts` gained the add-only `buildCustomerAccountLookup()` (about 13 lines). The wave-3 lane table gives `commerce/contact/**` to 3.8/M.1, so there is no live conflict, but the merger should expect a rebase around that file when M.1 or 3.8 lands.
- **Verification not repeated.** Per the machine constraint (one heavy test run at a time), this review ran no suites. The fix session must rerun typecheck, lint, test and build, plus the browser E2E, on the rebased branch and report real output.
- **Handoff.** `docs/handoffs/M.4.md` exists and the STATUS row is updated; its module-off sentence overstates the implemented behaviour (B1).

## Merge checklist

- [ ] B1 fixed: storefront credit routes module-gated, module-off test extended (all four paths, no charge).
- [ ] B2 fixed: `appendOnly: true` on `CreditEntry` plus a regression test.
- [ ] Ma1 fixed: daily-limit check inside the transaction, session-aware count, parallel boundary test.
- [ ] Minors 1–4 fixed or explicitly recorded as accepted gaps in STATUS; the rest may follow.
- [ ] Full typecheck/lint/test/build and browser E2E rerun on the rebased branch, with real output in the handoff.
- [ ] Handoff corrected (module-off behaviour) and STATUS row updated.
- [ ] T1 re-review of the delta (blockers and major only).
