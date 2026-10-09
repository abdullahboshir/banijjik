# Feature Catalog

**Core** = code, shared by all industries. **Config** = enabled or shaped from the Platform Panel. **Pack** = small industry capability module (code) plus config. Phase numbers refer to `03-ROADMAP.md`. "manoxen" = a source to port from.

## Platform Panel (`apps/platform`)
| Feature | Type | Phase |
|---|---|---|
| Super-admin login, platform roles | Core | 1 |
| Tenant (org) list, create, suspend, impersonate (audited) | Core | 1, 6 |
| Industry registry: create industry, default modules, default fields, default settings | Config engine | 2 |
| Module catalog: enable/disable per industry, plan, org | Config engine | 2 |
| Custom field builder (industry or org level, per entity) | Config engine | 2 |
| Plans, pricing, entitlements, limits (locations, users, orders/month) | Core | 1, 6 |
| SaaS billing (invoice tenants; bKash/SSLCommerz) | Core (manoxen) | 6 |
| Feature flags, maintenance mode, platform audit | Core | 6 |

## Tenant Dashboard (`apps/admin`): common to all industries
| Feature | Type | Phase |
|---|---|---|
| Signup + onboarding wizard (pick industry → defaults applied) | Core | 6 |
| Organization profile, locations (hidden while only 1) | Core | 1 |
| Staff, roles, location assignments, invitations | Core | 1 |
| Settings (org + location override) | Config engine | 2 |
| Custom fields & forms (tenant-level, within platform limits) | Config engine | 2 |
| Contacts: customers, suppliers, tags, custom fields | Core (manoxen) | 3 |
| Catalog: products/services, variants, categories, units, images, per-location availability/price | Core (manoxen) | 3 |
| Inventory: stock ledger, levels per location, adjustment, transfer, low-stock | Core (manoxen) | 3 |
| Pricing & tax, discounts | Core (manoxen) | 3 |
| Sales: orders (state machine), invoices, returns/refunds, COD | Core (manoxen) | 3 |
| Payments: cash, bKash/Nagad manual + gateway, customer due | Core (manoxen) | 3, 5 |
| Accounting (double-entry, auto journals), expenses | Core (manoxen) | 3 |
| POS (location-bound device, shift, cash register, Z-report, receipt) | Core (manoxen) | 3 |
| Dashboard & reports (pre-aggregated, location filter) | Core (manoxen) | 3 |
| Notifications (in-app, SMS, email) | Core | 5 |
| Audit log viewer | Core | 6 |

## Tenant Website (`apps/storefront`)
| Feature | Type | Phase |
|---|---|---|
| Theme, sections, pages, SEO, custom domain/slug | Core + Config (manoxen) | 4 |
| Product catalog, cart, checkout (COD first), order tracking | Core (manoxen) | 4 |
| Capability sections (membership plans, booking, menu, courses) | Pack | 7 |

## Automation & integrations
| Feature | Type | Phase |
|---|---|---|
| Integration framework: encrypted per-org credentials, webhook intake, signature check | Core | 5 |
| Courier: Steadfast, Pathao, RedX (book, label, status webhooks) | Integration (manoxen) | 5 |
| Messenger/Instagram inbox, auto-reply, AI reply, chat → draft order | Integration (manoxen) | 5 |
| WhatsApp Cloud API, SMS gateway | Integration | 5 |
| Workflow engine: trigger → condition → action, tenant on/off | Core | 5 |
| COD fraud/risk score | Core (manoxen) | 5 |
| FB page post scheduling, ads (with human approval) | Integration | 8 |

## Industries = templates (ADR-033, ADR-034)
Booking (SERVICE/RENTAL/EVENT over resources) and Subscription (PLAN: enrollments, renewals, attendance) are **core** (Phase 3), so most industries need only data.

| Industry | Kinds used | Template data (no code) | Capability module (code, optional, reusable) |
|---|---|---|---|
| F-commerce / Retail | PRODUCT | fields, delivery terms, bot intake | — |
| Salon/Parlor | SERVICE (+PRODUCT) | services, staff resources, fields | — |
| Clinic | SERVICE | patient fields, doctor resources | clinical notes/prescription (Phase 7) |
| Gym | PLAN (+SERVICE, PRODUCT) | member fields, plans | — (attendance is core) |
| Coaching | PLAN, EVENT | student/guardian fields, batches | academic results/exams (Phase 7) |
| Restaurant | PRODUCT, RENTAL (tables) | menu fields, tables | kitchen display/KOT (Phase 7, manoxen) |
| Hostel | RENTAL, PLAN | resident fields, rooms/seats | — |

## Out of scope until after launch
HRM/payroll, governance/shareholders, marketplace, voice dialer, biometric devices, native mobile apps, dedicated-DB tenants. All exist partly in manoxen and can be ported later.
