# Plan: card M.4 · Credits and connections (prepaid credits, ledger, unlocks)

Tier: **T1** (a money-like ledger; it controls access to private contact data) · Planned by: Opus 5.5 (Claude) · Implemented by: Cursor or a Claude Code session · Date: 2026-10-20 · Based on commit: `main 8258669` (M.2 and 3.8a merged)

Track M, fourth card. **Can start now**, beside 3.6 and M.3. Payment of credit packs is card M.5. Reserved ADR number: **ADR-130**.

## Goal
Doc 16 §3.2:
- customers hold **credits**
- a **connection** spends credits to **unlock** a listing's UNLOCKED fields (the guardian's name and phone)
- unlocking the same listing twice costs once
- every change is an **append-only credit entry**, and the balance never goes below zero

Staff can grant or take back credits with a reason. The listing owner can see how many times their listing was unlocked.

## Inputs read
- `docs/16-MATRIMONY-TRACK.md` §3.2, §3.5 (scraping limits), ADR-013, ADR-014, ADR-115 (ordering keys), ADR-118, ADR-119 (customer accounts), ADR-121 (approvals), ADR-127 (directory projection: UNLOCKED tier)
- Code: `commerce/directory` (the `projectListing` function and its viewer kinds, listing reads), `commerce/contact` customer accounts and `authenticateCustomer`, `kernel/events`, `kernel/rate-limit`, `core/iam` `ApprovalVerifier`

## Decisions
**Module** (`commerce/credit`, OPTIONAL; new `MODULE_KEY.CREDIT` in contracts; depends on `directory` for unlocks)

1. **CreditPack** (organization scope, versioned): `creditPackId`, `name` (bn, en), `credits` (integer > 0), `price: Money`, `validityDays?` (credits from this pack expire after N days; null = never), `status` (`ACTIVE | ARCHIVED`), `sortOrder`. Staff CRUD (`credit.pack.{read,update}`). Selling a pack is M.5; this card only defines packs.

2. **CreditEntry** (append-only):

   | Field | Notes |
   |---|---|
   | `creditEntryId` | |
   | `customerAccountId` | |
   | `type` | `PURCHASE`, `SPEND`, `REFUND`, `EXPIRE`, `ADJUST` |
   | `credits` | signed integer |
   | `expiresOn?` | for PURCHASE with validity |
   | `source { sourceType, sourceId }` | a payment (M.5), an unlock, an adjustment |
   | `reason?` | for ADJUST |
   | `createdByUserId?` | staff for ADJUST |
   | `occurredAt`, `businessDate` | |

   **Balance projection** `CreditBalance { customerAccountId, balance, version }`, updated in the same transaction with a conditional update `balance + delta ≥ 0`, so two parallel spends cannot overdraw. Index `{ organizationId, customerAccountId, occurredAt }`.

   - **Expiry** is first-in-first-out by purchase. A daily job (`kernel/jobs` once 3.6 is merged; until then an exported idempotent function with a STATUS note) writes EXPIRE entries for unused credits of expired purchases. Unused per purchase = purchased − spends attributed to it (spends consume the oldest unexpired purchase first; store the attribution on the SPEND entry as `fromPurchaseEntryId`).

