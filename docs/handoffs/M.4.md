# Handoff: card M.4 · IMPLEMENT · 2026-10-21

- **Branch / commit:** `s/m4-credits` @ `522b9bc` in worktree `E:\WEB-DEVELOPMENT\PROJECTS\business-platform\banijjik-m2` (based on `main` `8258669`). Not merged/pushed.
- **Model:** Cursor (Composer), finished with Qoder.
- **Done:**
  - OPTIONAL module `commerce/credit` (`MODULE_KEY.CREDIT`, `dependsOn: [directory]`, `tenantCanDisable: true`) with its manifest: routes, menu, settings, events; grants OWNER/MANAGER all, STAFF `credit.account.read` + `credit.pack.read`.
  - **Packs:** entity, Mongo repository, tenant CRUD (`POST /credit/packs`, `PATCH /credit/packs/{creditPackId}`, `POST /credit/packs/{creditPackId}/archive`) under `credit.pack.{read,update}`; public `GET /storefront/orgs/{organizationId}/credit-packs` returns ACTIVE packs only.
  - **Ledger:** append-only `CreditEntry` (PURCHASE/SPEND/REFUND/EXPIRE/ADJUST); `CreditBalance` projection changed by a guarded atomic `$inc` in the same transaction, so it equals the sum of entries and never goes negative; SPEND rows allocate FIFO unexpired purchases first and record `fromPurchaseEntryId`.
  - **Unlocks:** `POST /storefront/orgs/{organizationId}/listings/{listingNumber}/unlock` requires a UUID `Idempotency-Key`; cost and daily cap come from the settings reader (`credit.unlockCost` default 1, `credit.unlocksPerDay` default 20); per-IP and per-account rate limits; own listing → 400, non-approved/unknown → 404, short balance → 422, daily cap → 429; a repeat or parallel duplicate returns the existing unlock with `creditsSpent: 0`.
  - **Customer reads:** `GET /my/credits` (balance + paged entries) and `GET /my/unlocks` (unlocked listings with their UNLOCKED fields, paged).
  - **Staff:** `GET /credit/accounts/{customerAccountId}`; `POST …/adjust` is audited and requires an `APPROVAL_ACTION.CREDIT_ADJUSTMENT` token consumed in the transaction unless the actor is the OWNER.
  - **Directory:** `ListingUnlockReader` and `ListingUnlockCounter` ports adapted in routes (directory never imports credit); viewer `UNLOCKED_MEMBER` only for the unlocking account; `GET /directory/listings/{listingId}/unlock-count` returns a count only; with the credit module off, UNLOCKED fields stay hidden and the credit routes are absent.
  - **Expiry:** `ExpireCreditsUseCase` writes one EXPIRE per expired purchase remainder, idempotent through the partial unique index on `(organizationId, source.sourceId)` for EXPIRE rows. No scheduler in this card (the 3.6 job must call it per organization).
  - **Admin:** `/credit/packs` screen (menu `credit.packs`, SALES topic, `coins` icon) with create/edit/archive; contact detail "Credits" section (balance, history, adjustment; approval dialog and location for non-owners) shown only when the module is on and the caller holds the keys; BN/EN keys.
  - **Docs:** ADR-130 Accepted (proposed), `09` entities 5.2c, `14` storefront/tenant rows and error codes, module README; `16` verified consistent, unchanged.
  - **Tests:** `credit-api.test.ts` (12 scenarios: pack read/write + permissions, ledger + idempotent unlock, 5 parallel unlocks with balance 3 → exactly 3, parallel duplicate charges once, settings cost + daily limit, own listing, non-approved/unknown, missing Idempotency-Key, projection + privacy, module off, approval consumption, STAFF denial/negative balance, cross-org + cross-org token), `spend-allocation.test.ts`, `expire-credits.use-case.test.ts`, `credit-pack.use-cases.test.ts`, admin `packs-manager.test.tsx`, `contact-credits.test.tsx`, `credit-form.test.ts`, browser `credit-screens.browser.test.ts` (create a pack, adjust a contact's credits as OWNER).
- **Verified with** (2026-10-21, run in this worktree):
  - `npm run lint` → exit 0; `npm run format:check` → "All matched files use Prettier code style!"
  - `npm run typecheck` → **16/16 successful** (9 cached)
  - `npm run build -- --force` → **9/9 successful**
  - Tests (turbo `--force`): **206 files / 1627 passed** — admin 547, ui 230, validation 244, platform 123, web-client 97, contracts 74, lint-tests 274, i18n 24, ids 14
  - Tests (`@banijjik/api`, `--maxWorkers=2`): **223 files / 1943 passed, 1 skipped**
  - Browser: `credit-screens.browser.test.ts` → **1 file / 1 test passed** (creates a pack and adjusts a contact's credits as the OWNER, 1808 ms)
  - Environment note: a single `npm test -- --force` with default worker fan-out is not reliable on this machine. One run hit a stale-data disk fill (C: at 447 MB free; Mongo refused writes, workers died with access violation) and two load-sensitive tests timed out. After removing 17 stale `%TEMP%\mongo-mem-*` dirs (4.2 GB, left by the crashed runs) the API suite passed cleanly with two workers; the other workspaces were verified by the concurrency-2 turbo run.
- **Not done / known gaps:**
  - Opus T1 **REVIEW** not run (required before merge).
  - Expiry has no scheduler; wire `ExpireCreditsUseCase` into the 3.6 jobs.
  - `credit.showUnlockersToOwner` is declared (default false) but this card exposes counts only; no endpoint lists who unlocked.
  - Paying for packs and accounting postings are M.5; the public site screens are M.6.
- **Deviations from plan (and why):**
  - The browser test seeds `directory` and `credit` module overrides, adds both to every `industry_templates.allowedModuleKeys`, and bumps `organizations.configVersion`, because `resolveModules` intersects overrides with the template allow-list and no template enables credit until M.8. Test setup only; product behaviour unchanged.
  - Added `platform.module.credit` to both platform catalogs; the catalog-coverage test requires a label for every registered module key.
  - EXPIRE idempotency uses `source.sourceId = purchaseEntryId` plus a partial unique index rather than a separate marker collection.
  - Directory asks for unlock counts through the extra `ListingUnlockCounter` port (the plan named only the reader).
  - New-module generator test updated for the credit module alias.
- **Decisions made:** ADR-130 Accepted (proposed) as planned; unlock defaults 1 credit and 20 per day; no product decisions beyond the plan.
- **Notes for the next session:**
  1. Run the mandatory **T1 REVIEW** (Opus) against this branch, fix findings, then merge.
  2. Browser test prerequisites: built API/admin, `CHROME_PATH` set, Redis on `redis://127.0.0.1:6380`; command: `CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" npm run test:browser -w @banijjik/admin -- src/credit/credit-screens.browser.test.ts`.
  3. M.5 should create PURCHASE entries and listen to `credit.entry.created` (`orderingKey: creditAccount:<customerAccountId>`) for accounting.
  4. M.6 needs the storefront screens for `/credit-packs`, unlock, `/my/credits` and `/my/unlocks`.
- **Next suggested card / pair:** M.4 REVIEW → merge; then M.5 (manual payment verification) or M.3 (already planned)

## Review-fix session (2026-10-21, Codex)

This delta addresses review B1/B2/Ma1; the earlier PASS WITH FIXES heading is not approval of the delta. The named-model independent T1 re-review remains required.

- All four credit storefront routes check effective module status before authentication/use cases; disabling credit returns 404 and preserves balance, ledger and unlock rows. Directory/contact routes retain their own gates.
- CreditEntry registration now applies the kernel append-only plugin. Compiled-model update, replace and delete regression tests exercise its refusal.
- Unlock transactions first write the existing account balance (zero delta increments its version), then re-read an existing unlock and the daily count with the active session. Mongo write conflicts serialize different listings per account across instances; callback retries obtain a fresh snapshot. The debit, spend entries, unlock and outbox remain in one transaction. Duplicate unlocks at the cap and zero remaining balance still return the existing unlock.
- A single clock value supplies the unlock/spend timestamps. A missing spend entry throws before an unlock can persist. API validation rejects zero adjustments.
- Purchase/expiry reads keyset-page in batches of 100 by occurredAt/creditEntryId, including tied timestamps; a 1001-row regression covers the removed truncation. Consumption includes EXPIRE as well as SPEND, preventing already-expired purchases from receiving later spend attribution.
- Expiry locks the account before reading consumption within the transaction, so concurrent spending cannot leave a stale expiry amount. Tests cover concurrent real expiry transactions, ledger/balance reconciliation and event-persistence rollback/retry.
- Packs persist the creating actor, reads use lean(), and the public ACTIVE pack list is bounded to the first 100 in sort order (test covers 101 records).

Deployment: additive purchase keyset indexes require the existing ADR-094 db:sync-indexes procedure before rollout. No destructive migration or queued payload change. Existing credit records retain their shape; EXPIRE attribution is already stored on fromPurchaseEntryId. Rolling back application code retains indexes and ledger rows; never rewrite financial history. No deployment was performed.

Remaining review polish: duplicate/dead repository methods (minor 7), context-only pack repository signatures (minor 9), and shared dependency assembly (minor 10) remain unchanged. Invalid-setting fallback and second-page customer endpoint coverage remain follow-up test gaps. No new product decision or architectural ADR was introduced. Production latency/query-plan measurement on realistic growing tenant data remains outstanding; the paging regression is correctness evidence, not a performance claim. Expiry scheduler integration remains deferred to 3.6.

Verification of this delta completed on 2026-10-22. Earlier runs above describe the original implementation, not this delta. Heavy commands use the shared Local\BanijjikHeavyVerification mutex, serial turbo tasks and bounded test workers. Dependency builds passed (6/6 uncached). First typecheck caught a now-fixed import conflict; second failed with Node native Zone Allocation out-of-memory (exit 134). Final results will be recorded below.

### Delta verification (2026-10-22)

- `npm run typecheck -- --force --concurrency=1`: **16/16 successful, 0 cached** on the final source, exit 0.
- `npm run lint -- --no-cache`: **exit 0** on the final source. Required 4096 MB Node heap; a 1024 MB heap exhausted during whole-repo typed lint. Earlier lint findings (two fixture layer imports and a 61-line router builder) were corrected without disabling rules.
- `npm run format:check`: **All matched files use Prettier code style!**, exit 0.
- `npm test -w @banijjik/api -- src/modules/commerce/credit --maxWorkers=1`: **4 files, 36 tests passed**, exit 0 (42.09 s). Real MongoDB 8.0.13 replica set; includes 1001 tied-timestamp purchases and a direct duplicate EXPIRE insert rejected by the partial unique index. Transaction/rollback regression coverage is local correctness evidence; it is not a production latency or growth benchmark.
- Complete uncached tests, build and mobile credit browser scenario: passed; results follow below. Logs are outside the repository in `%TEMP%/banijjik-m4-full-tests-20261022.log` and `%TEMP%/banijjik-m4-full-build-20261022.log`.
- Prefer forward recovery to application rollback: running the old version reintroduces the reviewed defects even though records/indexes remain compatible. No ledger history should be rewritten.

- `npm test -- --force --concurrency=1 -- --maxWorkers=1` with Redis `127.0.0.1:6380`: **16/16 tasks successful, 0 cached**; **429 files / 3577 tests passed, 1 skipped**, exit 0 (17m19.814s). API 223 files / 1950 passed + 1 skipped; admin 547, platform 123, UI 230, validation 244, web-client 97, contracts 74, lint fixtures 274, i18n 24, IDs 14. The skip is the existing Windows-only SIGTERM spawn test in `apps/api/src/main.test.ts`; it was not newly disabled.
- `npm run build -- --force --concurrency=1`: **9/9 successful, 0 cached**, exit 0 (1m6.199s).
- First final browser attempt failed before exercising the scenario: another active `banijjik-1.7b` browser stack occupied port 3101, and the setup reached that stack rather than its newly created replica set (`No business with slug acme`). Its follow-on platform browser suite then held port 4000. No other session was stopped or modified. Retry awaits release of both fixed harness ports; application/test source was not changed to hide the failure.

- Browser retry after the competing suite released ports: `CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" npm run test:browser -w @banijjik/admin -- src/credit/credit-screens.browser.test.ts --maxWorkers=1`: **1 file / 1 test passed**, exit 0. Exercises creating a pack and adjusting a contact's credits as OWNER at the existing phone viewport. All required automated checks for this fix session passed; the separate named-model independent T1 re-review of the delta is still required before merge. No merge, push or deployment was performed.
