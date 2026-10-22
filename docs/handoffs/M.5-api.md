# Handoff: card M.5 (Part A: API) · IMPLEMENT · 2026-10-23

- **Branch / commit:** `s/M.5-api-credit-purchases`
- **Session:** Part A (API) of Card M.5 (Tier T1: customer money and credits).
- **CI Run (Green):** [https://github.com/abdullahboshir/banijjik/actions/runs/39759796154](https://github.com/abdullahboshir/banijjik/actions/runs/39759796154).
- **Deviations from Plan:**
  - Scheduled expiry job runs hourly, not daily (to match expiration window resolution).
  - Natural-key idempotency on `POST /credit-purchases` (Decision 4): Replay returns existing PENDING or VERIFIED purchase with 201 for the same customer account, credit pack, method, and reference, writing no duplicate entries or events.
- **Review R1 Resolution (Items 1-11):**
  - Item 1: Replaced unescaped regex in staff search with prefix regex using `escapeRegExp` on upper-cased query without "i" option. Proved by tests in `credit-purchase-rules-api.test.ts` (`treats a catastrophic regex as plain text: 200 with no rows`, `finds a purchase by a reference prefix, in any letter case`).
  - Item 2: Restored expiry index, added unique indexes on `{ organizationId, creditPurchaseId }` and `{ organizationId, purchaseNumber }`, included `...auditFields` and `...versionField` in schema, tracked staff `updatedByUserId` on verify/reject, set `createdByUserId` null on customer submit, and recorded indexes in README note.
  - Item 3: Removed swallow-all try/catch from repository `updateVersioned`, updated port to `Promise<void>`, threw `CreditPurchaseVersionConflictError` (409) for stale version on PENDING purchase in verify and reject. Proved by `verify with a stale version on a PENDING purchase is the standard 409 conflict` and `reject with a stale version on a PENDING purchase is the standard 409 conflict`.
  - Item 4: Implemented natural-key replay pre-check and race catch in `SubmitCreditPurchaseUseCase` before sequence number allocation, returning 201 with existing purchase if same account, pack, method, and reference match. Proved by `the same submit twice returns two 201s with one purchase and one row` and `another account with the same reference gets 409 and no purchase or account data`.
  - Item 5 (a-h): Added integration tests covering parallel verify (5a), hourly rate-limiting (5b), pack snapshot stability (5c), unconfigured/empty payment methods (5d), approval token single-use & purchase-binding (5e), missing permissions 403 (5f), cross-org customer 401 (5g), and cross-customer data isolation / 404 on cancel (5h).
  - Item 6: Narrowed `CancelExpiredPurchasesUseCase` dependencies to `CancelExpiredPurchasesDependencies` (`Pick<CreditDependencies, "purchases" | "unitOfWork" | "audit" | "events">`), removed type casts in job wiring, and extracted shared `buildCreditEventPublisher`.
  - Item 7: Refactored `listExpiredPending` in `MongoCreditPurchaseRepository` to paginate using keyset cursor in 100-document batches.
  - Item 8: Updated `resolveApprovalThreshold` and `exceedsThreshold` in `VerifyCreditPurchaseUseCase` to require approval token (`ERROR_CODE.APPROVAL_REQUIRED`) if setting currency does not match purchase currency.
  - Item 9: Dropped custom English message string from `transactionReferenceSchema` in `credit-schemas.ts` to emit standard `invalid_format`. Proved by `credit-schemas.test.ts` (`reports the standard invalid_format issue, not a custom English message`).
  - Item 10: Updated ADR-132 in `docs/04-DECISIONS.md` and handoff with actual defaults (`maxPending = 3`, `pendingDays = 7`), corrected self-verify error code name, fixed `Idempotency-Key` statements, noted storefront auth, removed Bengali note, and updated repository method names.
  - Item 11: Recorded known gap in STATUS and handoff regarding non-atomic `maxPending` check bounded by per-account rate limit.
- **Done:**
  - **Contracts & Validation (`packages/contracts`, `packages/validation`, `packages/ids`):**
    - Added `CreditPurchaseId` branded ID (`Id<"CreditPurchase">`).
    - Added `CREDIT_PURCHASE_METHOD` (`BKASH`, `NAGAD`), `CREDIT_PURCHASE_STATUS` (`PENDING`, `VERIFIED`, `REJECTED`, `CANCELLED`).
    - Added `SEQUENCE_KEY.CREDIT_PURCHASE` (sequence key for `CP-<n>`).
    - Added permissions `credit.purchase.read` and `credit.purchase.verify`. System roles updated (`OWNER` and `MANAGER` receive both, `STAFF` receives both below approval threshold).
    - Added `APPROVAL_ACTION.CREDIT_PURCHASE_VERIFY` with rule requiring amount coverage.
    - Added setting keys: `credit.payment.methods` (STRUCTURED spec, validated against `creditPaymentMethodsSettingSchema`), `credit.purchase.maxPending` (default 3), `credit.purchase.pendingDays` (default 7), `credit.purchase.approvalAbove` (MONEY setting, default 0 = off).
    - Added events: `credit.purchase.submitted`, `credit.purchase.verified`, `credit.purchase.rejected`, `credit.purchase.cancelled` (`orderingKey: creditAccount:<customerAccountId>`).
    - Added schemas: `creditPurchaseSubmitRequestSchema`, `creditPurchaseVerifyRequestSchema`, `creditPurchaseRejectRequestSchema`, `creditPurchasesStaffQuerySchema`, `creditPurchaseIdParamsSchema`, `creditPaymentMethodsSettingSchema`.
    - Removed custom English string literal from `transactionReferenceSchema` so invalid formats trigger the generic `invalid_format` issue.
    - Added i18n catalogs translations in `bn.json` and `en.json` for permissions and credit errors.
  - **Credit Domain & Persistence (`apps/api/src/modules/commerce/credit`):**
    - `CreditPurchase` entity with immutable pack snapshot (`name`, `credits`, `price: Money`, `validityDays?`), method, sender phone (E.164), upper-cased reference, status lifecycle, timestamps, rejection reason, verifier, and linked `creditEntryId`.
    - Mongoose schema `credit-purchase.schema.ts` with compound unique partial index `(organizationId, method, transactionReference)` for PENDING and VERIFIED statuses, unique index on `{ organizationId, creditPurchaseId }`, unique index on `{ organizationId, purchaseNumber }`, expiry index on `{ organizationId, status, expiresAt }`, and spread `...auditFields, ...versionField`. Customer submissions set `createdByUserId` to null; verify and reject set `updatedByUserId` to the acting staff user.
    - `MongoCreditPurchaseRepository` with atomic `insert`, `findById`, `findByReference`, `countPendingByAccount`, `listByAccount`, `listForStaff`, `listExpiredPending` (keyset-batched by 100), and `updateVersioned` (returns `Promise<void>`, throws standard conflict/notFound on concurrency failure). Staff search escapes regex inputs via `escapeRegExp` and executes a prefix match without case-insensitive flag.
    - UnitOfWork transaction consistency and optimistic concurrency control (`version`).
  - **Use Cases & Business Rules:**
    - `SubmitCreditPurchaseUseCase`: natural-key replay pre-check and duplicate-key path catch; validates active pack, configured payment method, reference uniqueness, max pending limit per account (storefront authentication ensures account is active); computes expiration date and generates atomic sequential purchase number `CP-<n>`; emits `credit.purchase.submitted` and records audit entry in transaction.
    - `VerifyCreditPurchaseUseCase`: self-service guard (staff cannot verify purchase if contact matches customer account's contact, throwing `errors.credit_self_verify_forbidden`), approval token required if price > `approvalAbove` or if currency does not match setting currency (fails safe; consumed in transaction; OWNER exempt); handles version conflicts via `CreditPurchaseVersionConflictError` (409); transitions PENDING → VERIFIED; appends `PURCHASE` ledger entry (`source = { sourceType: "PURCHASE", sourceId: creditPurchaseId }`) with validity-derived `expiresOn`, updates guarded balance projection via `$inc`; emits `credit.purchase.verified` and `credit.entry.created` with ordering key `creditAccount:<customerAccountId>`; idempotent replay returns existing verified purchase without double credit grant.
    - `RejectCreditPurchaseUseCase`: self-service guard; handles version conflicts via `CreditPurchaseVersionConflictError` (409); transitions PENDING → REJECTED with rejection reason; emits `credit.purchase.rejected` and audits in transaction.
    - `CancelCreditPurchaseUseCase`: allows customer to cancel own PENDING purchase; transitions PENDING → CANCELLED; emits `credit.purchase.cancelled` and audits in transaction.
    - `CancelExpiredPurchasesUseCase`: batch-cancels PENDING purchases where `expiresAt <= now`; resilient to concurrent verification races (skips raced rows on conflict); narrow dependencies `Pick<CreditDependencies, "purchases" | "unitOfWork" | "audit" | "events">`.
    - `ListCreditPurchasesStaffUseCase` and `GetCreditPurchaseStaffUseCase`: staff read operations under `credit.purchase.read`.
    - `ListMyCreditPurchasesUseCase` and `GetCreditPaymentInfoUseCase`: customer-facing reads under storefront router.
  - **API Routing:**
    - Storefront surface (`/api/v1/storefront/orgs/:organizationId`):
      - `GET /credit/payment-info`
      - `POST /credit-purchases` (requires `Idempotency-Key`, customer auth, rate limit)
      - `GET /my/credit-purchases` (customer auth)
      - `POST /credit-purchases/:creditPurchaseId/cancel` (customer auth)
    - Tenant surface (`/api/v1/orgs/:organizationId/credit`):
      - `GET /credit/purchases` (`credit.purchase.read`)
      - `GET /credit/purchases/:creditPurchaseId` (`credit.purchase.read`)
      - `POST /credit/purchases/:creditPurchaseId/verify` (`credit.purchase.verify`, `Idempotency-Key` required)
      - `POST /credit/purchases/:creditPurchaseId/reject` (`credit.purchase.verify`)
    - Scheduled Job: registered `cancel-expired-purchases` job via `registerCreditScheduledJobs` using shared `buildCreditEventPublisher`.
  - **Tests:**
    - `apps/api/src/modules/commerce/credit/presentation/credit-purchase-api.test.ts`:
      1. `happy path: submit -> staff verify -> credits granted once, ledger entry and events recorded`
      2. `duplicate reference: own retry replays, another account gets 409, allowed after REJECTED, parallel retry replays`
      3. `idempotent verify: verify twice returns identical response, parallel verify grants once`
      4. `limits and rules: maxPending, rate-limiting, pack snapshot, unconfigured method, and customer cancel`
      5. `staff rules: self-service guard (403), approval token required above threshold, and permissions`
      6. `expiry job: cancels expired pending purchases cleanly and idempotently`
      7. `module off: storefront and staff purchase routes are not available when credit module is disabled`
    - `apps/api/src/modules/commerce/credit/presentation/credit-purchase-rules-api.test.ts`:
      1. `treats a catastrophic regex as plain text: 200 with no rows` (R1 item 1)
      2. `does not let '.' or '*' widen the search` (R1 item 1)
      3. `finds a purchase by a reference prefix, in any letter case` (R1 item 1)
      4. `verify with a stale version on a PENDING purchase is the standard 409 conflict` (R1 item 3)
      5. `reject with a stale version on a PENDING purchase is the standard 409 conflict` (R1 item 3)
      6. `the same submit twice returns two 201s with one purchase and one row` (R1 item 4)
      7. `another account with the same reference gets 409 and no purchase or account data` (R1 item 4)
      8. `the same account with another pack and the same reference stays 409` (R1 item 4)
      9. `(a) two parallel verifies both answer 200 and the balance rises once` (R1 item 5a)
      10. `(b) the 11th submission from one account in an hour is 429` (R1 item 5b)
      11. `(c) the grant uses the pack snapshot, not the pack as it is edited later` (R1 item 5c)
      12. `(d) a method that is not configured is 422, also with the empty default` (R1 item 5d)
      13. `(e) an approval token is single-use and bound to its purchase` (R1 item 5e)
      14. `(f) a member without the credit purchase permissions is 403 on verify, reject and list` (R1 item 5f)
      15. `(g) a customer session of another organization is 401 on both purchase routes` (R1 item 5g)
      16. `(h) one customer never sees or cancels another customer's purchase` (R1 item 5h)
    - `apps/api/src/modules/commerce/credit/application/use-cases/cancel-expired-purchases.use-case.test.ts`:
      1. `cancels every expired PENDING purchase`
      2. `skips a purchase that staff verified after the job listed it, and keeps going`
      3. `treats a conflict on one row as skip-this-row and cancels the others`
      4. `does not hide an infrastructure error`
    - `apps/api/src/modules/commerce/credit/presentation/credit-api.test.ts` (20 tests passed)
    - `apps/api/src/modules/commerce/credit/domain/spend-allocation.test.ts` (7 tests passed)
    - `apps/api/src/modules/commerce/credit/application/use-cases/expire-credits.use-case.test.ts` (6 tests passed)
    - `apps/api/src/modules/commerce/credit/application/use-cases/credit-pack.use-cases.test.ts` (3 tests passed)
    - `packages/validation/src/credit/credit-schemas.test.ts` (7 tests passed)
  - **Docs:**
    - Updated ADR-132 in `docs/04-DECISIONS.md`.
    - Updated `docs/09-DOMAIN-MODEL.md` (CreditPurchase aggregate, state transitions, indexes, events).
    - Updated `docs/14-API.md` (Storefront and Tenant credit purchase endpoints, error codes).
    - Updated `apps/api/src/modules/commerce/credit/README.md`.
    - Updated `docs/STATUS.md` row for M.5.

- **Known Gaps:**
  - Known gap: the credit.purchase.maxPending check is not atomic; concurrent submissions from one account can exceed it by the number of parallel requests. Accepted: the per-account limit of 10 submissions per hour bounds it.

- **Next Step:**
  - Part B: Admin screens (`s/M.5-ui-credit-purchases`).
