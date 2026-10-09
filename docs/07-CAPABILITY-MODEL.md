# Capability Model: Modules, Packages, Industries, Offerings

Why this doc exists: in manoxen, industry behaviour was hardcoded as per-industry flags in contracts (16 industries × 15 flags). Capability, entitlement and provisioning were three overlapping layers, with separate frontend and backend checks. A new industry needed code, and features leaked or vanished inconsistently. This model replaces all of that. ADR-033, ADR-034.

---

## 1. Four concepts, never mixed

| Concept | Lives in | Owned by | Answers |
|---|---|---|---|
| **Module** | Code (manifest) | Developers | What can exist? |
| **Package / Plan** | DB | Platform panel | What did this org buy? |
| **Industry template** | DB | Platform panel | What does this kind of business start with, and what are things called? |
| **Org configuration** | DB | Platform panel + tenant (within limits) | What is on for this org right now? |

**Feature code never reads `industry`.** It only asks the resolver `has(moduleKey)` / `kinds()` / `fields(entityType)`. Only `modules/platform/industry` and the resolver may read the industry key. A lint rule enforces this (card 0.2).

## 2. Module manifest (the single source of truth for a module)

Every module ships `module.manifest.ts`, and the registry collects them. One manifest drives every surface, so nothing can drift.

```ts
export const salesManifest = defineModule({
  key: "sales",                       // from contracts MODULE_KEYS
  dependsOn: ["catalog", "contact"],  // resolver enables deps or refuses
  permissions: ["sales.order.read", "sales.order.create", ...],
  routes: "/orders",                  // API router prefix → auto entitlement gate
  menu: [{ key: "orders", labelKey: "nav.orders", path: "/orders", permission: "sales.order.read" }],
  settings: ["sales.autoConfirm", "sales.invoicePrefix"],
  customFieldEntities: ["order"],     // entities that accept custom fields
  offeringKinds: [],                  // kinds this module enables (see §4)
  botTools: ["create_draft_order", "get_order_status"],
  storefrontSections: ["checkout"],
  events: { emits: ["sales.order.confirmed"], consumes: [] },
});
```

The registry auto-builds all of these from the manifests:
- the **API gate**: a module's routes return 403 when the module is off
- the **menu** (module on × permission)
- the **bot tool list** (tools of enabled modules only)
- the **storefront section catalog**
- the **settings registry**
- the **custom-field entity registry**

## 3. Packages and the resolver

- A **Package** (DB) is a set of module keys + limits (locations, users, AI messages/month, orders/month). Website, Chatbot, Bundle, ERP add-ons (ADR-032) are packages.
- **Effective modules** for an org:
  `(base package ∪ add-ons) ∪ platform grants − platform revokes − tenant-disabled optional modules`
  Then dependencies are added, and modules not allowed for the industry template are dropped.
- **One resolver**, `resolveOrgConfig(orgId)` → `{ modules, kinds, fields, settings, menu, botTools, sections, limits, terms }`, cached in Redis with a version, invalidated on any change. **The API, admin UI, storefront and bot all use this one result.** No surface computes its own answer.
- **Generated contract tests (mandatory):** for every manifest, the test suite turns the module off and asserts:
  - every route returns 403
  - the menu has no entry
  - the bot has no tool
  - the storefront has no section
  - settings are hidden

  This is what makes packaging "properly" enforced: a new module gets these tests for free.

## 4. Offerings: commercial primitives, so industries need no code

Everything a business sells is an **Offering** with a **kind**. Kinds are a small, closed set of code-level primitives. Industries are combinations of kinds plus fields and labels.

| Kind | Core behaviour (code) | Request it creates | Used by (examples) |
|---|---|---|---|
| `PRODUCT` | variants, stock per location, shipping | Order | retail, F-commerce, pharmacy, restaurant items |
| `SERVICE` | duration, provider (staff) / resource, availability slots | Booking | salon, parlor, clinic, repair, consultancy |
| `PLAN` | period, price per period, start date, renewal, capacity | Enrollment / Subscription | gym membership, coaching course/batch, tuition fee |
| `RENTAL` | date range, resource (room/seat/vehicle), capacity | Reservation | hostel, guest house, car rental, restaurant table |
| `EVENT` | fixed date/time, seats | Ticket | workshop, class session, exam |

- Each kind has a fixed core schema. Industry- and org-specific attributes come from **custom fields** (`07 §5` / ADR-015), scoped by kind and entity.
- Core generic modules implement the kinds: `catalog` (all offerings), `sales` (orders), `booking` (services + rentals + events over **Resources** with availability), `subscription` (plans/enrollments/renewals). These are **core, not industry packs**.
- **Industry template** = enabled kinds + default modules + field sets + **terms** (i18n label overrides: Customer → "Student"/"Patient"/"Member"; Order → "Admission"; Resource → "Room"/"Chair"/"Trainer") + website templates + bot defaults (persona, FAQ starters, required intake fields).
- **New industry = new template in the platform panel.** Code is needed only for a genuinely new kind of behaviour (e.g. lab results, kitchen display). That becomes a small capability module with its own manifest, reusable by any industry.

## 5. Custom fields and intake fields
- `CustomFieldDefinition { scope: industry|org, entityType, kind?, key, labelKey, type, required, options, validation, visibility: {admin, storefront, bot}, botAsk: boolean, order }`
- `botAsk: true` means the bot must collect this field before creating the request. Examples: coaching `guardian_phone`, clinic `patient_age`, F-commerce `delivery_area`. Bot intake is configuration, not code.

## 6. Rules for agents (also in AGENTS.md)
1. Never branch on industry in feature code. Use the resolver.
2. A new module = a manifest + its generated contract tests passing.
3. A new industry = data (template). If you think it needs code, it is a new kind or capability module. Stop and propose an ADR.
4. Labels shown to users come from `terms` + i18n, never hardcoded nouns like "Student".
