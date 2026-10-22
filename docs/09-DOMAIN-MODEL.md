# Domain Model & Glossary

Card D1 · Status: **approved by owner 2026-10-09** · Written 2026-10-09 · Based on commit `5750bb4`

This doc fixes the words and the core entities before any code is written. Every later plan uses these names, fields and owners. If a plan needs a field or entity that is not here, the PLAN session adds it here first (or stops and asks).

Inputs: `00`, `01`, `04` (ADRs), `05` (conventions), `06`, `07`, `08`. New decisions made in this card are listed in §8 and added to `04-DECISIONS.md` as ADR-043 to ADR-048.

**Not in this doc:** request state machines and per-kind schemas in full (D3), module manifests and package contents (D2), template data (D4), API endpoints (D7).

---

## 1. Ubiquitous language

### 1.1 Glossary
| Term | Meaning | Code name / ID |
|---|---|---|
| **Platform** | Us: the company running the SaaS, and the platform panel. | — |
| **Platform operator** | A User allowed into the platform panel (super admin, support). | `PlatformOperator`, `platformOperatorId` |
| **User** | A person who logs in to the admin or platform app. Global, one per person. Never a shop's customer. | `User`, `userId` |
| **Organization** | One business with one industry template, one currency, one package subscription. "Tenant" only in kernel code. | `Organization`, `organizationId` |
| **Location** | A physical or stock place of an organization (shop, branch, warehouse). Every org has a default location. | `Location`, `locationId` |
| **Member** | A User's staff membership in one organization (role assignments, staff profile). | `Member`, `memberId` |
| **Role** | A named set of permission keys inside one organization. | `Role`, `roleId` |
| **Assignment** | "This member has this role at this location (or ALL locations)." | embedded in `Member.assignments` |
| **Invitation** | A pending offer for someone to become a member. | `Invitation`, `invitationId` |
| **Contact** | A person or company the business deals with: customer, supplier, lead, guardian. One per real party per org (ADR-039). | `Contact`, `contactId` |
| **Contact role** | Why the org knows this contact: `CUSTOMER`, `SUPPLIER`, `LEAD`, `RELATED` (a person known through another contact: guardian, parent, emergency contact, relative; ADR-113). Labels come from terms (`contact.<ROLE>`). | `contactRoles[]` |
| **Customer account** | A contact's login to one org's storefront or portal (phone OTP). Not a User. | `CustomerAccount`, `customerAccountId` |
| **Offering** | Anything the org sells. Always has a kind. | `Offering`, `offeringId` |
| **Kind** | Closed code primitive of an offering: `PRODUCT`, `SERVICE`, `PLAN`, `RENTAL`, `EVENT` (ADR-034). | `kind` |
| **Variant** | One sellable option of an offering (size/colour, 1-month/3-month, short/long hair). Every offering has at least one. | `variantId` |
| **Category** | Org-defined grouping of offerings, kind-agnostic. | `Category`, `categoryId` |
| **Resource** | A bookable thing with limited capacity at a location: a stylist, doctor, chair, room, seat, table, vehicle. | `Resource`, `resourceId` |
| **Resource type** | Template data that names resource categories (`CHAIR`, `ROOM`, `TRAINER`). Not a code enum. | `resourceTypeKey` |
| **Request** | Umbrella word for what a customer asks to buy. Three aggregates: Order, Booking, Enrollment (ADR-044). | `requestType` |
| **Order** | An immediate sale of one or more offerings of any kind, with optional delivery. | `Order`, `orderId` |
| **Booking** | A time-bound claim on capacity: a SERVICE slot, a RENTAL date range or an EVENT seat. "Reservation" and "Ticket" are terms for bookings of RENTAL and EVENT kinds. | `Booking`, `bookingId` |
| **Enrollment** | A contact's ongoing access to a PLAN offering, billed per period (gym membership, course admission). | `Enrollment`, `enrollmentId` |
| **Check-in** | A recorded visit/attendance against an enrollment or booking. | `CheckIn`, `checkInId` |
| **Checkout** | One customer action that creates several requests paid together. A correlation ID, not an aggregate. | `checkoutId` |
| **Payment** | Money received or refunded, allocated to one or more requests. | `Payment`, `paymentId` |
| **Due** | Request total minus allocated payments. Derived, never stored as the source of truth. | — |
| **Inventory item** | What is stocked (rice in kg, a shampoo bottle, burger buns). Variants draw from inventory items through stock components (ADR-098). | `InventoryItem`, `inventoryItemId` |
| **Stock movement** | One append-only ledger line that changes the stock of an inventory item at a location. | `StockMovement`, `stockMovementId` |
| **Inventory level** | Projection of stock movements per inventory item per location. | `InventoryLevel` |
| **Journal entry** | Double-entry accounting record, append-only. | `JournalEntry`, `journalEntryId` |
| **Module** | Code unit with a manifest (`07 §2`). Key from contracts. | `moduleKey` |
| **Package** | What the platform sells: a set of module keys + limits (Store, Chat, Shop, Bundle, add-ons; ADR-050). Never called "plan". | `Package`, `packageId` |
| **Platform subscription** | An org's purchase of a base package + add-ons, with trial/period/status. | `PlatformSubscription`, `platformSubscriptionId` |
| **Module override** | A platform grant/revoke or tenant disable of one module for one org. | `ModuleOverride`, `moduleOverrideId` |
| **Industry template** | Data: kinds, default/allowed modules, field sets, terms, settings defaults, resource types, website templates, bot defaults. | `IndustryTemplate`, `industryTemplateId`, `industryTemplateKey` |
| **Terms** | Label overrides per template/org: Contact → "Student", Order → "Admission", Resource → "Chair". | `termKey` |
| **Custom field** | A definition (`CustomFieldDefinition`) plus values stored in the entity's `customFields` map (ADR-015). | `customFieldDefinitionId` |
| **botAsk** | Flag on a custom field: the bot must collect it before `create_request`. | `botAsk` |
| **Setting** | A code-registered key whose value is resolved System → Industry → Org → Location (ADR-016). | `settingKey` |
| **Resolved config** | Output of `resolveOrgConfig` (ADR-033). | `ResolvedOrgConfig` |
| **Channel** | A connected messaging account (FB Page, IG account, WhatsApp number, web widget). | `Channel`, `channelId` |
| **Conversation / Message** | A thread with one contact on one channel / one inbound or outbound message. | `conversationId`, `messageId` |
| **Handoff** | The bot pauses and a human takes the conversation. | — |
| **Offering social link** | Maps a social post/ad to an offering (ADR-026 called it ProductSocialLink). | `OfferingSocialLink` |
| **Consignment** | A shipment booked with a courier for an order. | `Consignment`, `consignmentId` |
| **Business date** | The local calendar day (`YYYY-MM-DD`) of an event in the org/location timezone. Reports and day close use it. | `businessDate` |
| **Document number** | Human number from the per-org sequence (`ORD-000045`). Never the UUID, never `count()+1`. | `orderNumber`, `bookingNumber`, … |
| **Source** | Where a record came from: `ADMIN`, `POS`, `STOREFRONT`, `CHAT`, `IMPORT`, `API`, `SYSTEM`. | `source` |

### 1.2 Words we do not use (and what to use instead)
| Don't say (in code, API, DB) | Say | Why |
|---|---|---|
| tenant (business code) | organization | `05` naming |
| outlet, branch, BU, store, shop, scope | location | ADR-004 |
| customer / student / patient (as entity or ID) | contact (+ role, + terms) | ADR-039 |
| product (as an entity) | offering with kind `PRODUCT` | ADR-034. "Product" is fine as a UI term and kind name. |
| person, profile (global) | user (login) / member (staff) / contact (party) | ADR-046 |
| plan (SaaS meaning) | package | `PLAN` is an offering kind |
| subscription (alone) | enrollment (business) / platform subscription (SaaS) | two different things |
| membership (gym meaning) | enrollment (UI term "Membership" via terms) | Member = staff |
| reservation, ticket (as entity) | booking (terms rename it) | one aggregate |
| metadata, extra, attributes (free bag) | `customFields` (defined) | ADR-015 |
| ownership (entity) | `Organization.ownerUserId` | ADR-046 |

---

## 2. Shape of the model

