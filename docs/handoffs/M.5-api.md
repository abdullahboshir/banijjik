# Handoff: card M.5 (Part A: API) · IMPLEMENT · 2026-10-22

- **Branch / commit:** `s/M.5-api-credit-purchases`
- **Session:** Part A (API) of Card M.5 (Tier T1: customer money and credits).
- **CI Run (Green):** [https://github.com/abdullahboshir/banijjik/actions/runs/39759796154](https://github.com/abdullahboshir/banijjik/actions/runs/39759796154) (verify in 11m28s, browser in 6m35s, secrets in 8s).
- **Deviations from Plan:** None.
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
    - Added i18n catalogs translations in `bn.json` and `en.json` for permissions and credit errors.
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
  - **Tests:**
    - `apps/api/src/modules/commerce/credit/presentation/credit-purchase-api.test.ts`:
      1. `happy path: submit -> staff verify -> credits granted once, ledger entry and events recorded`
      2. `duplicate reference: rejected if PENDING or VERIFIED, allowed after REJECTED, and parallel race test`
      3. `idempotent verify: verify twice returns identical response, parallel verify grants once`
      4. `limits and rules: maxPending, rate-limiting, pack snapshot, unconfigured method, and customer cancel`
      5. `staff rules: self-service guard (403), approval token required above threshold, and permissions`
      6. `expiry job: cancels expired pending purchases cleanly and idempotently`
      7. `module off: storefront and staff purchase routes are not available when credit module is disabled`
    - `apps/api/src/modules/commerce/credit/presentation/credit-api.test.ts` (20 tests passed)
    - `apps/api/src/modules/commerce/credit/domain/spend-allocation.test.ts` (7 tests passed)
    - `apps/api/src/modules/commerce/credit/application/use-cases/expire-credits.use-case.test.ts` (6 tests passed)
    - `apps/api/src/modules/commerce/credit/application/use-cases/credit-pack.use-cases.test.ts` (3 tests passed)
    - Full credit suite: 5/5 test files, 43/43 tests passed.
  - **Docs:**
    - Added ADR-132 to `docs/04-DECISIONS.md`.
    - Updated `docs/09-DOMAIN-MODEL.md` (CreditPurchase aggregate, state transitions, indexes, events).
    - Updated `docs/14-API.md` (Storefront and Tenant credit purchase endpoints, error codes).
    - Updated `apps/api/src/modules/commerce/credit/README.md`.
    - Updated `docs/STATUS.md` row for M.5.

- **Known Gaps:**
  - None for Part A. Part B (admin screens) is next.
  - Note for 3.7 session: `resource-exclusive-hold.schema.ts`-এ `organizationId`-তে `immutable: true` যোগ করতে হবে।

- **Next Step:**
  - Part B: Admin screens (`s/M.5-ui-credit-purchases`).
