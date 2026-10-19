# Inventory module (card 3.3)

Append-only **stock movements**, per-location **inventory levels** (on hand, reserved, damaged, moving average cost), **inventory items**, receipts, adjustments, one-step transfers, availability for catalog variants, and the **StockLedger** port for sales (card 3.5).

## Public API (`index.ts`)

- `inventoryManifest` — module registration (permissions, settings, events, sequence `TRANSFER`).
- `registerInventoryModels()` — Mongo models for items, movements, levels, reservations.
- `buildInventoryRouter()` — **TODO (in progress):** tenant routes under `/inventory-items` and `/stock/*`.

## Rules

- Movements are never updated or deleted; corrections are reversing movements.
- Levels are updated in the same transaction as the movement, with optimistic concurrency on `version`.
- Without `inventory.allowNegativeStock`, writes that would make `onHand` or `available` negative return `409 INSUFFICIENT_STOCK` with `details.inventoryItemId` and `available`.
- Catalog validates `stockComponents` and default tracked products through ports wired in `routes/catalog-tenant-router.ts` (catalog does not import this module's internals).
