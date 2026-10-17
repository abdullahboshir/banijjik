# commerce/contact

Starter module made by `npm run new-module`. The first card that adds behaviour replaces this
paragraph with the module's purpose in one sentence.

- **Class:** `CORE` (10-MODULE-CATALOG section 1).
- **Entities:** none yet.
- **Public API (`index.ts`):** `contactManifest`, `registerContactModels()`, `buildContactInfo()`.
- **Events:** none emitted, none consumed.
- **Permissions:** none yet. Add the keys to `@banijjik/contracts` first, then to the manifest.
- **Layers:** `domain` (rules, errors), `application` (use cases, ports), `infrastructure`
  (adapters), `presentation` (transformers, later controllers and routers).
- **Wiring left to do:** list the manifest in `routes/module-registry.ts`, call
  `registerContactModels()` in `routes/v1.ts`, and add the role grant row in
  `core/iam/domain/system-role-grants.ts`.
