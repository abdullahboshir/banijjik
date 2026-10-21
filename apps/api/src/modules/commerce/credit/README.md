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