```
PLATFORM DB (identity · access · configuration)               TENANT DB (business records, per org)
────────────────────────────────────────────                  ──────────────────────────────────────
User ──< Member >── Organization ──< Location                 Contact ──< CustomerAccount
            │            │  │                                 Offering (kind, variants) ──< OfferingLocation
          Role ──────────┘  ├─ PlatformSubscription ─> Package  Category, SearchSynonym, OfferingSocialLink
Invitation                  ├─ ModuleOverride                 Resource ──< ResourceTimeOff
PlatformOperator ─> User    ├─ IndustryTemplate (key)         Order · Booking · Enrollment ──< CheckIn
RefreshSession ─> User      ├─ CustomFieldDefinition          Payment (allocations → requests)
                            ├─ SettingValue, TermOverride     StockMovement → InventoryLevel
                            └─ OrganizationSlugHistory        Account, JournalEntry
                                                              Channel ──< Conversation ──< Message
                                                              Consignment, AuditLog (tenant)
```

**Split rule (ADR-043):** the platform DB holds everything needed to decide *who* may do *what* *where* and *how the org is configured*, including things that must be listed across organizations (a user's orgs). The tenant DB holds what the business does. A dedicated-DB move (ADR-023) copies only tenant-DB documents.

Why: `tenantContext` and `resolveOrgConfig` can run with one platform DB lookup (cached), org creation is one transaction in one database, and "list my organizations" never fans out to dedicated databases.

---

## 3. Shared rules for every entity

**Standard tenant fields (STF)** on every org-owned document, in both DBs:
`organizationId`, `createdAt`, `updatedAt`, `createdByUserId`, `updatedByUserId` (null = system). Every model below has STF unless it says otherwise.

- **Domain ID:** `<entityName>Id`, UUID v7 from `newId()`, unique index (compound with `organizationId` for org-owned data). `_id` never leaves infrastructure (ADR-036).
- **`version`:** integer, on every mutable aggregate root marked "versioned" below. Updates filter on `{ <entity>Id, version }`.
- **Embedded sub-documents:** `_id: false`. If a sub-item needs identity it gets its own UUID v7 (`orderLineId`, `addressId`).
- **Money:** value object `{ amount: integer minor units, currency: "BDT" }` (ADR-013). Loose numbers outside a Money object end in `Minor`. An org has one currency (`Organization.currencyCode`); mixing currencies inside one request is rejected.
- **Quantity:** integer in the unit's precision (ADR-047). Unit `KG` has precision 3, so `1500` = 1.5 kg. Float quantities are forbidden for the same reason as money.
- **Phone:** `phoneE164`. **Email:** `email`, trimmed + lowercased.
- **Enums** live in `packages/contracts` and are stored as uppercase strings.
- **Soft delete** (`deletedAt`, `deletedByUserId`) only where marked "soft-delete". Ledgers, payments and audit logs are never deleted.
- **Lineage:** `source` (+ `channelId`, `conversationId` when from chat) on contacts, offerings and requests.
- **customFields:** `Record<string, CustomFieldValue>` validated by the definitions for `(entityType, kind?)`. Only on entities listed in a manifest's `customFieldEntities` (marked "custom fields" below).
- **Index rule:** org-owned collections: every index starts with `organizationId`; location-scoped ones continue with `locationId` (`01 §4`).

**Scope** in the entity headers means:
- `platform`: not org-owned (no tenant plugin).
- `org`: tenant plugin, visible in all locations of the org.
- `location`: tenant plugin + location plugin; reads are filtered to the member's allowed locations, writes validate `locationId`.

---

## 4. Platform DB entities

### 4.1 User
Owner `core/iam` · scope platform · versioned
| Field | Type | Notes |
|---|---|---|
| `userId` | UserId | |
| `name` | string | display name |
| `email` | string? | unique when present |
| `phoneE164` | string? | unique when present |
| `passwordHash` | string | never leaves the module, never logged |
| `status` | `ACTIVE \| LOCKED \| DISABLED` | |
| `emailVerifiedAt`, `phoneVerifiedAt` | Date? | |
| `preferredLocale` | `bn \| en` | |
| `avatarFileId` | FileId? | |
| `lastLoginAt` | Date? | |
| `createdAt`, `updatedAt` | Date | no `organizationId` |

- Invariants: at least one of `email` / `phoneE164`. Login identifier must be verified before the user can own a second org (anti-abuse, card 1.1 decides the exact flow).
- Holds **no** staff, HR or customer data (ADR-046). NID, blood group etc. are member custom fields.
- Indexes: `{ userId }` unique, `{ email }` unique partial, `{ phoneE164 }` unique partial.
- Events: `iam.user.registered`, `iam.user.locked`.

**RefreshSession** (`core/iam`, platform): `refreshSessionId`, `userId`, `tokenHash`, `familyId` (rotation/reuse detection), `audience`, `expiresAt`, `familyExpiresAt`, `revokedAt?`, `rotatedAt?`, `replacedByRefreshSessionId?`, `userAgent`, `ipHash`. Index `{ userId, revokedAt }`, TTL on `expiresAt`.

**PlatformOperator** (`core/iam`, platform, versioned): `platformOperatorId`, `userId` (unique), `platformRoles[]` (`SUPER_ADMIN`, `SUPPORT`, `BILLING`), `status` (`ACTIVE` or `DISABLED`), `referenceVersion` (guard counter, ADR-092). Platform-panel access is this record, not a flag on User, so it is audited and revocable on its own. The platform app uses its own cookie name and audience.

### 4.2 Organization
Owner `core/organization` · scope platform (it *is* the tenant) · versioned
| Field | Type | Notes |
|---|---|---|
| `organizationId` | OrganizationId | |
| `slug` | string | globally unique, URL `/[orgSlug]` and free subdomain; history in `OrganizationSlugHistory` |
| `name` | string | |
| `industryTemplateKey` | string | e.g. `FCOMMERCE`; read only by the resolver and `platform/industry` (ADR-033) |
| `ownerUserId` | UserId | billing/legal owner (ADR-046) |
| `status` | `ACTIVE \| SUSPENDED \| CLOSED` | SUSPENDED blocks all tenant routes with a clear error (card 1.8) |
| `deployment` | `SHARED \| DEDICATED` | ADR-023 |
| `dedicatedConnectionRef` | string? | encrypted reference, only when DEDICATED |
| `limitWriteVersion` | number | guard counter for limit checks that race a write (ADR-092) |
| `countryCode` | `BD` … | |
| `currencyCode` | `BDT` … | fixed after the first money record |
| `timezone` | IANA, e.g. `Asia/Dhaka` | |
| `defaultLocale` | `bn \| en` | |
| `profile` | `{ legalName?, legalType?, phoneE164?, email?, address?, logoFileId?, tradeLicenseNumber? }` | shown on invoices and storefront |
| `branding` | `{ logoFileId?, primaryColor?, accentColor?, tagline? }` | the business's own look for customer-facing pages (card 3.12, ADR-114); colours are `#RRGGBB` and pass the contrast rules; the logo is a `LOGO` file |
| `configVersion` | integer | bumped on any config change; part of the resolver cache key |
| `rolesVersion` | integer | bumped in the same transaction as every role create, update or archive; part of the permission cache key (ADR-088) |
| `customFields` | map | custom fields (entityType `organization`) |
| STF minus `organizationId` duplication | | `createdByUserId` = the signing-up user |

- Dropped from today's code: `nature` (derived from enabled kinds), `metadata`, `establishedDate`, separate `OrganizationOwnership`.
- Invariants:
  - created together with exactly 1 default Location, the system Roles and 1 owner Member (ACTIVE, OWNER role at ALL), in one transaction (card 1.2).
  - `ownerUserId` always has an ACTIVE member with the OWNER role at ALL. The owner member cannot be suspended or removed; ownership is moved with `transferOwnership(newOwnerUserId)`, and the target must already be an active member.
  - `industryTemplateKey` changes only through a platform-operator use case (ADR-046). The change applies the new template's defaults additively: no field definition, value, module data or offering is deleted.
  - `currencyCode` cannot change once any Money record exists.
- Indexes: `{ organizationId }` unique, `{ slug }` unique, `{ ownerUserId }`, `{ status }`.
- Events: `organization.organization.created`, `.renamed`, `.slugChanged`, `.suspended`, `.reactivated`, `.closed`, `.ownershipTransferred`, `.industryTemplateChanged`.

**OrganizationSlugHistory** (platform): `organizationId`, `oldSlug` (unique), `changedAt`. Old slugs redirect; an unknown slug is a 404, never another org (`05` slug rule).

### 4.3 Location
Owner `core/organization` · scope org · versioned
| Field | Type | Notes |
|---|---|---|
| `locationId` | LocationId | |
| `name` | string | unique per org among ACTIVE locations (an archived location frees its name, ADR-092) |
| `locationType` | `STORE \| WAREHOUSE` | WAREHOUSE holds stock only: no POS, no bookings, no walk-in sales |
| `isDefault` | boolean | exactly one per org |
| `status` | `ACTIVE \| ARCHIVED` | |
| `address` | Address | |
| `phoneE164` | string? | |
| `timezone` | IANA? | falls back to the org timezone |
| `referenceVersion` | number | guard counter for writes that must see the location's current state (ADR-092) |
| `openingHours` | weekly schedule? | used by bot `get_policy` and booking defaults |
| STF | | |

- Invariants: the default location cannot be archived. The count of ACTIVE locations ≤ package limit `locations`. Archiving is refused while the location has non-zero stock or open requests (exact checks in D3).
- UI rule (ADR-004): while an org has one ACTIVE location, no location UI is shown.
- Indexes: `{ organizationId, locationId }` unique, `{ organizationId, name }` partial unique among ACTIVE locations, `{ organizationId, isDefault }`.
- Events: `organization.location.created`, `.updated`, `.archived`.

### 4.4 Member
Owner `core/organization` · scope org · versioned · custom fields (entityType `member`)
| Field | Type | Notes |
|---|---|---|
| `memberId` | MemberId | |
| `userId` | UserId | |
| `status` | `INVITED \| ACTIVE \| SUSPENDED \| REMOVED` | REMOVED keeps history (requests reference `memberId`) |
| `assignments` | `[{ locationId: LocationId \| "ALL", roleId }]` | ADR-005 |
| `displayName` | string | how the org shows this staff member (may differ from `User.name`) |
| `approvalPinHash` | string? | manager PIN for approvals, hashed (`11 §9`, ADR-121) |
| `approvalPinFailedCount` | integer | wrong PIN attempts; reset on success |
| `approvalPinLockedUntil` | Date? | set after 5 failures for 15 minutes |
| `jobTitle` | string? | |
| `employeeNumber` | string? | from the org sequence `MEMBER` |
| `joinedAt` | Date | |
| `customFields` | map | staff profile: NID, blood group, emergency contact… defined per template/org (ADR-046) |
| STF | | |

- Invariants: unique `(organizationId, userId)`. An ACTIVE member has ≥ 1 assignment. Each `locationId` in assignments is an ACTIVE location of the same org; no two assignments for the same location. The member count ≤ package limit `members`.
- Effective permissions at location L = union of the permissions of roles assigned at L and at ALL. Allowed locations = all if any assignment is ALL, else the assigned ones.
- Sensitive staff custom fields use field visibility + permission `organization.member.readSensitive` (field flag `isSensitive`, defined in card 2.3).
- Indexes: `{ organizationId, memberId }` unique, `{ organizationId, userId }` unique, `{ userId, status }` (list a user's orgs, `runAsSystem(AUTH_LOOKUP)`).
- Events: `organization.member.invited`, `.joined`, `.assignmentsChanged`, `.suspended`, `.removed`. Each bumps the permission cache version (card 1.4).

**Invitation** (`core/organization`, org): `invitationId`, `email?` / `phoneE164?`, `assignments`, `invitedByUserId`, `tokenHash` (random secret, not the UUID), `expiresAt`, `status` (`PENDING \| ACCEPTED \| REVOKED \| EXPIRED`). Accepting activates the Member for the signed-in User whose email or phone equals the invited one (ADR-092); status EXPIRED is derived from `expiresAt`. Index `{ organizationId, status }`, `{ tokenHash }` unique.

### 4.5 Role
Owner `core/iam` · scope org · versioned
| Field | Type | Notes |
|---|---|---|
| `roleId` | RoleId | |
| `roleKey` | string | system: `OWNER`, `MANAGER`, `CASHIER`, `STAFF`, `RIDER`, `VIEWER`; custom: generated `custom.<roleId>` (the org chooses the `name`, not the key; ADR-088) |
| `nameKey` / `name` | string | i18n key for system roles, plain name for custom roles |
| `isSystem` | boolean | |
| `status` | `ACTIVE \| ARCHIVED` | custom roles are archived, never deleted; refused while an ACTIVE member holds the role; an archived role grants nothing |
| `permissionKeys` | string[] | each from contracts; empty for system roles (their keys come from the code template, 10 section 10) |
| STF | | |

- Invariants: unique `(organizationId, roleKey)`. `OWNER` is immutable and has every permission. Other system roles are created from code templates at org creation; their permissions update with code releases, they are not editable by the tenant. Custom roles: editable, cannot include platform permissions. Permissions of disabled modules are kept but have no effect (the entitlement gate runs first).
- Indexes: `{ organizationId, roleId }` unique, `{ organizationId, roleKey }` unique.
- Events: `iam.role.created`, `.permissionsChanged`, `.archived` (refused while assigned; "deleted" became "archived" in card 1.4).

### 4.6 Configuration entities
All in the platform DB, all read through `resolveOrgConfig` (cached per `configVersion`). Detailed schemas: D2 (manifests, packages), D4 (templates), cards 2.3/2.4.

| Entity | Owner | Scope | Key fields | Key invariants |
|---|---|---|---|---|
| **IndustryTemplate** (versioned) | `platform/industry` | platform | `industryTemplateId`, `industryTemplateKey` (unique; format only, ADR-097), `status` (`DRAFT \| PUBLISHED \| RETIRED`), `name`, `description`, `iconKey`, `enabledKinds[]`, `allowedModuleKeys[]` (CORE and OPTIONAL), `configuration` (contact roles, relations, resource types, terms, custom fields, settings defaults, optional modifier seeds, knowledge starters, website template keys, bot defaults) | The stored shape follows `12 §1` (card 2.1a). `defaultModuleKeys` and `websiteTemplateIds` are not stored. Only a PUBLISHED template can be chosen at signup. A missing row is an internal error, never allow-all. |
| **Package** (versioned) | `platform/package` | platform | `packageId`, `packageKey`, `nameKey` or `name` (exactly one: i18n key for seed packages, plain 2 to 60 characters for operator-made ones), `isAddOn`, `moduleKeys[]`, `limits` (all eight `LIMIT_KEY`s; `null` = unlimited), `limitIncrements` (add-ons and packs), `prices[]` (empty until P2), `status`, `referenceVersion` (guard counter, ADR-093) | Module keys exist in the catalogue (`MODULE_KEY`). A base package and an add-on are never the same record. |
| **PlatformSubscription** (versioned) | `platform/saas-billing` | org | `platformSubscriptionId`, `basePackageId`, `addOnPackageIds[]`, `status` (`TRIALING \| ACTIVE \| PAST_DUE \| CANCELLED`), `trialEndsAt`, `currentPeriodStart/End` | Exactly one non-cancelled subscription per org. Card 1.6 creates it; card 6.2 adds billing. |
| **ModuleOverride** | `platform/entitlement` | org | `moduleOverrideId`, `moduleKey`, `effect` (`PLATFORM_GRANT \| PLATFORM_REVOKE \| TENANT_DISABLE`), `reason`, `expiresAt?` | Unique `(organizationId, moduleKey, effect)`. Tenant may only disable modules marked optional. Feeds `07 §3` formula. |
| **CustomFieldDefinition** (versioned) | `core/custom-field` | org (scope `ORGANIZATION`, tenant DB). INDUSTRY fields are **not** stored as rows: they are read from the template's `configuration.customFields` (ADR-076, ADR-102) | `customFieldDefinitionId`, `scope`, `entityType`, `offeringKind?`, `fieldKey`, `labelKey`/`label`, `fieldType` (16 types, `01 §5`), `referenceEntity?` + `link? { relationKey, createIfMissingByPhone, defaultBillTo }` for contact-link fields (ADR-073), `isRequired`, `options[]`, `validation`, `visibility { admin, storefront, bot }`, `botAsk`, `isSearchable`, `isSensitive`, `sortOrder`, `status` (`ACTIVE \| ARCHIVED`) | `fieldKey` is immutable and unique per `(scope owner, entityType, offeringKind)`. `fieldType` cannot change once values exist. Archive, never hard delete. Tenants cannot edit INDUSTRY definitions, only hide optional ones and override labels/order (`00` limits). |
| **CustomFieldPreference** (versioned) | `core/custom-field` | org (tenant DB) | `customFieldPreferenceId`, `entityType`, `offeringKind?`, `fieldKey`, `isHidden`, `label?` (`{ bn, en }`), `sortOrder?` | One row per INDUSTRY field the business adjusts. Unique `(organizationId, entityType, offeringKind, fieldKey)`. A required field cannot be hidden. Forms and `/me/config` leave hidden fields out; the management list shows them marked `isHidden` (ADR-102, ADR-108). |
| **SettingValue** | `core/settings` | org (+ optional `locationId`) | `settingKey`, `value`, `locationId?`, `version` | Key must exist in the registry; `locationId` only for keys that allow a location override (ADR-016). |
| **TermOverride** (versioned) | `core/settings` | org (tenant DB) | `termOverrideId`, `termKey`, `locale` (`bn` or `en`), `text` (1 to 40), `version` | Unique `(organizationId, termKey, locale)`. Allowed keys are the template's `configuration.terms`. Each language falls back to the template when no override exists (ADR-104). |

`ResolvedOrgConfig` (output, not stored): `{ organizationId, configVersion, registryHash, accessMode, modules, kinds, fields, settings, terms, menu, botTools, storefrontSections, limits }`. `terms` is both languages per key. `settings` in `/me/config` is the client-visible organization-level subset. `fields` is the effective custom fields of the effective modules. Algorithm: `10 §3`. ADR-104.

---

## 5. Tenant DB entities

### 5.1 Contact
Owner `commerce/contact` · scope org · versioned · soft-delete · custom fields (entityType `contact`)
| Field | Type | Notes |
|---|---|---|
| `contactId` | ContactId | |
| `contactType` | `PERSON \| COMPANY` | |
| `name` | string | single field (BD names do not split cleanly) |
| `phoneE164` | string? | dedupe key |
| `additionalPhonesE164` | string[] | |
| `email` | string? | |
| `contactRoles` | `CUSTOMER \| SUPPLIER \| LEAD`[] | labels via terms ("Student", "Patient", "Member") |
| `addresses` | `[{ addressId, label, line1, area, thana, district, postalCode?, isDefault }]` | requests copy a snapshot, they never reference a live address |
| `relations` | `[{ relatedContactId, relationKey }]` | `GUARDIAN_OF`, `PARENT_OF`, `EMPLOYEE_OF` …; keys from contracts |
| `tagKeys` | string[] | |
| `homeLocationId` | LocationId? | for reports only; contacts are shared across locations |
| `summary` | `{ requestCount, lifetimeValue: Money, lastActivityAt, codReturnCount, storeCreditBalance: Money }` | projection updated by events, never written by use cases |
| `customFields` | map | |
| `source`, `channelId?` | | lineage |
| STF + `version` | | |

- Invariants (adapted manoxen rule 11): one Contact per real party per org. Phone first, then email: a create or import that matches an existing contact links to it, it never creates a second one. A contact needs `name` or `phoneE164`. `relations` point to contacts of the same org. Erasure on request = anonymize (name/phone/email/addresses cleared), the record stays for ledgers.
- Family sharing a phone (a child using a parent's phone): the parent is the contact with the phone; the child is a contact without a phone, linked by `GUARDIAN_OF` (owner answer Q2, §9).
- Indexes: `{ organizationId, contactId }` unique, `{ organizationId, phoneE164 }` unique partial, `{ organizationId, email }` partial, `{ organizationId, contactRoles, updatedAt }`, text/search index decided in card 3.1.
- Events: `contact.contact.created`, `.updated`, `.merged`, `.anonymized`.

### 5.2 CustomerAccount (ADR-045)
Owner `commerce/contact` · scope org · versioned
| Field | Type | Notes |
|---|---|---|
| `customerAccountId` | CustomerAccountId | |
| `contactId` | ContactId | unique |
| `phoneE164` | string | login identifier, unique per org |
| `status` | `ACTIVE \| BLOCKED` | |
| `verifiedAt`, `lastLoginAt` | Date? | |
| STF | | |

- Login: phone OTP per org (password optional later). Sessions in `CustomerSession` (`customerSessionId`, `customerAccountId`, `refreshTokenHash`, `previousRefreshTokenHash?`, `expiresAt` with a TTL index, `lastUsedAt`, `userAgentSummary?`), tenant DB; revoked by deletion.
- `OtpChallenge` (tenant DB, one per phone): `otpChallengeId`, `phoneE164`, `codeHash` (HMAC with `OTP_SECRET`), `codeCiphertext?` (AES-256-GCM, removed after the SMS), `attempts`, `expiresAt` (TTL index), `consumedAt?`. Indexes `{ organizationId, phoneE164 }` unique. ADR-119.
- Ending the contact (archive, anonymize) deletes the account and its sessions.
- Security: a separate cookie bound to the storefront host and a separate token audience (`storefront`). The admin API rejects customer tokens and the storefront API rejects staff tokens. A customer account is never a User and never gets a Member.
- Why per-org and not global: a shop's customers belong to that shop (`00` principle 8, ADR-040), there is no cross-shop tracking, a dedicated-DB move takes the accounts with it, and a stolen customer session can never reach another org. A future marketplace can add a federated "shopper" identity on top without changing this model.
- Indexes: `{ organizationId, phoneE164 }` unique, `{ organizationId, contactId }` unique.

### 5.2b Listing (ADR-127)
Owner `commerce/directory` · scope org · versioned · custom fields (entityType `listing`)
| Field | Type | Notes |
|---|---|---|
| `listingId` | ListingId | |
| `listingNumber` | string | per-org sequence `LISTING`, shown as `<prefix>-<n>` |
| `ownerCustomerAccountId` | CustomerAccountId | one non-archived listing per account when the setting says so |
| `status` | `DRAFT \| SUBMITTED \| APPROVED \| REJECTED \| HIDDEN \| ARCHIVED` | see doc 16 §3.1 |
| `customFields` / `customFieldSearch` | map / attribute entries | filterable fields only in search; never UNLOCKED/PRIVATE values |
| `photoFileIds` | FileAssetId[] | purpose `LISTING_PHOTO`, PRIVATE |
| `consentsAccepted` | `[{ consentKey, textVersionHash, acceptedAt }]` | |
| `submittedAt`, `reviewedAt`, `reviewedByUserId`, `rejection`, `publishedAt` | | |
| STF + `version` | | |

- Visibility tiers and photo policy: ADR-127. Archive clears personal data and keeps the number.
- Indexes: `{ organizationId, listingNumber }` unique; partial unique on owner for active statuses; attribute-pattern on `customFieldSearch`; queue and published sorts.

### 5.2c CreditPack, CreditEntry, CreditBalance and ListingUnlock (ADR-130)
Owner `commerce/credit` (OPTIONAL, depends on `directory`) · scope org
| Field | Type | Notes |
|---|---|---|
| **CreditPack** | versioned | `creditPackId`, `name` (`{ bn, en }`), `credits` (integer > 0), `price: Money`, `validityDays` (integer? null = never), `status` (`ACTIVE \| ARCHIVED`), `sortOrder`, STF + `version` |
| **CreditEntry** | append-only | `creditEntryId`, `customerAccountId`, `type` (`PURCHASE \| SPEND \| REFUND \| EXPIRE \| ADJUST`), `credits` (signed integer), `expiresOn?`, `source { sourceType, sourceId }` (`PAYMENT \| UNLOCK \| ADJUSTMENT \| EXPIRY_JOB`), `fromPurchaseEntryId?` (the purchase a SPEND or EXPIRE row consumes), `reason?`, `createdByUserId?`, `occurredAt`, `businessDate`, `createdAt` |
| **CreditBalance** | projection | `customerAccountId`, `balance`, `version`, `updatedAt`; changed only by a guarded atomic `$inc` (`balance + delta ≥ 0`) in the same transaction as its entry, so it equals the sum of entries and never goes negative |
| **ListingUnlock** | append-only | `listingUnlockId`, `customerAccountId`, `listingId`, `creditEntryId`, `unlockedAt`; unique per `(organizationId, customerAccountId, listingId)`, so unlocking twice costs once |

- Spend allocation is FIFO: the oldest unexpired purchases first, then expired ones. Each SPEND row records its `fromPurchaseEntryId`; a spend beyond every purchase is unattributed non-expiring (ADJUST) credit. Corrections are new entries, never updates.
- `ExpireCreditsUseCase` writes one EXPIRE row per expired purchase remainder; a second run changes nothing (partial unique index on `(organizationId, source.sourceId)` for EXPIRE rows). No scheduler in M.4; a 3.6 job calls it per organization.
- Unlock cost `credit.unlockCost` (default 1); `credit.unlocksPerDay` per account per business day (default 20) plus per-IP and per-account rate limits. Own listing → 400, non-APPROVED → 404, insufficient balance → 422.
- Directory reads unlocks through the `ListingUnlockReader` port; UNLOCKED fields project only for the unlocking account. The owner's unlock count is a number only (`credit.showUnlockersToOwner` defaults false and no endpoint lists unlockers).
- Indexes: `{ organizationId, customerAccountId, occurredAt }` on entries; `{ organizationId, customerAccountId }` unique on balances; `{ organizationId, customerAccountId, listingId }` unique on unlocks.
- Events: `credit.entry.created` (`orderingKey creditAccount:<customerAccountId>`) and `credit.unlock.created` (`orderingKey listing:<listingId>`).

### 5.2d CreditPurchase (ADR-132)
Owner `commerce/credit` · scope org · versioned · audit fields
| Field | Type | Notes |
|---|---|---|
| **CreditPurchase** | versioned | `creditPurchaseId`, `purchaseNumber` (`CP-<n>`), `customerAccountId`, `creditPackId`, immutable `snapshot` (`{ name, credits, price: Money, validityDays? }`), `method` (`BKASH \| NAGAD`), `senderPhone` (E.164), `transactionReference` (upper-cased), `status` (`PENDING \| VERIFIED \| REJECTED \| CANCELLED`), `submittedAt`, `expiresAt`, `verifiedByUserId?`, `verifiedAt?`, `rejectionReason?`, `creditEntryId?`, STF + `version` |

- **Duplicate transfer prevention:** partial unique index `{ organizationId, method, transactionReference }` where status is `PENDING` or `VERIFIED` (`409 errors.credit_reference_taken`). A `REJECTED` or `CANCELLED` reference may be reused in a subsequent new submission.
- **Verification & ledger link:** Staff verify (`credit.purchase.verify`) executes within a transaction, consumes approval token when pack price > `credit.purchase.approvalAbove` (MONEY setting), marks status `VERIFIED`, and appends a `PURCHASE` credit entry (`source = { sourceType: "PURCHASE", sourceId: creditPurchaseId }`) with `balance` delta and `expiresOn` derived from snapshot validity. Replaying verify returns the verified entity idempotently without double-granting credits.
- **Self-service guard:** Staff cannot verify or reject their own customer purchases (`403 errors.credit_purchase_self_service_forbidden`).
- **Expiry job:** Daily scheduled job cancels PENDING purchases older than `credit.purchase.pendingDays` (default 3 days).
- **Events:** `credit.purchase.submitted`, `credit.purchase.verified`, `credit.purchase.rejected`, `credit.purchase.cancelled` (`orderingKey creditAccount:<customerAccountId>`).

### 5.3 Offering
Owner `commerce/catalog` · scope org · versioned · soft-delete · custom fields (entityType `offering`, filtered by `kind`)
| Field | Type | Notes |
|---|---|---|
| `offeringId` | OfferingId | |
| `kind` | `PRODUCT \| SERVICE \| PLAN \| RENTAL \| EVENT` | immutable after creation |
| `name` | string | |
| `slug` | string | storefront URL, unique per org |
| `status` | `DRAFT \| ACTIVE \| ARCHIVED` | DRAFT (e.g. from a Facebook post) never reaches the bot or storefront (ADR-026) |
| `description` | string? | |
| `categoryIds` | CategoryId[] | |
| `modifierGroupIds` | ModifierGroupId[] | add-on options (ADR-072) |
| `imageFileIds` | FileId[] | |
| `variants` | `OfferingVariant[]` (embedded, 1–100) | see below |
| `kindDetails` | discriminated union by kind | schemas in D3 (`durationMinutes`, `billingPeriod`, `rateUnit`, `startsAt`, `capacity`, …) |
| `taxClassKey` | string? | kebab key of a TaxClass; catalog does not check it (ADR-120) |
| `synonyms` | string[] | per-offering search words; org-wide ones in `SearchSynonym` |
| `customFields` | map | |
| `source`, `channelId?` | | lineage |
| STF + `version` | | |

**OfferingVariant** (embedded): `variantId`, `name` (`"Default"` when the offering has no options), `optionValues` (`{ size: "XL" }`, `{ pack: "Loose" }`), `price: Money` (per sales unit), `compareAtPrice?: Money`, `sku?`, `barcode?`, `unitKey` (the sales unit, from the contracts unit registry: `PIECE`, `KG`, `LITRE`, …, ADR-098), `quantityRule? { min, step, max? }` (integers in the sales unit's precision; e.g. loose rice `{ min: 250, step: 250 }` grams), `stockComponents[{ inventoryItemId, quantity }]` (0 to 10; ADR-098), `status`.

- **Stock comes from inventory items, not from variants (ADR-098).** What a customer buys (a variant) and what sits on a shelf (an `InventoryItem`) are separate. A variant draws `quantity` (in the item's base unit) of each component per sales unit:
  - no components: nothing is stocked (a haircut, a membership, an untracked menu item)
  - one component × 1: a normal product with its own stock (the default when `catalog.defaultStockTracked` is on)
  - one component × N: packs and loose sale from one stock ("1 kg pack" draws 1000 g of the rice item; "Loose" draws 1000 g per kg sold)
  - several components: a kit or a recipe (gift box, burger), or a service that uses up products (20 ml of cream per facial)
  
  One level only: an inventory item is never an offering and has no components of its own. A variant's available quantity is the minimum over its components of `floor(available / quantity)`.
- Invariants: every offering has ≥ 1 variant, so order lines and bookings always reference `(offeringId, variantId)`, and stock movements reference `inventoryItemId`. `sku` unique per org when present. `kind` must be in the org's resolved `kinds`. A kind-specific field on the wrong kind is a validation error. Price edits never change existing requests (they snapshot).
- **OfferingLocation** (catalog, location scope): `offeringId`, `variantId?`, `locationId`, `isAvailable`, `priceOverride?: Money`. Unique `(organizationId, offeringId, variantId, locationId)`. No row = org defaults apply (ADR-005).
- **Category** (catalog, org): `categoryId`, `name`, `slug`, `parentCategoryId?` (max depth 3), `sortOrder`, `imageFileId?`.
- **ModifierGroup** (catalog, org, ADR-072): `modifierGroupId`, `name`, `selection` (`SINGLE | MULTIPLE`), `isRequired`, `minSelect`, `maxSelect`, `options[{ modifierOptionId, name, priceDelta: Money, status }]`. No stock of its own.
- **SearchSynonym** (catalog, org): `searchSynonymId`, `term`, `synonyms[]` (`08 §4`).
- **OfferingSocialLink** (catalog, org): `offeringSocialLinkId`, `offeringId`, `platform` (`FACEBOOK \| INSTAGRAM`), `externalPostId`, `externalAdId?`, `channelId`. Unique `(organizationId, platform, externalPostId)`.
- 3.2a notes (ADR-116): money is `{ amount, currency }`; `variants[].overrides` holds only the fields 11 section 2 lets the kind override; archived variants stay in the list with `status ARCHIVED`; variants without options differ by name; the stored `nameSearch` and `searchTerms` are folded copies for prefix search; the organization keeps one `SearchSynonymBook` (`search_synonyms`) and an `OfferingCounter` (`offering_counters`).
- Indexes: `{ organizationId, offeringId }` unique, `{ organizationId, slug }` unique, `{ organizationId, kind, status, updatedAt }`, `{ organizationId, "variants.sku" }` unique partial, `{ organizationId, "variants.barcode" }` partial, `{ organizationId, categoryIds }`.
- Events: `catalog.offering.created`, `.updated`, `.published` (DRAFT → ACTIVE), `.archived`, `.priceChanged`.

### 5.3b TaxClass and Promotion (module `pricing`, ADR-120)
Owner `commerce/pricing` · scope organization · versioned

**TaxClass:** `taxClassId`, `taxClassKey` (kebab, unique per org, ≤ 40), `name`, `rateBasisPoints` (integer; 750 = 7.5%; 0 allowed), `status` (`ACTIVE \| ARCHIVED`), STF + `version`. List ACTIVE by default. Quote refuses unknown or archived keys (`422 TAX_CLASS_UNKNOWN`). Setting `pricing.defaultTaxClassKey` (TEXT ≤ 40, default empty = 0%) applies when the offering has no class; settings write does not check existence.

**Promotion:** `promotionId`, `name`, `status` (`DRAFT \| ACTIVE \| ARCHIVED`), `priority` (higher first), `startsAt?`, `endsAt?`, `locationIds` (empty = all), `target` `{ scope: ALL \| KIND \| CATEGORY \| OFFERING \| VARIANT, ids[] }`, `benefit` `{ type: PERCENT \| AMOUNT_OFF \| FIXED_PRICE, value }` (PERCENT in basis points; others Money per sales unit), `minQuantity?`, `isStackable` (default false), `maxDiscountPerLine?: Money`, STF + `version`. Event: `pricing.promotion.changed`.

### 5.4 Resource
Owner `commerce/booking` · scope location · versioned · custom fields (entityType `resource`)
| Field | Type | Notes |
|---|---|---|
| `resourceId` | ResourceId | |
| `locationId` | LocationId | |
| `resourceTypeKey` | string | from the template's `resourceTypes` (data, not code) |
| `name` | string | "Chair 2", "Dr. Rahman", "Room 101" |
| `memberId` | MemberId? | when the resource is a staff person (stylist, doctor, trainer) |
| `capacity` | integer | 1 for a chair; 4 for a 4-bed room; seats for an event hall |
| `weeklySchedule` | `[{ weekday, opensAt, closesAt }]` | |
| `offeringIds` | OfferingId[] | which offerings this resource can serve |
| `status` | `ACTIVE \| INACTIVE` | |
| STF + `version` | | |

- **ResourceTimeOff** (booking, location): `resourceTimeOffId`, `resourceId`, `startsAt`, `endsAt`, `reason`.
- Invariants: `memberId` must be a member assigned to the same location (or ALL). Capacity ≥ 1. No double-booking beyond capacity, enforced in the booking write (card 3.6 picks the concurrency mechanism).
- Indexes: `{ organizationId, locationId, resourceTypeKey, status }`, `{ organizationId, memberId }`.
- Events: `booking.resource.created`, `.updated`, `.deactivated`.

### 5.5 Requests (ADR-044)
Three aggregates share one **request contract**: `requestType` (`ORDER \| BOOKING \| ENROLLMENT`), document number, `contactId`, `locationId`, `status`, money totals, `checkoutId?`, `source`, `conversationId?`. Status values and transitions: D3. All three are versioned, location-scoped and accept custom fields (`order`, `booking`, `enrollment`).

**Order** (`commerce/sales`)
| Field | Type | Notes |
|---|---|---|
| `orderId`, `orderNumber` | | number from sequence `ORDER` |
| `locationId` | LocationId | selling/fulfilling location (online orders: setting `sales.fulfillmentLocationId`, default location) |
| `contactId` | ContactId? | null only for an anonymous POS walk-in |
| `status` | `DRAFT | PLACED | CONFIRMED | PACKED | SHIPPED | DELIVERED | COMPLETED | DELIVERY_FAILED | RETURNED_TO_SENDER | CANCELLED` | lifecycle `11 §4` |
| `returnStatus` | `NONE | PARTIAL | FULL` | derived from SalesReturns |
| `approval` | `{ approverMemberId, approvedAt, action }?` | manager PIN (`11 §9`) |
| `lines` | `[{ orderLineId, offeringId, variantId, kind, nameSnapshot, quantity, unitPrice: Money, lineGross: Money, lineDiscount: Money, lineTax: Money, lineNetTotal: Money, unitCostSnapshot?: Money, modifiers?: [{ modifierGroupId, modifierOptionId, nameSnapshot, priceDelta }], returnedQuantity, performedByMemberId? }]` (money allocation rules: `11 §3`) | any kind (owner decision): a walk-in haircut + shampoo is one order |
| `totals` | `{ subtotal, discountTotal, taxTotal, deliveryCharge, grandTotal }` (Money) | computed server-side, never trusted from the client |
| `fulfillment` | `{ method: INSTANT \| PICKUP \| COURIER \| OWN_RIDER, deliveryAddress?: AddressSnapshot, consignmentId?, riderMemberId? }` | |
| `paymentStatus` | `UNPAID \| PARTIAL \| PAID \| REFUNDED` | derived from payment allocations |
| `businessDate` | string | |
| `checkoutId`, `source`, `channelId?`, `conversationId?`, `customFields`, STF + `version` | | |

- Invariants: ≥ 1 line. A line with a kind that needs time or capacity (RENTAL, EVENT, or a SERVICE with a required resource/slot) is refused: those go to a Booking. Lines whose variant has stock components create one stock movement per component in the same transaction as the state change that commits stock (D3 says which). Totals are recomputed on every change.

**Booking** (`commerce/booking`)
| Field | Type | Notes |
|---|---|---|
| `bookingId`, `bookingNumber` | | sequence `BOOKING` |
| `locationId`, `contactId` | | contact required |
| `offeringId`, `variantId`, `kind` | | kind ∈ `SERVICE`, `RENTAL`, `EVENT` |
| `eventSessionId` | EventSessionId? | EVENT kind only |
| `depositRequired` | Money | from the deposit rule at creation (`11 §5.4`) |
| `startsAt`, `endsAt` | Date (UTC) | |
| `resourceIds` | ResourceId[] | |
| `providerMemberId` | MemberId? | |
| `quantity` | integer | seats / beds / party size |
| `price` | `{ unitPrice, total }` Money | snapshot |
| `status`, `checkoutId`, `source`, `conversationId?`, `customFields`, STF + `version` | | |

- Invariants: `endsAt > startsAt`. Within resource capacity and schedule, outside time-off. Rescheduling is a state change with the same checks.

**Enrollment** (`commerce/enrollment`, see ADR-047 for the module key)
| Field | Type | Notes |
|---|---|---|
| `enrollmentId`, `enrollmentNumber` | | sequence `ENROLLMENT` |
| `locationId`, `contactId` | | `contactId` = the enrolled person |
| `billToContactId` | ContactId? | payer when different (guardian) |
| `offeringId`, `variantId` | | kind `PLAN` |
| `resourceIds` | ResourceId[]? | assigned bed/locker, capacity-checked (ADR-074) |
| `securityDepositHeld` | Money? | refundable advance (ADR-074) |
| `startsOn`, `endsOn?` | business dates | |
| `currentEnrollmentPeriodId` | EnrollmentPeriodId? | periods are `EnrollmentPeriod` records (`11 §8.2`) |
| `autoRenew` | boolean | |
| `sessionsRemaining` | integer? | for session-count plans |
| `status`, `checkoutId`, `source`, `customFields`, STF + `version` | | |

- **CheckIn** (`commerce/enrollment`, location, append-only): `checkInId`, `contactId`, `enrollmentId?`, `bookingId?`, `checkedInAt`, `method` (`STAFF \| QR \| DEVICE`), `recordedByUserId`.
- Invariants: plan capacity is not exceeded. Periods never overlap. A renewal creates the next period; it never edits a past one.

Indexes for all three: `{ organizationId, <request>Id }` unique, `{ organizationId, <request>Number }` unique, `{ organizationId, locationId, status, createdAt }`, `{ organizationId, contactId, createdAt }`, `{ organizationId, checkoutId }` partial. Booking also `{ organizationId, resourceIds, startsAt }`.
Events: `sales.order.*`, `booking.booking.*`, `enrollment.enrollment.*` with the verbs defined in D3 (`created`, `confirmed`, `cancelled`, `completed`, …).

### 5.6 Money, stock and accounting
Details belong to cards 3.3, 3.5 and 3.8; the shape is fixed here.

| Entity | Owner | Scope | Key fields | Invariants |
|---|---|---|---|---|
| **Payment** (ADR-123) | `commerce/payment` | location | `paymentId`, `paymentNumber` (sequence `PAYMENT`), `direction` (`IN \| REFUND \| REVERSAL`), `method` (`CASH`, `BKASH`, `NAGAD`, `CARD`, `BANK`, `GATEWAY`, `STORE_CREDIT`, `COD_COURIER`, `RIDER_CASH`), `amount: Money`, `externalReference?` (unique per org + method), `reversesPaymentId?` (unique per org when set), `posSessionId?`, `allocations[{ requestType, requestId, enrollmentPeriodId?, amount: Money, revenueState? }]`, `contactId?`, `receivedByMemberId`, `approvalId?` (`approvalTokenId`), `businessDate` (org timezone) | Append-only: corrections are a REFUND (`POST /refunds`) or a REVERSAL (`POST /payments/{paymentId}/reverse`), never an edit. Sum of allocations ≤ amount. Requires `Idempotency-Key`. |
| **InventoryItem** (ADR-098, ADR-125) | `commerce/inventory` | org | `inventoryItemId`, `name`, `sku?`, `barcode?`, `baseUnitKey` (contracts unit registry), `lowStockThreshold?`, `status` (`ACTIVE \| ARCHIVED`), STF + `version` | What is stocked. Created with a product (one item per variant by default) or on its own (shared stock, ingredients). `baseUnitKey` is immutable once a movement exists. Archived, never deleted, while movements reference it. |
| **StockMovement** | `commerce/inventory` | location | `stockMovementId`, `inventoryItemId`, `quantityDelta` (integer, base unit precision), `offeringId?` + `variantId?` (the sold variant, for reports), `stockState` (`SELLABLE | DAMAGED`), `reason` (`PURCHASE`, `SALE`, `RETURN`, `RETURN_DAMAGED`, `DAMAGE_WRITE_OFF`, `ADJUSTMENT`, `TRANSFER_OUT`, `TRANSFER_IN`, `OPENING`), `sourceType`, `sourceId`, `reversesStockMovementId?`, `unitCost?: Money`, `occurredAt`, `businessDate` | Append-only (ADR-014). One movement per stock component of a sold line (ADR-098). A transfer is two movements in one transaction. |
| **InventoryLevel** | `commerce/inventory` | location | `inventoryItemId`, `onHand`, `reserved`, `damaged`, `available` (= onHand − reserved), `averageUnitCostMicros` (minor × 10000 per base unit; ADR-069/125), `version` | Projection; rebuildable from movements. API exposes `averageUnitCost` and `inventoryValue` Money (half-up from micros). Unique `(organizationId, locationId, inventoryItemId)`. |
| **Account** | `commerce/accounting` | org | `accountId`, `accountCode`, `name`, `accountType` (`ASSET \| LIABILITY \| EQUITY \| INCOME \| EXPENSE`), `isSystem`, `status` | System accounts seeded per org by code (`SYSTEM_ACCOUNT_CODE`, ADR-124); never edited or deleted. |
| **JournalEntry** | `commerce/accounting` | org (+ `locationId?`) | `journalEntryId`, `entryNumber`, `businessDate`, `lines[{ accountId, debit: Money, credit: Money }]`, `sourceType`, `sourceId`, `postingKey`, `reversesJournalEntryId?` | Debits = credits. Append-only; unique `(organizationId, sourceType, sourceId, postingKey)`. Fixed with a reversing entry. |
| **Expense** | `commerce/expense` | location | `expenseId`, `expenseNumber` (sequence `EXPENSE`), `expenseCategoryId`, `amount: Money`, `paidVia` (`CASH`, `BKASH`, `NAGAD`, `BANK`, `CARD`), `businessDate`, `note?`, `attachmentFileIds[]` (purpose `ATTACHMENT`, ≤ 5), `status` (`POSTED \| VOIDED`), custom fields (entityType `expense`) | Create posts via the accounting ORDERED handler; void emits the reversing event. |
| **ExpenseCategory** | `commerce/expense` | org | `expenseCategoryId`, `name`, `accountId` (an EXPENSE account), `status`, `isSystem` | Seeded per org (rent, salary, utilities, delivery, marketing, other); archive, never delete. |

### 5.6b Entities added by D3 (details and rules in `11`)
| Entity | Owner | Scope | Key fields |
|---|---|---|---|
| **SalesReturn** | `commerce/sales` | location, append-only | `salesReturnId`, `salesReturnNumber`, `orderId`, `contactId?`, `lines[{ orderLineId, quantity, disposition, refundAmount }]`, `refundDeliveryCharge`, `refund { method, amount }`, `reasonKey`, `approval?`, `status` (`ACTIVE | REVERSED`), `reversedBySalesReturnId?`, `exchangeOrderId?`, `businessDate` (`11 §6`) |
| **StoreCreditEntry** (ADR-123) | `commerce/payment` | org, append-only | `storeCreditEntryId`, `contactId`, `kind` (`PAYMENT_OVERPAYMENT \| PAYMENT_USE \| PAYMENT_REFUND \| PAYMENT_REVERSAL \| CANCELLATION \| MANUAL_ADJUSTMENT \| EXPIRY`), `direction` (`CREDIT \| DEBIT`), `amount: Money`, `balanceAfterMinor`, `paymentId?`, `approvalId?`, `expiresAt?`, `expiresStoreCreditEntryId?` (unique per org when set), `note?`, `businessDate` (`11 §7.2`) |
| **PaymentSummary** (ADR-123) | `commerce/payment` | location | `paymentSummaryId`, `requestType`, `requestId`, `contactId?`, `locationId`, `total: Money`, `allocated: Money`, `refunded: Money`, `paymentStatus` (`UNPAID \| PARTIAL \| PAID \| REFUNDED`, derived) |
| **EnrollmentPeriod** | `commerce/enrollment` | location | `enrollmentPeriodId`, `enrollmentId`, `periodNumber`, `periodStartsOn`, `periodEndsOn`, `fee`, `sessionsAllowed?`, `sessionsUsed`, `status` (`11 §8.2`) |
| **EventSession** | `commerce/booking` | location | `eventSessionId`, `offeringId`, `startsAt`, `endsAt`, `capacity`, `resourceIds[]`, `status` (`11 §2, §5.5`) |
| **CourierSettlement** | `integration/courier` | org | `courierSettlementId`, `courierKey`, `paymentIds[]`, `grossAmount`, `courierCharges`, `netReceived`, `receivedVia`, `businessDate` (`11 §7.3`) |
| **RiderCashHandover** | `commerce/delivery` | location | `riderCashHandoverId`, `riderMemberId`, `paymentIds[]`, `amount`, `receivedByMemberId`, `businessDate` (`11 §7.3`) |

### 5.7 Channels and fulfilment (Phase 5, shape only)
| Entity | Owner (final in D2) | Scope | Key fields |
|---|---|---|---|
| **Channel** | `channel/messaging` | org | `channelId`, `channelType` (`FACEBOOK_PAGE`, `INSTAGRAM`, `WHATSAPP`, `WEB_WIDGET`), `externalAccountId` (unique per platform, routes webhooks → org), `credentialRef` (encrypted), `status`, `botEnabled` |
| **Conversation** | `channel/messaging` | org | `conversationId`, `channelId`, `contactId?`, `externalThreadId`, `assignedMemberId?`, `botState` (structured, `08 §3`), `isBotPaused`, `lastMessageAt`, `serviceWindowEndsAt` |
| **Message** | `channel/messaging` | org | `messageId`, `conversationId`, `direction`, `externalMessageId` (dedupe), `body`, `attachments`, `sentByMemberId?`, `isFromBot`, `occurredAt` |
| **Consignment** | `integration/courier` | location | `consignmentId`, `orderId`, `courierKey`, `trackingCode`, `status`, `codAmount: Money`, `charges: Money` |
| **KnowledgeEntry** (D2) | `channel/bot` | org (+ `locationId?`) | `knowledgeEntryId`, `topicKey` (`DELIVERY`, `RETURNS`, `PAYMENT`, `HOURS`, `LOCATION`, `CUSTOM`), `question?`, `answer` (`{ bn?, en? }`), `status` (`ACTIVE \| ARCHIVED`). Source of the bot's `get_policy` tool together with settings. |

### 5.8 Technical records (kernel, listed so names stay fixed)
- **Sequence** (`kernel/sequence`): `{ organizationId, sequenceKey, nextValue }` (`nextValue` holds the **last** number handed out; the first call returns 1), unique `(organizationId, sequenceKey)`. Keys: `ORDER`, `BOOKING`, `ENROLLMENT`, `PAYMENT`, `INVOICE`, `JOURNAL`, `MEMBER`, `EXPENSE`, `TRANSFER`, `ZREPORT`, `RETURN`, `CUSTOM_ACCOUNT` (3.8b custom account `C-n` codes). Each key has a mode (ADR-085): `FAST` (default) is taken outside the transaction, never conflicts and may leave gaps when a transaction aborts; `GAPLESS` (`INVOICE`, `JOURNAL`, `ZREPORT`) rolls back with the transaction and needs one. The system-access mark is read with `getSystemReason()`, it is not a field of the request context. Format (prefix, padding, yearly reset) comes from settings.
- **OutboxEvent** (`kernel/events`): `{ eventId, type, version, occurredAt, organizationId (null for user-level events), actorUserId, requestId, payload, status PENDING|DISPATCHED|DEAD, dispatchAttempts, nextAttemptAt, lockedUntil, dispatchedAt, lastError }` in the platform DB (`05` envelope, ADR-090). After ten failed dispatches the status becomes `DEAD` and the event is not claimed again (ADR-096). Siblings: `processed_events` `{ eventId, handlerKey }` unique, `event_dead_letters` `{ eventId, handlerKey, type, attempts, lastError, failedAt }`.
- **Event streams** (`kernel/events`, platform DB, tenancy NONE, card 3.8a, ADR-115): **EventStream** `{ eventStreamId, organizationId, orderingKey, lastSequence }`, unique `(organizationId, orderingKey)`, incremented in the publishing transaction; **EventStreamPosition** `{ eventStreamPositionId, handlerKey, organizationId, orderingKey, lastSequence }`, unique `(handlerKey, organizationId, orderingKey)`, moved in the handler's own transaction. The OutboxEvent gains `orderingKey` and `streamSequence` (null without a key) and the index `{ status, nextAttemptAt, streamSequence }`; the **EventDeadLetter** gains `organizationId`, `status` (FAILED|REPLAY_REQUESTED|REPLAYED|SKIPPED), `orderingKey`, `streamSequence`, `resolvedAt`, `resolvedByPlatformOperatorId`, `resolutionReason` and `requeuedAt`.
- **IdempotencyRecord** (`kernel/idempotency`, platform DB, tenancy NONE): `{ idempotencyRecordId, scopeKind (ORGANIZATION|USER), scopeId, idempotencyKey, requestHash, status (IN_PROGRESS|COMPLETED), lockedUntil, responseStatus?, responseBody?, expiresAt }`, unique `(scopeKind, scopeId, idempotencyKey)` (ADR-089).
- **AuditLog** (`core/audit`, tenant DB): `{ auditLogId, organizationId, actorUserId?, actorMemberId?, action, entityType, entityId, changes, requestId, systemReason?, occurredAt }`. Append-only. **PlatformAuditLog** (platform DB): `{ platformAuditLogId, actorPlatformOperatorId, actorUserId, action, targetType, targetId, organizationId?, changes, reason?, requestId, occurredAt }`. Append-only. They are two models, not one shape stored twice.
- **FileAsset** (`core/file`, tenant DB, `file_assets`, ADR-109): `{ fileId, organizationId, purpose (LOGO|OFFERING_IMAGE|CUSTOM_FIELD_IMAGE|CUSTOM_FIELD_FILE|ATTACHMENT), visibility (PUBLIC|PRIVATE, derived from the purpose), mimeType, byteSize (sum of the variants), originalName (sanitized, display only), storageKey (`org/{organizationId}/{fileId}`), variants[{ variantKey (thumb|medium|large|document), byteSize, width?, height? }], status (ACTIVE|DELETED), version, audit fields }`. A per-organization counter `FileUsage { fileUsageId, organizationId, usedBytes }` holds the interim 1 GiB quota.

---

## 6. Ownership map

| Module (path) | Entities it owns (only it writes them) |
|---|---|
| `core/iam` | User, RefreshSession, PlatformOperator, Role |
| `core/organization` | Organization, OrganizationSlugHistory, Location, Member, Invitation |
| `core/custom-field` | CustomFieldDefinition |
| `core/settings` | SettingValue, TermOverride |
| `core/audit`, `core/file` | AuditLog, FileAsset |
| `platform/industry` | IndustryTemplate |
| `platform/package` | Package |
| `platform/entitlement` | ModuleOverride, `resolveOrgConfig` |
| `platform/saas-billing` | PlatformSubscription (+ platform invoices, card 6.2) |
| `platform/operations` | nothing of its own (acts on the event kernel's dead letters and outbox, ADR-115) |
| `commerce/contact` | Contact, CustomerAccount, CustomerSession |
| `commerce/catalog` | Offering, OfferingLocation, Category, ModifierGroup, SearchSynonym, OfferingSocialLink |
| `commerce/inventory` | InventoryItem, StockMovement, InventoryLevel, StockReservation |
| `commerce/sales` | Order, SalesReturn |
| `commerce/booking` | Resource, ResourceTimeOff, Booking, EventSession |
| `commerce/enrollment` | Enrollment, EnrollmentPeriod, CheckIn |
| `commerce/payment` | Payment, StoreCreditEntry, PaymentSummary |
| `commerce/accounting` | Account, JournalEntry |
| `commerce/expense` | Expense, ExpenseCategory |
| `commerce/delivery` | rider delivery assignments (card 5.3), RiderCashHandover |
| `channel/messaging` | Channel, Conversation, Message |
| `channel/bot` | KnowledgeEntry |
| `channel/website` | Site, Page, Theme, Domain, WebsiteTemplate (cards 4.1–4.5) |
| `integration/courier` | Consignment, CourierSettlement |

Full module list, classes and manifests: `10-MODULE-CATALOG.md`.

Other modules read these through the owner's `index.ts` or react to its events. Nobody else writes them.

---

## 7. Cross-entity invariants (checked by tests in the named card)
1. Creating an org yields 1 org + 1 default location + system roles + 1 owner member, atomically (1.2).
2. A member can never read or write data of an org without an ACTIVE membership, nor of a location outside their assignments (1.3).
3. Every reference (`contactId`, `offeringId`, `resourceId`, `memberId` …) points to an entity of the **same** organization (1.3 + each module's tests).
4. A request copies names, prices and addresses at creation; later catalog/contact edits never change it (3.5–3.7).
5. Money and stock change only through append-only records written in the same transaction as the request state change (3.3, 3.5, 3.8).
6. Turning a module off hides its entities from the API, menu, bot and storefront, but never deletes data (1.6).
7. Changing the industry template never deletes definitions, values or records (2.2).

---

## 8. Decisions made in this card
Owner-decided (2026-10-09) and recorded as **Accepted**; the rest are **Accepted (proposed)** in `04-DECISIONS.md`.

| ADR | Decision | Status |
|---|---|---|
| ADR-043 | Platform DB = identity, access, configuration (User, Organization, Location, Member, Role, Invitation, templates, packages, subscriptions, overrides, field definitions, settings, terms). Tenant DB = business records. Extends ADR-023. | Accepted (proposed) |
| ADR-044 | Requests are three aggregates: Order, Booking (SERVICE/RENTAL/EVENT; "Reservation"/"Ticket" are terms), Enrollment (PLAN). Order lines may hold any kind for an immediate sale; time/capacity needs a Booking. Multi-request checkout = shared `checkoutId` + payment allocations, not a Checkout aggregate. | Accepted (owner: order lines any kind) + proposed (rest) |
| ADR-045 | Storefront/portal login = per-org `CustomerAccount` linked to a Contact (phone OTP), separate cookie and token audience, never a User. Supersedes the line in `05` "A contact may link `userId`". | Accepted (owner asked for the scalable, secure option) |
| ADR-046 | No global Person profile: User holds login identity only; staff profile lives on Member + custom fields. Ownership = `Organization.ownerUserId` + OWNER member, no Ownership entity. Industry template changes only by a platform operator, additively. | Accepted (owner) |
| ADR-047 | Names: SaaS sells **Packages** (`platform/package`, `PlatformSubscription`); the PLAN-kind module is **`enrollment`** (not "subscription", not "membership"). Every offering has ≥ 1 variant. Quantities are integers in unit precision. | Accepted (proposed) |
| ADR-048 | Platform panel access is a separate `PlatformOperator` record with its own cookie and audience, not a flag on User. | Accepted (proposed) |

**Docs synced with this model (owner approved, 2026-10-09, branch `s/D1-doc-sync`):**
- `01 §2`: `platform/plan` → `platform/package`; `capability/appointment, membership` → core `commerce/booking`, `commerce/enrollment` (ADR-034 already says they are core).
- `05` "Contact master": the `userId` link sentence → ADR-045.
- `03` card 3.7 "Subscription core" → "Enrollment core"; `ProductSocialLink` → `OfferingSocialLink` in `03` and `06`; `07 §4` module `subscription` → `enrollment`. ADR-026 text is left as history; ADR-047 sets the new name.

## 9. Owner answers (2026-10-09)
- **Q1. Fractional quantities:** yes, in Phase 3. POS supports weight/volume entry (kg, litre) using integer quantities in unit precision (ADR-047).
- **Q2. Shared family phone:** the guardian's contact holds the phone; the child is a contact without a phone, linked by `GUARDIAN_OF`. `phoneE164` stays unique per org.
- **Q3. Contact roles:** `CUSTOMER | SUPPLIER | LEAD | RELATED` (RELATED added by card 3.1c, ADR-113). New roles are added to the contracts enum when needed.
- **Q4. Location types:** `STORE | WAREHOUSE` is enough. An online-only seller's default location is a STORE that simply has no POS device.
