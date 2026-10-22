# commerce/credit

OPTIONAL module: prepaid **credit packs** and paid **listing unlocks** for customer accounts.

## Surface

- Storefront (`/api/v1/storefront/orgs/{organizationId}`): `/my/credits`, `/my/unlocks`,
  `/credit-packs`, `/credit/payment-info`, `/credit-purchases`, `/my/credit-purchases`,
  `/credit-purchases/{creditPurchaseId}/cancel`, and unlocking a listing by its listing number.
- Tenant (`/orgs/{organizationId}/credit/…`): pack create/update/archive, a contact's credit
  account, owner/approval-gated adjustments, and credit purchase listing/detail/verify/reject
  (`credit.purchase.read`, `credit.purchase.verify`).

## Ledger & Purchases

Credit entries are append-only (ADR-130): PURCHASE, SPEND, REFUND, EXPIRE, ADJUST. The balance is a
projection kept by a guarded atomic `$inc`. A spend allocates FIFO, unexpired purchases first, and
records the allocation in `fromPurchaseEntryId`. Unlocks are idempotent per account and listing and
capped per business day.

Credit pack purchases (ADR-132) record manual payment transfers (bKash, Nagad) with a snapshot
of the pack's terms. A partial unique index on `(organizationId, method, transactionReference)`
prevents duplicate transfers for PENDING and VERIFIED statuses. Verification by staff grants credits
via the PURCHASE ledger entry in the same transaction, protected by an idempotent replay guard and
approval thresholds (`credit.purchase.approvalAbove`).

## Settings

- `credit.unlockCost` (default 1)
- `credit.unlocksPerDay` (default 20)
- `credit.showUnlockersToOwner` (default false)
- `credit.payment.methods` (STRUCTURED setting: accepted methods and transfer instructions)
- `credit.purchase.maxPending` (default 2)
- `credit.purchase.pendingDays` (default 3)
- `credit.purchase.approvalAbove` (MONEY setting, default 0 = off)

Storefront credit routes are unavailable when the module is ineffective. The public active-pack
list returns at most 100 rows in sort order. Ledger mutation guards are installed by the model
registry. Unlocks and expiry serialize on the account balance version inside their transactions;
all attribution/count reads share that session. Purchase scans use 100-row keyset batches and count
EXPIRE alongside SPEND so expired purchases cannot be allocated again. Deploy the additive keyset
indexes through the existing `db:sync-indexes` procedure (ADR-094).
