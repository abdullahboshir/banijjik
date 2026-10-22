# Review R1: card M.5 Part A (branch `s/M.5-api-credit-purchases`, head `3a6ae6f`)

Reviewer: lead (Opus 5.5), strict T1. Result: **changes required, do not merge.** CI is green (run 39761614746), and the core is sound: the reference index, the version guard and the ledger writes share one transaction, the PURCHASE entry has a unique source, and the approval token is consumed in the same transaction. The items below must still be fixed first.

Fix every item, add the named tests, push, get CI green, update the handoff, and report the new run. Where a lead decision is given, follow it. If anything else is unclear, stop and ask.

## Blockers

1. **Staff search is an unescaped regex.** `listForStaff` puts `q` straight into `$regex` with `$options: "i"`. Any staff member can send a catastrophic pattern (for example `(a+)+$`, which fits in 100 characters), so this is a ReDoS on the database, and `.` or `*` change the meaning of the search.
   Fix: use `escapeRegExp` from `@banijjik/validation`, as `contact-filter.ts` and the catalog repositories do. Make it a prefix match (`^…`). Upper-case `q` for the reference (references are stored upper-cased), so the `i` option is not needed and the index can be used.
   Test: `q` = `(a+)+$` → 200 with no rows. `q` = a reference prefix → finds it.
2. **The purchase schema breaks the common-field rules.**
   (a) There is no unique index on `{ organizationId, creditPurchaseId }`. `domainIdField` says the caller declares it.
   (b) There is no unique index on `{ organizationId, purchaseNumber }`.
   (c) `auditFields` (`createdByUserId`, `updatedByUserId`) are missing (AGENTS.md: audit fields on every tenant document).
   Fix: add both unique indexes, `...auditFields`, and `...versionField`, as `credit-pack.schema.ts` does. Set `createdByUserId` to null for a customer submission, and `updatedByUserId` to the staff user on verify and reject. Record the new indexes in the README `db:sync-indexes` note.
3. **`updateVersioned` in the purchase repository swallows every error.** Any error except a duplicate key becomes `false`, and the use cases then throw `CreditPurchaseNotPendingError`. This hides infrastructure errors from the error capture. It also turns a transient transaction error (write conflict) into a 409 business error, so `withTransaction` never retries it.
   Fix: drop the `try/catch` and the boolean result. Let the kernel's `conflict` / `notFound` from `updateVersioned` propagate. A stale `version` on a PENDING purchase is then the standard 409 conflict, not "not pending". Keep the "not pending" error for a real status mismatch only.
   Test: verify with a stale version on a PENDING purchase → 409 with the conflict code.
4. **The customer submit is not idempotent.** `requiredIdempotencyKey` only checks that the header is there. When the 201 is lost and the client retries, the customer gets `409 errors.credit_reference_taken` for their own transfer and thinks someone else used it.
   **Lead decision:** replay by natural key. If the **same customer account** already has a PENDING or VERIFIED purchase with the same `method`, `transactionReference` and `creditPackId`, return that purchase (201, same body) and change nothing. Any other match (another account, or another pack) stays 409 and reveals nothing. Apply the same rule on the duplicate-key path after the pre-check, so the parallel case behaves the same.
   Tests: the same submit twice → two 201s with the same `creditPurchaseId` and one row. Another account with the same reference → 409, and the body has no purchase or account data.
5. **Plan tests that are missing.** The test names promise more than the bodies check. Add:
   - (a) **two parallel verifies** (`Promise.all`) → both 200, one PURCHASE entry, balance up once. Today only a sequential second verify is tested.
   - (b) the **per-hour limit** → 429 (11th submission from one account; the IP bucket separately if the harness allows).
   - (c) the **snapshot**: submit, then update the pack's credits and price, then verify → the grant uses the snapshot credits, and the response shows the old price.
   - (d) an **unconfigured method**: set `credit.payment.methods` to BKASH only, submit NAGAD → 422 `errors.credit_payment_method_not_configured` (or the code you defined). With the empty default → 422.
   - (e) an **approval token is single-use**: reuse the consumed token on another purchase above the threshold → 403 `APPROVAL_REQUIRED`. Also: a token for purchase A does not verify purchase B.
   - (f) **permission denied**: a member without `credit.purchase.verify` → 403 on verify and reject; one without `credit.purchase.read` → 403 on the list.
   - (g) a **customer session of another organization** → 401 on `/credit-purchases` and `/my/credit-purchases`.
   - (h) **no leak**: customer B's `/my/credit-purchases` does not contain A's purchase; B cancelling A's purchase → 404.

## Should fix (before merge)

6. **Type casts in the job wiring.** `registerCreditScheduledJobs` (in `index.ts`) and the expiry test build a partial object `as unknown as CreditDependencies`, and cast `kernelEventPublisher` through `unknown`. Give `CancelExpiredPurchasesUseCase` a narrow port, `Pick<CreditDependencies, "purchases" | "unitOfWork" | "audit" | "events">`, and build the event publisher once (the same function the routes use). Then no cast is needed.
7. **The expiry scan is unbounded.** `listExpiredPending` loads every expired row at once. Read it in keyset batches of 100, like `readPurchasePages` in the credit repository.
8. **The approval threshold ignores currency.** `resolveApprovalThreshold` keeps only `amount`. If the setting's currency is not the price currency, require approval (fail safe). Do not compare amounts across currencies.
9. **Validation message literal.** `transactionReferenceSchema` passes an English message. Drop it so the issue is the standard `invalid_format`, as `phoneE164Schema` does (no user-facing literals).
10. **Docs drift.** These must match the code and the plan:
    - ADR-132 and the handoff say the defaults are `maxPending` 2 and `pendingDays` 3. The code and the plan say 3 and 7.
    - ADR-132 names `errors.credit_purchase_self_service_forbidden`, but the code uses `errors.credit_self_verify_forbidden`.
    - The handoff says reject needs an `Idempotency-Key` (it does not), and that submit checks the account is active. The storefront auth does that; say so.
    - "Deviations: None" is not accurate: the expiry job runs hourly, not daily (fine, but write it down), and item 4 changes the idempotency behaviour.
    - The Bengali note to the 3.7 session does not belong in this handoff (docs are English, and it is not this card's). Remove it.
11. **Record as a known gap** in STATUS and the handoff: the `maxPending` check is not atomic. Parallel submissions from one account can exceed it by the number of concurrent requests. This is accepted because of the per-account rate limit.

## Checked and fine
- The reference uniqueness partial index and the 409 that reveals nothing; the reuse after REJECTED and CANCELLED.
- Verify: the pre-check and the re-read inside the transaction; `applyDelta`, `insertEntry` and the version-guarded update all in the session; `uniq_credit_entry_purchase` as the second guard against a double grant. No PURCHASE entries existed before, so the new partial unique index builds on existing data.
- The approval token is consumed inside the transaction (bound to the action, subject and amount), and OWNER is exempt.
- The self-service guard on verify and reject; cross-org 404 on the staff detail.
- The STAFF grants match decision 6. The module-off test covers the storefront routes (the M.4 B1 lesson).
- The diff contains no booking or enrollment file.
