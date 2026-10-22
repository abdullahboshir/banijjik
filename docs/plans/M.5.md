# Plan: card M.5 · Credit pack purchase with manual payment verification

Tier: **T1** (customer money and credits) · Planned by: Opus 5.5 (Claude) · Implemented by: Cursor or a Claude Code session · Date: 2026-10-22 · Based on commit: `main 9016a0f` plus M.4 once merged

Track M (`docs/16-MATRIMONY-TRACK.md` §3.3), fifth card. **Start after M.4 is merged** (credit packs and the credit ledger). It does **not** need 3.8: it records the customer's transfer itself and grants credits on staff verification. When 3.8 (payments) exists, a later small card links a verified purchase to a `Payment` for accounting; until then the sale is recorded here only. Reserved ADR number: **ADR-132**.

## Session parts
Two sessions, as `docs/plans/parallel-sessions-guide.md` §3 says:
- **Part A, API** (branch `s/M.5-api-credit-purchases`, T1 review): decisions 1–6, 8 and 9 (records); every test except the **Admin** one; every file except `apps/admin`.
- **Part B, screens** (branch `s/M.5-ui-credit-purchases`, merge check; **starts after Part A is merged**): decision 7 and the **Admin** tests; files `apps/admin/src/credit/**`, `packages/i18n` (add-only) and its own handoff. No API change: a missing read means stop and ask.

## Goal
A customer buys a credit pack the way most Bangladeshi sites do:
1. picks a pack
2. sends money to the business's bKash or Nagad number
3. enters the sender number and the transaction id
4. waits

Staff see the pending purchases, check the transaction in their own bKash/Nagad app, and verify or reject it. On verify, the credits are granted. One transaction id can never be used twice.

## Inputs read
- `docs/16-MATRIMONY-TRACK.md` §3.2, §3.3, §3.5; `docs/plans/M.4.md` and its handoff (packs, `CreditEntry`, grant path, `credit.*` permissions, the review report `M.4-review.md`)
- ADR-013, ADR-014, ADR-090, ADR-115, ADR-119, ADR-121, ADR-130
- `11 §7.1` (manual mobile-money verification: unique reference per method)
- Code: `commerce/credit` (ledger, `grantCredits` use case, packs), `commerce/contact` customer accounts and `authenticateCustomer`, `kernel/rate-limit`, `kernel/events`, `kernel/sequence`

## Decisions
1. **CreditPurchase** (in `commerce/credit`, organization scope, versioned, audit fields):
   - `creditPurchaseId`
   - `purchaseNumber` (sequence `CREDIT_PURCHASE`, shown as `CP-<n>`)
   - `customerAccountId`
   - `creditPackId` and a **snapshot** `{ name, credits, price: Money, validityDays? }`
   - `method` (`BKASH | NAGAD`)
   - `senderPhoneE164`, `transactionReference` (trimmed, upper-cased, 6 to 30 letters and digits)
   - `status` (`PENDING | VERIFIED | REJECTED | CANCELLED`)
   - `verifiedByUserId?`, `verifiedAt?`, `rejectionReason?`, `creditEntryId?`
   - `submittedAt`, `expiresAt` (a PENDING purchase older than `credit.purchase.pendingDays`, default 7, becomes CANCELLED by a daily job)

2. **No duplicate transfer:**
   - a unique partial index on `(organizationId, method, transactionReference)` for statuses PENDING and VERIFIED
   - a second submission with a reference in use → `409 errors.credit_reference_taken` (without revealing whose)
   - a REJECTED or CANCELLED reference may be used again, but only by creating a new purchase

3. **Customer endpoints** (storefront surface, signed in, module `credit` on):

   | Endpoint | Notes |
   |---|---|
   | `GET /credit/payment-info` | the business's accepted methods and numbers, from a new setting `credit.payment.methods` (STRUCTURED: `[{ method, accountNumber, accountType, instructions: { bn, en } }]`, at least one for purchases to be possible) |
   | `POST /credit-purchases` | `Idempotency-Key`; body `{ creditPackId, method, senderPhone, transactionReference }`; the pack must be ACTIVE; the method must be configured; at most `credit.purchase.maxPending` (default 3) PENDING purchases per account; limit per IP and per account (10 per hour) |
   | `GET /my/credit-purchases` | own purchases with status, paged |
   | `POST /credit-purchases/{creditPurchaseId}/cancel` | own PENDING purchase only |

   The price is the pack's price at submission (snapshot); the customer is never asked to type an amount.

