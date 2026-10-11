# platform/package: sellable packages

Base packages (STORE, CHAT, SHOP, BUNDLE), add-ons and limit packs (10-MODULE-CATALOG section 9).

- **Entity:** `Package` (platform database, tenancy NONE, versioned): `packageKey`, `nameKey`, `isAddOn`, `moduleKeys`, `limits` (all eight limit keys, `null` = unlimited), `limitIncrements` (add-ons and packs), `status`.
- **Module keys** are checked against the catalogue (`MODULE_KEY`), not against the registered manifests: seed packages name modules that later phases build. The resolver ignores a key without a manifest.
- **Seed:** `infrastructure/seed-packages.ts` holds the data. `EnsureSeedPackagesUseCase` inserts only the packages whose key is missing and never overwrites an edited one. Run it with `npm run seed:packages -w @banijjik/api`. Prices stay empty until P2.
- **Public API** (`index.ts`): `registerPackageModels`, `packageManifest`, `buildPackageReader()` (read side for entitlement and saas-billing), `buildEnsureSeedPackagesUseCase()`, `buildPackagePlatformRouter()`, `SEED_PACKAGES`.
- **Platform API** (`/api/v1/platform/packages`, card 1.8a, permissions `platform.package.read|write`): list, create, get, `PATCH` with `version` (409 when stale), `POST …/archive`. A base package must be closed under `dependsOn` over the registered manifests plus SYSTEM and CORE (`domain/package-closure.ts`, `422 PACKAGE_NOT_CLOSED`); `unbuiltModuleKeys` lists keys without a manifest. Archiving a package of a running subscription is `422 PACKAGE_IN_USE`. Every save moves `Package.version` (the catalogue version picks it up within 5 s) and writes one platform audit entry.
