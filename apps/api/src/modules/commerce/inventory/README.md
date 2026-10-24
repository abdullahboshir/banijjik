# Inventory module (card 3.3)

Append-only **stock movements**, per-location **inventory levels** (on hand, reserved, damaged, moving average cost in micros), **inventory items**, receipts, adjustments, one-step transfers, availability for catalog variants, and the **StockLedger** port for sales (card 3.5).

## Public API (`index.ts`)

- `inventoryManifest` — module registration (permissions, settings, events, sequence `TRANSFER`).
- `registerInventoryModels()` — Mongo models for items, movements (`appendOnly`), levels, reservations.
- `buildInventoryRouter()` — tenant routes under `/inventory-items` and `/stock/*`.
- `buildStockLedger()` / `StockLedger` — reserve, release, commitSale, returnStock for orders.
- `buildInventoryCatalogPorts()` — catalog validates components and creates default tracked items.
- `buildStockPostingSourceAdapter()` / `StockPostingSource` — reads stock source snapshots for accounting.
- `lineValueMinor()`, `movementValue()` — float-free movement value calculations.

## Rules

- Movements are never updated or deleted; corrections are reversing movements (`reversesStockMovementId`).
- Stock receipts require `paidVia: CASH | BKASH | NAGAD | BANK | ON_CREDIT` (card 3.24, ADR-138), stored on PURCHASE movements.
- Receipts, adjustments, opening stock and damage write-offs emit `inventory.stockSource.recorded` in the same transaction for `accounting.postStock`.
- Levels are updated in the same transaction as the movement, with optimistic concurrency on `version`.
- Average cost is stored as `averageUnitCostMicros` (minor × 10000 per base unit); line value rounds half-up once.
- Without `inventory.allowNegativeStock`, writes that would make `onHand` or `available` negative return `409 INSUFFICIENT_STOCK` with `details.inventoryItemId` and `available`.
- `RETURN_DAMAGED` restocks `InventoryLevel.damaged` with `stockState = DAMAGED` (docs/11).
- Catalog validates `stockComponents` and default tracked products through ports wired in `routes/catalog-tenant-router.ts` (catalog does not import this module's internals).
- Default tracked item creation runs in the **same transaction** as the offering write; `catalog.defaultStockTracked` is read **before** that transaction opens.
- Stock reservations are insert-once (idempotent by source); do not `$setOnInsert` `organizationId` (tenant update guard).