4. **Staff endpoints** (tenant pipeline, permissions `credit.purchase.read` and `credit.purchase.verify`, new):
   - `GET /credit/purchases?status=&q=&page&limit` (oldest PENDING first; `q` = reference or purchase number)
   - `GET /credit/purchases/{creditPurchaseId}`
   - `POST …/verify { version }` (`Idempotency-Key`): in one transaction, PENDING → VERIFIED, then **grant the credits through M.4's grant path** (PURCHASE entry with `expiresOn` from the validity, source = this purchase), audited, with the events `credit.purchase.verified` and `credit.entry.created` (ordering key `creditAccount:<customerAccountId>`). A second verify of the same purchase changes nothing and returns it (no double grant: the PURCHASE entry's source is unique, the M.4 pattern).
   - `POST …/reject { version, reason }` (reason from a short list or free text ≤ 200): PENDING → REJECTED; the customer is notified through the notification events of M.8.
   - **Self-service guard:** a staff member cannot verify a purchase that belongs to their own customer account (the account's contact is the staff member's contact) → 403.
   - **Approval:** verifying a purchase above `credit.purchase.approvalAbove` (MONEY setting, default 0 = off) needs an approval token (3.4b, a new action `CREDIT_PURCHASE_VERIFY`) unless OWNER. Verifying is the moment the business takes the customer's money into credits, so large amounts get a second pair of eyes.

5. **Never silently re-grant:** an UNDO is not offered. A wrongly verified purchase is fixed by a staff ADJUST (−credits, reason) with approval, as in M.4.

6. **Grants:** OWNER and MANAGER all; STAFF `credit.purchase.read` and `credit.purchase.verify` below the approval limit; others none.

7. **Admin screens** (`apps/admin`):
   - **Credit purchases** (menu group `sales`, label from term `credit`): queue of PENDING purchases (reference, sender phone, amount, pack, age), a detail sheet with verify and reject (reason chips), filters, search by reference. Copy buttons for the reference and amount make checking in the bKash app fast.
   - **Payment methods setting:** a section on the credit packs page to edit the numbers and instructions shown to customers.
   - ≤ 170 KiB per route, mobile cards.

8. **Accounting:** none in this card. The verified purchase is a sale of credits (a liability until spent); the posting rules come with the 3.8 link card. Record this in STATUS and ADR-132 so nobody assumes the books include it.

9. **Records:**
   - ADR-132 ("Accepted (proposed)"): purchase entity and snapshot, the reference-uniqueness rule, idempotent verify with the unique PURCHASE source, the self-service guard, the approval threshold, what is deliberately not posted yet
   - `09`, doc 16 §3.3 notes, `14` rows, the module README, STATUS row M.5

## Files
| Path | Change |
|---|---|
| `packages/contracts` (`@banijjik/contracts/credit` additions: purchase types and statuses, permission keys, events, sequence key, setting keys, rule and message keys, `APPROVAL_ACTION.CREDIT_PURCHASE_VERIFY`) | add-only |
| `packages/validation/src/credit/**` | change |
| `apps/api/src/modules/commerce/credit/**` (purchase entity, repository and indexes, use cases, customer and staff routers, expiry job) | change |
| `apps/api/src/routes/*` (job registration), `system-role-grants.ts` | add-only |
| `apps/admin/src/credit/**` | change, create |
| `packages/i18n` | add-only |
| `docs/04-DECISIONS.md` (ADR-132), `docs/09`, `docs/14`, `docs/handoffs/M.5.md`, `docs/STATUS.md` | |

## Tests (must exist and pass)
- [ ] **Happy path:** submit → staff verify → credits granted exactly once, balance up, the ledger entry points at the purchase, events emitted.
- [ ] **Duplicate reference:** a second PENDING or VERIFIED with the same method and reference → 409; after REJECTED, the reference can be used again; two parallel submissions with one reference → one 201, one 409.
- [ ] **Idempotent verify:** verify twice, and two parallel verifies → one grant.
- [ ] **Limits:** more than `maxPending` → 422; per-hour limit → 429; the pack price is the snapshot even if the pack changes later; an ARCHIVED pack or an unconfigured method → 422.
- [ ] **Staff rules:** the self-service guard (403); an approval token above the threshold (single-use); permission denied; cross-org 404; a customer token of another organization → 401.
- [ ] **Expiry job** (run twice): old PENDING → CANCELLED, nothing else changes.
- [ ] **Module off** (`credit`): all customer and staff routes absent (the B1 lesson of the M.4 review: test the storefront routes too).
- [ ] **No leak:** a customer sees only their own purchases; the 409 does not reveal other customers.
- [ ] **Admin:** unit tests for the queue and the verify/reject flow; browser: a customer submits through the API in setup, staff verifies, the balance shows on the contact page.
- [ ] Every existing suite green; full "Done means" list.

## Out of scope
- Online gateway payment (card 5.17)
- Accounting postings and the link to `Payment` (the 3.8 link card)
- Refunds of credits to money
- The customer-facing pages (M.6)
- SMS to the customer (M.8)

## Done when
- A customer can buy credits with a bKash or Nagad transfer, staff can verify it, and the credits arrive once and only once.
- The same transfer cannot be used twice.
- The Opus review passes.
