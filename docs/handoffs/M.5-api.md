# Handoff: card M.5 (Part A: API) · IMPLEMENT · 2026-10-22

- **Branch / commit:** `s/M.5-api-credit-purchases`
- **Session:** Part A (API) of Card M.5 (Tier T1: customer money and credits).
- **Done:**
  - **Contracts & Validation (`packages/contracts`, `packages/validation`, `packages/ids`):**
    - Added `CreditPurchaseId` branded ID (`Id<"CreditPurchase">`).
    - Added `CREDIT_PURCHASE_METHOD` (`BKASH`, `NAGAD`), `CREDIT_PURCHASE_STATUS` (`PENDING`, `VERIFIED`, `REJECTED`, `CANCELLED`).
    - Added `SEQUENCE_KEY.CREDIT_PURCHASE` (sequence key for `CP-<n>`).
    - Added permissions `credit.purchase.read` and `credit.purchase.verify`. System roles updated (`OWNER` and `MANAGER` receive both, `STAFF` receives both below approval threshold).
    - Added `APPROVAL_ACTION.CREDIT_PURCHASE_VERIFY` with rule requiring amount coverage.
    - Added setting keys: `credit.payment.methods` (STRUCTURED spec, validated against `creditPaymentMethodsSettingSchema`), `credit.purchase.maxPending` (default 2), `credit.purchase.pendingDays` (default 3), `credit.purchase.approvalAbove` (MONEY setting, default 0 = off).
    - Added events: `credit.purchase.submitted`, `credit.purchase.verified`, `credit.purchase.rejected`, `credit.purchase.cancelled` (`orderingKey: creditAccount:<customerAccountId>`).
    - Added schemas: `submitCreditPurchaseSchema`, `verifyCreditPurchaseSchema`, `rejectCreditPurchaseSchema`, `listCreditPurchasesQuerySchema`, `creditPurchaseIdParamSchema`, `creditPaymentMethodsSettingSchema`.
  - **Credit Domain & Persistence (`apps/api/src/modules/commerce/credit`):**
    - `CreditPurchase` entity with immutable pack snapshot (`name`, `credits`, `price: Money`, `validityDays?`), method, sender phone (E.164), upper-cased reference, status lifecycle, timestamps, rejection reason, verifier, and linked `creditEntryId`.
    - Mongoose schema `credit-purchase.schema.ts` with compound unique partial index `(organizationId, method, transactionReference)` for PENDING and VERIFIED statuses.
    - `MongoCreditPurchaseRepository` with atomic `insert`, `findById`, `findByReference`, `countPendingByAccount`, `listPendingByAccount`, `listStaff`, `findExpiredPending`, and `updateVersioned`.
    - UnitOfWork transaction consistency and optimistic concurrency control (`version`).
  - **Use Cases & Business Rules:**
    - `SubmitCreditPurchaseUseCase`: validates active pack, configured payment method, active customer account, reference uniqueness, max pending limit per account; computes expiration date and generates atomic sequential purchase number `CP-<n>`; emits `credit.purchase.submitted` and records audit entry in transaction.
    - `VerifyCreditPurchaseUseCase`: self-service guard (staff cannot verify purchase if contact matches customer account's contact), approval token required if price > `approvalAbove` (consumed in transaction; OWNER exempt); transitions PENDING → VERIFIED; appends `PURCHASE` ledger entry (`source = { sourceType: "PURCHASE", sourceId: creditPurchaseId }`) with validity-derived `expiresOn`, updates guarded balance projection via `$inc`; emits `credit.purchase.verified` and `credit.entry.created` with ordering key `creditAccount:<customerAccountId>`; idempotent replay returns existing verified purchase without double credit grant.
    - `RejectCreditPurchaseUseCase`: self-service guard; transitions PENDING → REJECTED with rejection reason; emits `credit.purchase.rejected` and audits in transaction.
    - `CancelCreditPurchaseUseCase`: allows customer to cancel own PENDING purchase; transitions PENDING → CANCELLED; emits `credit.purchase.cancelled` and audits in transaction.
    - `CancelExpiredPurchasesUseCase`: batch-cancels PENDING purchases where `expiresAt <= now`; idempotent.
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
      - `POST /credit/purchases/:creditPurchaseId/verify` (`credit.purchase.verify`, `Idempotency-Key`)
      - `POST /credit/purchases/:creditPurchaseId/reject` (`credit.purchase.verify`, `Idempotency-Key`)
    - Scheduled Job: registered `cancel-expired-purchases` job via `registerCreditScheduledJobs`.
  - **Tests (`apps/api/src/modules/commerce/credit/presentation/credit-purchase-api.test.ts`):**
    - 7 comprehensive scenarios covering all plan requirements:
      1. Happy path: submit → staff verify → credit granted, balance up, ledger entry, outbox events, audit.
      2. Duplicate reference: 409 conflict on pending/verified, allowed after rejected, parallel race test.
      3. Idempotent verify: verify twice returns identical response, parallel verify grants once.
      4. Limits and rules: maxPending 422, pack price snapshot preserved, archived pack 422, unconfigured method 422, customer cancel.
      5. Staff rules: self-service guard 403, approval token required above threshold, invalid token 403, permissions, cross-org 404.
      6. Expiry job: cancels expired pending purchases cleanly and idempotently.
      7. Module off: storefront and staff purchase routes return 404/403.
    - Full suite: 5/5 credit test files (43/43 tests) pass cleanly.
  - **Docs:**
    - Added ADR-132 to `docs/04-DECISIONS.md`.
    - Updated `docs/09-DOMAIN-MODEL.md` (CreditPurchase aggregate, state transitions, indexes, events).
    - Updated `docs/14-API.md` (Storefront and Tenant credit purchase endpoints, error codes).
    - Updated `apps/api/src/modules/commerce/credit/README.md`.

- **Verified with:**
  - `npx eslint apps/api/src/modules/commerce/credit packages/contracts/src/credit packages/contracts/src/events packages/validation/src/credit apps/api/src/routes/credit-tenant-router.ts apps/api/src/routes/storefront.ts` → Exit 0 (0 errors, 0 warnings).
  - `npm --prefix apps/api test -- credit` → 5/5 test files, 43/43 tests passed.
  - `npm --prefix packages/ids test` → 2/2 test files, 14/14 tests passed.
  - `npm --prefix packages/contracts run build` → Exit 0.
  - `npm --prefix packages/validation test` → 26/26 test files, 252/252 tests passed.
  - `npx tsc -p apps/api/tsconfig.json --noEmit` → Zero errors in all M.5 files (uncommitted 3.7 enrollment files isolated).

- **Untouched 3.7 Files in Workspace (Reported separately):**
  - `apps/api/src/modules/commerce/booking/application/ports/resource-exclusive-holds.ts`
  - `apps/api/src/modules/commerce/booking/infrastructure/mongo-resource-exclusive-holds.ts`
  - `apps/api/src/modules/commerce/booking/infrastructure/resource-exclusive-hold.schema.ts`
  - `apps/api/src/modules/commerce/booking/infrastructure/register-booking-models.ts`
  - `apps/api/src/modules/commerce/booking/index.ts`
  - `apps/api/src/modules/commerce/enrollment/**`
  - `scripts/new-module/new-module.test.mjs`

- **Next Step:**
  - Part B: Admin screens (`s/M.5-ui-credit-purchases`).
