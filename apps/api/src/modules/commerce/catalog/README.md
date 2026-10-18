# commerce/catalog

One catalog for every business (ADR-116, ADR-098): a salon's services, a gym's plans, a school's
courses, a shop's products are all Offerings with a kind, at least one variant and a sales unit.

- **Class:** `CORE`; provides the `PRODUCT` kind. The other kinds come from the modules that sell them.
- **Entities:** `Offering` (variants embedded), `Category`, `ModifierGroup` (add-ons), the per-location
  `OfferingLocation` row, one `SearchSynonymBook` per organization, and an `OfferingCounter` for the
  package limit. All live in the tenant database; only the location row is also limited by location.
- **Public API (`index.ts`):** `catalogManifest`, `registerCatalogModels()`, `buildCatalogRouter()`.
- **Endpoints:** `/orgs/{organizationId}/{offerings, categories, modifier-groups, catalog/synonyms}`
  (14-API.md section 5.3).
- **Events:** `catalog.offering.{created, updated, published, archived, priceChanged}`, ids only.
- **Permissions:** `catalog.offering.*`, `catalog.category.*`, `catalog.modifierGroup.*`,
  `catalog.synonym.update`. OWNER and MANAGER write; every other role reads.
- **Settings:** `catalog.defaultUnitKey` (prefills a new variant), `catalog.defaultStockTracked` (for card 3.3).
- **Rules worth knowing:**
  - The kind is fixed and must be one the template allows. `kindDetails` is checked per kind.
  - Variants are edited by sending the full list: ids are kept, a variant left out is archived and
    never deleted or reused. A SKU stays taken by an archived variant.
  - A variant has no stock of its own. Any stock component is refused until inventory items exist (3.3).
  - Money is `{ amount, currency }`, an integer of minor units in the organization's currency.
  - A price override at a location needs a variant; an offering-wide row only switches it on or off.
  - A category tree is at most three levels deep with no cycle; archiving is refused while ACTIVE
    offerings or child categories use it.
- **Ports:** the organization's currency and kinds, custom fields, image checks, locations, the
  default unit and sensitive access are adapted from other modules in `routes/catalog-tenant-router.ts`.
- **Layers:** `domain` (entities, variant merge, slugs, errors), `application` (use cases, ports),
  `infrastructure` (schemas, repositories), `presentation` (controllers, router).
- **Left for later cards:** screens (3.2b), inventory items and stock (3.3), price resolution,
  promotions and tax (3.4), bulk import (5.11), social links (Phase 5), event sessions, storefront
  sections and bot tools.