3. **Unlock** (`ListingUnlock`, unique `(organizationId, customerAccountId, listingId)`):
   - `POST /api/v1/storefront/orgs/{organizationId}/listings/{listingNumber}/unlock` (customer signed in; `Idempotency-Key` required).
   - The listing must be APPROVED. Cost = setting `credit.unlockCost` (default 1).
   - If an unlock already exists, it returns it with no charge (idempotent by design).
   - Otherwise, in one transaction: SPEND entry, balance decrement, unlock row. Insufficient balance → `422 CREDITS_INSUFFICIENT`, with the balance and the cost.
   - **Limits:** `credit.unlocksPerDay` per account (default 20) → 429; plus a per-IP limit.
   - A customer cannot unlock their own listing (400).
   - Events (ids only): `credit.unlock.created` (for the listing owner's count, `orderingKey: listing:<listingId>`) and `credit.entry.created` (`orderingKey: creditAccount:<customerAccountId>`; accounting rules come later with M.5).

4. **Projection change in directory:** `projectListing` gets the viewer kind `UNLOCKED_MEMBER` when an unlock exists for (viewer, listing). Directory asks credit through a port `ListingUnlockReader.isUnlocked(customerAccountId, listingId)` adapted in routes, so directory does not import credit. With the credit module off, UNLOCKED stays hidden from customers as before.

5. **Customer endpoints** (storefront, signed in):
   - `GET /my/credits` (balance, entries paged)
   - `GET /my/unlocks` (unlocked listings with their UNLOCKED fields, paged)
   - `GET /credit-packs` (public list of ACTIVE packs, for M.6)

6. **Staff endpoints** (tenant pipeline):
   - `GET /credit/accounts/{customerAccountId}` (`credit.account.read`): balance and entries
   - `POST …/adjust { credits, reason }` (`credit.account.adjust`): needs an approval token (`APPROVAL_ACTION.CREDIT_ADJUSTMENT`, new) unless OWNER; audited
   - `GET /directory/listings/{listingId}/unlock-count` (`directory.listing.read`): count only. Never who unlocked, unless the setting `credit.showUnlockersToOwner` is on (default false); this card returns counts only.

7. **Grants:** OWNER, MANAGER all; STAFF `credit.account.read`, `credit.pack.read`; others none.

8. **Admin screens** (small): Credit packs (settings topic SALES); on the contact detail page (3.1b), a "Credits" section for contacts with a customer account (balance, history, adjust with the approval dialog).

9. **Records:**
   - ADR-130 ("Accepted (proposed)"): ledger and projection, FIFO expiry with attribution, idempotent unlocks, the port into directory, limits, privacy of unlockers
   - `09` (CreditPack, CreditEntry, CreditBalance, ListingUnlock), doc 16 §3.2 notes if a detail changed, `14` rows, the module README, STATUS row M.4

## Files
| Path | Change |
|---|---|
| `packages/contracts` (`MODULE_KEY.CREDIT`; `@banijjik/contracts/credit` subpath with exports, lint exception and new-module alias; types, permission keys, events, rule keys, approval action) | add-only |
| `packages/validation` (`@banijjik/validation/credit` subpath: pack, adjust, unlock, list queries) | create |
| `apps/api/src/modules/commerce/credit/**` | create |
| `apps/api/src/modules/commerce/directory/**` (projection viewer from the unlock port) | change |
| `apps/api/src/routes/*` (credit routers, the unlock reader adapter, storefront routes), `system-role-grants.ts` | add-only |
| `apps/admin/src/credit/**`, contact detail section | create, change |
| `packages/i18n` | add-only |
| `docs/04-DECISIONS.md` (ADR-130), `docs/09`, `docs/14`, `docs/handoffs/M.4.md`, `docs/STATUS.md` | |

## Tests (must exist and pass)
- [ ] **Ledger:** grant via adjust (with approval for MANAGER), spend on unlock, balance projection equals Σ entries after a scenario; entries are never updated.
- [ ] **Concurrency:** 5 parallel unlocks of different listings with a balance of 3 → exactly 3 succeed, balance 0, never negative.
- [ ] **Idempotency:** unlocking the same listing twice (and in parallel) charges once and returns the same unlock.
- [ ] **Expiry:** FIFO attribution; the job run twice writes one EXPIRE per expired purchase remainder.
- [ ] **Projection:** before unlock, UNLOCKED fields absent; after unlock, present for that account only (another account still sees none); with the credit module off, never present.
- [ ] **Limits:** unlocks per day → 429; own listing → 400; a non-approved listing → 404.
- [ ] **Privacy:** the unlock-count endpoint returns a number only; no endpoint lists who unlocked.
- [ ] **Isolation:** another organization's account or listing → 404; a token of organization A at B → 401.
- [ ] **Permission denied** for staff adjust without the key; module-off suite includes `credit`.
- [ ] **Admin:** unit tests for packs and the credits section; browser: create a pack, adjust a contact's credits with the owner.
- [ ] Every existing suite green; full "Done means" list.

## Out of scope
- Paying for packs (M.5)
- Accounting postings for credit sales (with M.5)
- The public site screens (M.6)
- Reports and blocks (M.7)

## Done when
- Customers can spend credits to unlock listings exactly once each, safely under concurrency.
- Staff manage packs and adjust balances.
- Unlocked fields appear only for the unlocking account.
- The Opus review passes.

## Owner-authorized review delta (2026-10-21)

Fix findings in M.4-review.md without changing product decisions: per-route storefront module gates, append-only registration, and account-write serialization before the transactional daily count; preserve idempotent retries at the cap. Correct zero adjustments, timestamps, missing spend IDs and silent purchase truncation. Use active-session consumption reads for both unlock and expiry, include expired consumption, and refresh expiry attribution after the account write. Add additive keyset indexes through ADR-094; preserve document/event compatibility. Regression coverage includes cap concurrency, module-off no-charge, compiled-model mutations, 1001 tied-date purchases, duplicate unlock with balance one and cap one, concurrent expiry and event-write rollback. Keep minor cleanup outside correctness explicitly listed in the handoff. Mandatory independent T1 review of this delta remains pending.
