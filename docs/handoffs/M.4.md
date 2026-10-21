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
