# commerce/credit

OPTIONAL module: prepaid **credit packs** and paid **listing unlocks** for customer accounts.

## Surface

- Storefront (`/api/v1/storefront/orgs/{organizationId}`): `/my/credits`, `/my/unlocks`,
  `/credit-packs`, and unlocking a listing by its listing number.
- Tenant (`/orgs/{organizationId}/credit/…`): pack create/update/archive, a contact's credit
  account, and an owner or approval-gated adjustment.

## Ledger

Credit entries are append-only (ADR-130): PURCHASE, SPEND, REFUND, EXPIRE, ADJUST. The balance is a
projection kept by a guarded atomic `$inc`. A spend allocates FIFO, unexpired purchases first, and
records the allocation in `fromPurchaseEntryId`. Unlocks are idempotent per account and listing and
capped per business day.

## Settings

- `credit.unlockCost` (default 1)
- `credit.unlocksPerDay` (default 20)
- `credit.showUnlockersToOwner` (default false)

Storefront credit routes are unavailable when the module is ineffective. The public active-pack
list returns at most 100 rows in sort order. Ledger mutation guards are installed by the model
registry. Unlocks and expiry serialize on the account balance version inside their transactions;
all attribution/count reads share that session. Purchase scans use 100-row keyset batches and count
EXPIRE alongside SPEND so expired purchases cannot be allocated again. Deploy the additive keyset
indexes through the existing `db:sync-indexes` procedure (ADR-094).
