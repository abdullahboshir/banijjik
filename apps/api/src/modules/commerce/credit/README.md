# commerce/credit

OPTIONAL module: prepaid **credit packs**, paid **listing unlocks**, and manual **purchases**.

## Surface

- Storefront (`/api/v1/storefront/orgs/{organizationId}`): `/my/credits`, `/my/unlocks`, `/credit-packs`, `/credit/payment-info`, `/credit-purchases`, `/my/credit-purchases`, `/credit-purchases/{creditPurchaseId}/cancel`, and listing unlock.
- Tenant (`/orgs/{organizationId}/credit/…`): packs, customer accounts, adjustments, and purchase verification (`credit.purchase.read`, `credit.purchase.verify`).

## Ledger & Purchases

Credit entries are append-only (ADR-130): PURCHASE, SPEND, REFUND, EXPIRE, ADJUST with atomic `$inc` balance. Spend allocates FIFO, unexpired purchases first. Unlocks are idempotent per account/listing and daily-capped.
Purchases (ADR-132) record bKash/Nagad transfers with pack snapshot and partial unique reference index. Staff verify grants PURCHASE credits in-transaction with idempotent replay and approval guards (`credit.purchase.approvalAbove`).

## Settings & Invariants

Settings: `credit.unlockCost`, `credit.unlocksPerDay`, `credit.showUnlockersToOwner`, `credit.payment.methods`, `credit.purchase.maxPending`, `credit.purchase.pendingDays`, `credit.purchase.approvalAbove`.
Credit entries and purchases record local business dates resolved via the organization's timezone reader without UTC fallback (card 3.25).
Expiry: the hourly job `credit.expireCredits` (card 3.28) expires unused remainders of purchases whose expiry day passed, one 100-row keyset page at a time; a failing row is logged and skipped, and a rerun writes nothing twice.
Storefront routes hide when module is off. Active packs cap at 100 rows. Registry guards prevent ledger mutation. Keyset scans use 100-row batches with additive indexes (ADR-094).
`db:sync-indexes`: `credit_purchases` gains unique `{organizationId, creditPurchaseId}` and `{organizationId, purchaseNumber}`.
