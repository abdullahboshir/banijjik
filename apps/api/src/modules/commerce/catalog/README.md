# commerce/catalog

One catalog for every business (ADR-116, ADR-098): services, plans, courses and products are all
Offerings with a kind, at least one variant and a sales unit.

- **Class:** `CORE`; provides the `PRODUCT` kind (other kinds come from the modules that sell them).
- **Entities:** `Offering` (variants embedded), `Category`, `ModifierGroup` (add-ons), the per-location
  `OfferingLocation` row, one synonym book and one offering counter per organization (tenant DB).
- **Public API (`index.ts`):** `catalogManifest`, `registerCatalogModels()`, `buildCatalogRouter()`.
- **Endpoints:** `/orgs/{organizationId}/{offerings, categories, modifier-groups, catalog/synonyms}`.
- **Events:** `catalog.offering.{created, updated, published, archived, priceChanged}`, ids only.
- **Permissions:** `catalog.offering.*`, `catalog.category.*`, `catalog.modifierGroup.*`,
  `catalog.synonym.update`. OWNER and MANAGER write; every other role reads.
- **Settings:** `catalog.defaultUnitKey`, `catalog.defaultStockTracked` (for card 3.3).
- **Rules:** the kind is fixed and must be allowed by the template. Variants are edited by the full
  list: ids are kept, a missing variant is archived, never deleted or reused. SKU is unique per
  organization. Any stock component is refused until inventory items exist (3.3). Money is
  `{ amount, currency }` in minor units. A location price override needs a variant. Categories are
  at most three levels deep.
- **Ports:** currency, kinds, custom fields, images, locations and the default unit are adapted in
  `routes/catalog-tenant-router.ts`.
- **Layers:** `domain`, `application`, `infrastructure`, `presentation`.
- **Left for later:** screens (3.2b), stock (3.3), pricing and tax (3.4), import (5.11), storefront
  sections and bot tools.
