# Vision

## Mission
Give every small and growing business one fast, simple operating system for selling, stock, money and customers. The repetitive work (posting, replying to messages, taking orders, booking couriers) is automated.

## Vision
One codebase, many industries. Industries differ by **configuration, not code forks**. A new industry (clinic, pharmacy, car rental) is mostly added from the Platform Panel, plus at most one small capability module.

## Product principles
1. **Speed is a feature.** Every screen feels instant (see budgets in ADR-020).
2. **Simple by default.** A single-shop owner never sees branches, scopes or enterprise concepts. Complexity appears only when the business grows into it.
3. **Mobile-first.** Most BD owners run the business from a phone.
4. **Correct money and stock, always.** A failure must never corrupt data (transactions, idempotency, ledgers, audit).
5. **Configuration over code** for industry differences. **Code over configuration** for core logic: order state machine, payments, stock math, tenancy, RBAC, subscription, accounting.
6. **Automate the boring work.** Messenger reply → order → courier → status updates.
7. **Ethical revenue (ADR-040).** No third-party ads inside the product. Tenant and customer data is never sold. We earn only from subscriptions, add-ons and usage. Sellers advertising their own products (e.g. Facebook ads) is a feature, not an exception.
8. **Trust by design.** A seller's customers' data belongs to the seller. We keep it isolated, export it on request, and delete it on exit (retention policy in Phase 6.3).

## Market
- **Go-to-market:** Bangladesh F-commerce and retail sellers (online + shop, COD, bKash/Nagad, Steadfast/Pathao/RedX, Facebook/Messenger).
- **Then:** salon/parlor, gym, coaching, restaurant, clinic, hostel. Each is an industry template (data), with optional reusable capability modules (ADR-034).

## Surfaces
| Surface | App | User |
|---|---|---|
| Platform Panel | `apps/platform` | Platform owner/developer. Manages tenants, plans, industries, modules, custom fields, feature flags. |
| Tenant Dashboard | `apps/admin` | Business owner and staff. Shows only enabled, relevant features. |
| POS | `apps/admin` (`/pos`, PWA) | Cashier. The device is bound to one Location. |
| Tenant Website | `apps/storefront` | The tenant's customers. Its components follow enabled capabilities. |

## Product packaging (ADR-032)
One login, one tenant dashboard, one shared data core. Products are **sold separately as entitlements**, not built as separate apps.

| Package | Gets |
|---|---|
| Core (in every package) | Contacts, catalog, stock, orders, bookings, enrollments, payments, expenses, courier/rider, reports (filtered by the industry template's kinds) |
| Store | + website builder, domain, online checkout |
| Chat | + channel connect, unified inbox, AI bot, Facebook post import, chat → order |
| Shop | + POS (counter sales, shifts, Z-report) |
| Bundle | Store + Chat + Shop + automation (discounted). Also the 14-day trial. |
| Add-ons | Bookkeeping, payment gateway, capability modules, limit packs (locations, staff, AI, SMS) |

Exact module sets, limits and resolver rules: `10-MODULE-CATALOG.md` (ADR-050).

- The dashboard home, menu and onboarding adapt to what the org bought. A chatbot-only seller sees an inbox-first app; a website-only seller sees a site-first app.
- Marketing may use separate landing pages and names per package. After signup, every user lands in the same app.
- Upsell is in-app and instant because the catalog and orders already exist.

## Control chain
`Industry defaults → Plan entitlements → Platform overrides for this tenant → Tenant's own limited customization → What a user's role and location assignment allow.`
Enforced in the API, never only hidden in the UI.

## Limits on configurability
- **Platform admin:** add/remove modules and entities for an industry or tenant. Add custom fields, set type, validation, required and visibility. Toggle features.
- **Tenant admin:** add custom fields, hide optional fields, reorder fields, rename labels, set required/optional, build custom forms. Cannot delete or alter core entities or core workflows.
- **Database schema never changes at runtime.** Configurable metadata plus validated values only.
