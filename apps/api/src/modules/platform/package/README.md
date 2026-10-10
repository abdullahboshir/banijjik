# platform/package: sellable packages

Base packages (STORE, CHAT, SHOP, BUNDLE), add-ons and limit packs (10-MODULE-CATALOG section 9).

- **Entity:** `Package` (platform database, tenancy NONE, versioned): `packageKey`, `nameKey`, `isAddOn`, `moduleKeys`, `limits` (all eight limit keys, `null` = unlimited), `limitIncrements` (add-ons and packs), `status`.
- **Module keys** are checked against the catalogue (`MODULE_KEY`), not against the registered manifests: seed packages name modules that later phases build. The resolver ignores a key without a manifest.
- **Seed:** `infrastructure/seed-packages.ts` holds the data. `EnsureSeedPackagesUseCase` inserts only the packages whose key is missing and never overwrites an edited one. Run it with `npm run seed:packages -w @banijjik/api`. Prices stay empty until P2.
- **Public API** (`index.ts`): `registerPackageModels`, `packageManifest`, `buildPackageReader()` (read side for entitlement and saas-billing), `buildEnsureSeedPackagesUseCase()`, `SEED_PACKAGES`.
- **Routes:** none yet. The platform panel (card 1.8) edits packages and validates that a base package holds all CORE modules and is closed under `dependsOn`.
