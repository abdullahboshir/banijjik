# Industry Templates

Card D4 · Status: **approved by owner 2026-10-09** · Written 2026-10-09 · Based on `main` at `dd2c9af`

This doc defines the 8 seed industry templates as **data**. It also proves that none of them needs industry-specific code beyond the offering kinds and the reusable capability modules. Card 2.1 seeds these templates exactly as written here. Card 2.3 builds the field engine that reads them. Changing a template later is a platform-panel action, not a code change (ADR-046, ADR-076).

Inputs:
- `07` (capability model), `09 §4.6` (IndustryTemplate, CustomFieldDefinition), `10` (modules), `11` (kinds, lifecycles, settings), `08` (bot), `13 §7` (terms, locale)
- Manoxen industry config (`packages/contracts/src/constants/industry/industry-capabilities.ts`) and the old banijjik blueprint (archive), reviewed for field ideas only

Owner answer (2026-10-09): **published at launch = FCOMMERCE and RETAIL.** The other six are DRAFT, assignable to pilot orgs by a platform operator, and published later with one action. **Amended 2026-10-14 (ADR-099):** the launch focus is SALON, GYM and COACHING; an operator publishes them after their template data is reviewed with pilot businesses (P3). FCOMMERCE and RETAIL stay published; RESTAURANT is the second wave.

New decisions: §6 (ADR-072 to ADR-076).

---

## 1. Template schema (what card 2.1 stores)

```ts
interface IndustryTemplateSeed {
  industryTemplateKey: string;              // FCOMMERCE, RETAIL, …
  status: "DRAFT" | "PUBLISHED" | "RETIRED";
  name: { bn: string; en: string };
  description: { bn: string; en: string };  // one line for the signup card
  iconKey: string;                          // lucide icon name
  enabledKinds: OfferingKind[];
  allowedModuleKeys: ModuleKey[];           // CORE/OPTIONAL modules that fit; SYSTEM always on
  contactRoleKeys: ContactRole[];           // CUSTOMER, SUPPLIER, LEAD, RELATED (a template with a contact link lists RELATED)
  relationKeys: string[];                   // GUARDIAN_OF, …
  resourceTypes: { resourceTypeKey: string; termKey: string; isMember: boolean }[];
  terms: Record<TermKey, { bn: string; en: string }>;
  customFields: CustomFieldSeed[];          // §1.1
  settingsDefaults: Record<SettingKey, unknown>;
  modifierGroupsSeed?: ModifierGroupSeed[]; // examples the tenant can edit (ADR-072)
  knowledgeSeed: { topicKey: string; answer: { bn: string; en: string } }[]; // editable starters
  websiteTemplateKeys: string[];            // built in Phase 4; names reserved here
  botDefaults: { personaKey: string; handoffTopics: string[] };
}
```

### 1.1 Custom field seed shorthand
A `contact` field may carry `appliesToContactRoles` (non-empty, absent = every role; ADR-113). Seed values (card 3.1c): COACHING contact fields `["CUSTOMER","LEAD"]`, roles + `RELATED`, `SUPPLIER`, term `contact.RELATED` Guardian; GYM `["CUSTOMER","LEAD"]`, + `RELATED`, `SUPPLIER`, term Emergency contact; CLINIC `["CUSTOMER"]`, + `RELATED`, `SUPPLIER`, term Relative; SALON `["CUSTOMER"]`, + `RELATED`; HOSTEL `["CUSTOMER"]`, + `RELATED`, term Guardian; RETAIL `customer_type` `["CUSTOMER"]`.
Tables below use: **Entity** (`contact`, `offering`+kind, `order`, `booking`, `enrollment`, `member`, `resource`) · **Key** · **Type** (16 types, `01 §5`) · **Req** (required) · **Bot** (`botAsk`: the bot collects it before `create_request`) · **Vis** (visibility: A = admin, S = storefront form, B = bot can read/say it) · **Flags** (`search` = searchable, `sens` = sensitive, permission-gated) · **Options**.

Core fields (name, phone, address, price, variants, times…) are **not** listed. They exist for every template.

### 1.2 Common seed for every template
- **Terms (defaults; templates override):**

  | termKey | bn | en |
  |---|---|---|
  | `contact` (sg/pl) | গ্রাহক / গ্রাহকরা | Customer / Customers |
  | `offering` | পণ্য | Product |
  | `order` | অর্ডার | Order |
  | `booking` | বুকিং | Booking |
  | `enrollment` | ভর্তি | Enrollment |
  | `resource` | রিসোর্স | Resource |
  | `location` | শাখা | Branch |

- **Knowledge starters (seller edits):**
  - `DELIVERY`: delivery areas, time, charge
  - `PAYMENT`: methods, COD, bKash number
  - `RETURNS`: policy
  - `HOURS`
  - `LOCATION`
- **Bot handoff topics (always):** refund/complaint, angry customer, request for a human, anything not grounded (`08 §5`).
- **Settings:** `organization.digitScript=LATIN`, `organization.numberGrouping=WESTERN`, `sales.returnWindowDays=7`, `sales.advance.required=NONE`, `booking.deposit.required=NONE`, `enrollment.refundPolicy=NONE`.

## 2. Published at launch

### 2.1 FCOMMERCE: অনলাইন বিক্রেতা / Online seller (F-commerce)
`status: PUBLISHED` · icon `shopping-bag` · kinds `PRODUCT` · roles `CUSTOMER, LEAD, SUPPLIER`
- **Description:** bn "ফেসবুক/অনলাইনে পণ্য বিক্রি, কুরিয়ারে ডেলিভারি" · en "Sell online and on Facebook, deliver by courier"
- **Allowed modules:** contact, catalog, inventory, pricing, sales, payment, expense, report, delivery, courier, sms, risk, pos, website, payment-gateway, messaging, bot, social, workflow, bookkeeping
- **Terms:** defaults (গ্রাহক, পণ্য, অর্ডার)

| Entity | Key | Type | Req | Bot | Vis | Flags | Options |
|---|---|---|---|---|---|---|---|
| offering(PRODUCT) | `material` | TEXT | – | – | A S B | search | |
| offering(PRODUCT) | `size_chart` | IMAGE | – | – | A S B | | |
| offering(PRODUCT) | `care_instructions` | LONG_TEXT | – | – | A S B | | |
| order | `preferred_delivery_time` | SELECT | – | – | A S B | | MORNING, AFTERNOON, EVENING, ANY |
| order | `gift_note` | LONG_TEXT | – | – | A S | | |

- **Settings:**
  - `sales.usePacking=true`
  - `sales.returnWindowDays=3`
  - `sales.deliveryCharges={ zones: [{ key: "INSIDE_DHAKA", charge: 7000 }, { key: "OUTSIDE_DHAKA", charge: 13000 }] }` (minor units)
  - `courier.autoBookOnConfirm=false`
  - `bot.tone=FRIENDLY`
  - `social.autoDraftFromPosts=true`
  - `risk.holdThreshold=HIGH`
- **Modifiers seed:** "Gift wrap" (+৳ 50, optional)
- **Website templates:** `fashion-boutique`, `gadget-store`, `home-living`, `general-online`
- **Bot:** persona `FRIENDLY_SELLER` ("আপু/ভাইয়া" tone, short replies). Intake = core (name, phone, address, area). Extra handoff topic: wholesale/bulk price requests.

### 2.2 RETAIL: দোকান / Retail shop
`status: PUBLISHED` · icon `store` · kinds `PRODUCT` · roles `CUSTOMER, SUPPLIER, LEAD`
- **Description:** bn "দোকানে বিক্রি, স্টক ও হিসাব" · en "Shop counter sales, stock and accounts"
- **Allowed modules:** same as FCOMMERCE
- **Terms:** `order` → বিক্রি / Sale

| Entity | Key | Type | Req | Bot | Vis | Flags | Options |
|---|---|---|---|---|---|---|---|
| offering(PRODUCT) | `brand` | TEXT | – | – | A S B | search | |
| offering(PRODUCT) | `warranty_months` | NUMBER | – | – | A S B | | |
| contact | `customer_type` | SELECT | – | – | A | | RETAIL, WHOLESALE |

- **Settings:**
  - `pos.requireShift=true`
  - `pos.allowCreditSale=true`
  - `inventory.lowStockDefault=5`
  - `sales.returnWindowDays=7`
  - `catalog.defaultUnitKey=PIECE`
  - `bot.tone=POLITE`
- **Website templates:** `grocery`, `pharmacy-shop` (no Rx features), `general-store`
- **Bot:** persona `POLITE_SHOPKEEPER`. Extra handoff topic: credit (বাকি) requests.

## 3. Draft at launch (assignable to pilots)

### 3.1 SALON: সেলুন ও পার্লার / Salon & beauty parlour
`status: DRAFT` · icon `scissors` · kinds `SERVICE, PRODUCT` · roles `CUSTOMER, SUPPLIER`
- **Allowed modules:** FCOMMERCE list + booking
- **Resource types:** `STYLIST` (member, term স্টাইলিস্ট/Stylist), `CHAIR` (চেয়ার/Chair)
- **Terms:** contact ক্লায়েন্ট/Client · offering(SERVICE) সার্ভিস/Service · booking অ্যাপয়েন্টমেন্ট/Appointment · resource স্টাইলিস্ট/Stylist

| Entity | Key | Type | Req | Bot | Vis | Flags | Options |
|---|---|---|---|---|---|---|---|
| contact | `skin_type` | SELECT | – | – | A | | NORMAL, OILY, DRY, SENSITIVE |
| contact | `hair_type` | SELECT | – | – | A | | STRAIGHT, WAVY, CURLY |
| contact | `allergies` | LONG_TEXT | – | – | A | sens | |
| contact | `preferred_stylist` | REFERENCE(member) | – | – | A B | | |
| booking | `special_request` | LONG_TEXT | – | – | A S B | | |

- **Settings:** `booking.slotStepMinutes=15`, `booking.minNoticeMinutes=60`, `booking.freeCancelHours=4`, `booking.reminderLeadMinutes=120`, `booking.requireApproval=false`
- **Modifiers seed:** "Hair wash" (+৳ 100), "Premium products" (+৳ 300)
- **Website templates:** `salon-classic`, `parlour-elegant`
- **Bot:** persona `CARING_STYLIST`. Books slots via `check_availability`; asks for a preferred stylist only when more than one serves the service.

### 3.2 CLINIC: ক্লিনিক ও চেম্বার / Clinic & doctor's chamber
`status: DRAFT` · icon `stethoscope` · kinds `SERVICE` · roles `CUSTOMER` · relations `GUARDIAN_OF`
- **Allowed modules:** contact, catalog, pricing, booking, payment, expense, report, sms, website, payment-gateway, messaging, bot, workflow, bookkeeping, (`clinical` capability in Phase 7)
- **Resource types:** `DOCTOR` (member), `ROOM`
- **Terms:** contact রোগী/Patient · offering(SERVICE) সেবা/Consultation · booking সিরিয়াল/Appointment · resource ডাক্তার/Doctor

| Entity | Key | Type | Req | Bot | Vis | Flags | Options |
|---|---|---|---|---|---|---|---|
| contact | `age_years` | NUMBER | yes | yes | A B | | |
| contact | `gender` | SELECT | – | yes | A B | | FEMALE, MALE, OTHER |
| contact | `blood_group` | SELECT | – | – | A | sens | A+, A−, B+, B−, AB+, AB−, O+, O− |
| contact | `allergies` | LONG_TEXT | – | – | A | sens | |
| contact | `chronic_conditions` | LONG_TEXT | – | – | A | sens | |
| booking | `visit_type` | SELECT | yes | yes | A S B | | NEW, FOLLOW_UP, REPORT_SHOW |
| booking | `symptoms` | LONG_TEXT | – | yes | A S | sens | (bot may collect, never interprets) |

- **Settings:** `booking.requireApproval=true`, `booking.slotStepMinutes=10`, `booking.noShowAfterMinutes=20`, `booking.reminderLeadMinutes=180`
- **Website templates:** `clinic-trust`, `doctor-chamber`
- **Bot:** persona `CALM_RECEPTIONIST`. **Extra handoff topics: any medical advice, diagnosis, medicine or dosage question.** The bot only books, shares fees/timings and collects intake.

### 3.3 GYM: জিম ও ফিটনেস / Gym & fitness
`status: DRAFT` · icon `dumbbell` · kinds `PLAN, SERVICE, PRODUCT` · roles `CUSTOMER, LEAD`
- **Allowed modules:** FCOMMERCE list + booking, enrollment
- **Resource types:** `TRAINER` (member), `LOCKER`, `STUDIO`
- **Terms:** contact মেম্বার/Member · offering(PLAN) মেম্বারশিপ প্ল্যান/Membership plan · enrollment মেম্বারশিপ/Membership · booking সেশন/Session

| Entity | Key | Type | Req | Bot | Vis | Flags | Options |
|---|---|---|---|---|---|---|---|
| contact | `weight_kg` | DECIMAL | – | – | A | | |
| contact | `height_cm` | NUMBER | – | – | A | | |
| contact | `fitness_goal` | SELECT | – | yes | A B | | WEIGHT_LOSS, MUSCLE_GAIN, GENERAL_FITNESS, REHAB |
| contact | `emergency_contact` | PHONE | yes | yes | A | | |
| contact | `medical_notes` | LONG_TEXT | – | – | A | sens | |
| enrollment | `preferred_trainer` | REFERENCE(member) | – | – | A B | | |

- **PLAN defaults:** `autoRenewDefault=true`, `freezeAllowed=true`, `maxFreezeDaysPerYear=30`, `admissionFee` set per plan
- **Settings:** `enrollment.graceDays=5`, `enrollment.blockCheckInWhenOverdue=true`, `enrollment.renewalReminderDays=3`, `enrollment.requirePaymentToActivate=true`
- **Website templates:** `gym-power`, `yoga-calm`
- **Bot:** persona `ENERGETIC_COACH`. Sells plans (`get_plan_terms`), books trainer sessions. Extra handoff topics: injury and medical questions.

### 3.4 COACHING: কোচিং ও প্রশিক্ষণ / Coaching & training centre
`status: DRAFT` · icon `graduation-cap` · kinds `PLAN, EVENT` · roles `CUSTOMER, LEAD` · relations `GUARDIAN_OF`
- **Allowed modules:** contact, catalog, pricing, enrollment, booking (for EVENT), payment, expense, report, sms, website, payment-gateway, messaging, bot, workflow, bookkeeping, (`academic` capability in Phase 7)
- **Resource types:** `TEACHER` (member), `CLASSROOM`
- **Terms:** contact ছাত্র-ছাত্রী/Student · offering(PLAN) কোর্স/ব্যাচ / Course · enrollment ভর্তি/Admission · offering(EVENT) ক্লাস/পরীক্ষা / Class or exam · booking আসন/Seat

| Entity | Key | Type | Req | Bot | Vis | Flags | Options |
|---|---|---|---|---|---|---|---|
| contact | `class_level` | SELECT | yes | yes | A S B | | CLASS_1 … CLASS_10, SSC, HSC, ADMISSION, OTHER |
| contact | `study_group` | SELECT | – | yes | A S B | | SCIENCE, COMMERCE, ARTS, GENERAL |
| contact | `school_name` | TEXT | – | yes | A S | search | |
| contact | `guardian` | REFERENCE(contact) **contact-link** | yes | yes | A S | | relation `GUARDIAN_OF`, create or link by phone (ADR-073) |
| enrollment | `roll_number` | TEXT | – | – | A | search | |
| enrollment | `academic_session` | TEXT | – | – | A | | e.g. 2026-27 |

- **PLAN defaults:** `billingPeriod=MONTH×1`, `startRule=FIXED_DATES` (batch starts), `admissionFee` per course, `autoRenewDefault=true`, `freezeAllowed=false`, `capacity` = batch seats
- **Settings:** `enrollment.graceDays=10`, `enrollment.blockCheckInWhenOverdue=false`, `enrollment.refundPolicy=NONE`
- **Billing to guardian:** when a `guardian` link exists, `Enrollment.billToContactId` defaults to the guardian (generic rule of the contact-link field, ADR-073)
- **Website templates:** `coaching-bright`, `academy-classic`
- **Bot:** persona `HELPFUL_ADMISSION_DESK`. Collects student and guardian, shows batch seats and start dates. Extra handoff topic: exam result disputes.

### 3.5 RESTAURANT: রেস্তোরাঁ / Restaurant & café
`status: DRAFT` · icon `utensils` · kinds `PRODUCT, RENTAL` · roles `CUSTOMER, SUPPLIER`
- **Allowed modules:** FCOMMERCE list + booking (table reservations), (`kitchen-display` capability in Phase 7)
- **Resource types:** `TABLE` (capacity = seats)
- **Terms:** offering(PRODUCT) মেনু আইটেম/Menu item · booking টেবিল রিজার্ভেশন/Table reservation · resource টেবিল/Table

| Entity | Key | Type | Req | Bot | Vis | Flags | Options |
|---|---|---|---|---|---|---|---|
| offering(PRODUCT) | `spice_level` | SELECT | – | – | A S B | | MILD, MEDIUM, HOT |
| offering(PRODUCT) | `is_vegetarian` | BOOLEAN | – | – | A S B | | |
| offering(PRODUCT) | `prep_minutes` | NUMBER | – | – | A B | | |
| order | `table_number` | TEXT | – | – | A | | dine-in |
| order | `special_instruction` | LONG_TEXT | – | – | A S B | | |

- **Offering defaults:** menu items have no stock components by default (setting `catalog.defaultStockTracked=false`); a restaurant may add ingredient components later (ADR-098). Table reservation = RENTAL offering, price 0, `rateUnit=HOUR`, `minUnits=1`.
- **Modifiers seed:** "Extra cheese" (+৳ 40), "Size" (Regular / Large +৳ 80, required single choice)
- **Settings:** `sales.usePacking=false`, `pos.requireShift=true`, `sales.deliveryCharges` per seller
- **Website templates:** `restaurant-menu`, `cafe-cozy`
- **Bot:** persona `WARM_HOST`. Takes food orders with modifiers, books tables.

### 3.6 HOSTEL: হোস্টেল ও মেস / Hostel & mess
`status: DRAFT` · icon `bed` · kinds `PLAN, RENTAL` · roles `CUSTOMER` · relations `GUARDIAN_OF`
- **Allowed modules:** contact, catalog, pricing, enrollment, booking, payment, expense, report, sms, website, messaging, bot, workflow, bookkeeping
- **Resource types:** `BED`, `ROOM` (capacity = beds)
- **Terms:** contact বোর্ডার/Resident · offering(PLAN) সিট ভাড়া/Seat rent · enrollment সিট বরাদ্দ/Seat allocation · offering(RENTAL) গেস্ট রুম/Guest room

| Entity | Key | Type | Req | Bot | Vis | Flags | Options |
|---|---|---|---|---|---|---|---|
| contact | `guardian` | REFERENCE(contact) contact-link | yes | yes | A S | | `GUARDIAN_OF` |
| contact | `institution_or_workplace` | TEXT | – | yes | A S | | |
| contact | `national_or_student_id` | TEXT | – | – | A | sens | |
| contact | `meal_preference` | SELECT | – | yes | A B | | REGULAR, NO_MEAL, VEGETARIAN |

- **PLAN defaults:** `billingPeriod=MONTH×1`, `securityDeposit` per plan (refundable, ADR-074), `autoRenewDefault=true`. Seat = `Enrollment.resourceIds` (BED) (ADR-074).
- **Settings:** `enrollment.graceDays=7`, `enrollment.blockCheckInWhenOverdue=false`
- **Website templates:** `hostel-simple`
- **Bot:** persona `RESPECTFUL_MANAGER`. Shares seat availability and rent, collects intake. Extra handoff topic: deposit refund.

## 4. Proof: no industry code needed

| Template | Needs only kinds + config? | Generic features it relies on (new ones marked ★) | Optional capability module (Phase 7) |
|---|---|---|---|
| FCOMMERCE | Yes | modifiers ★, social import, courier | — |
| RETAIL | Yes | POS, credit sale, units/weight | (`lot-tracking` for expiry, future) |
| SALON | Yes | booking with member resources, modifiers ★ | — |
| CLINIC | Yes | booking + approval, sensitive fields, bot handoff topics | `clinical` (notes, prescriptions) |
| GYM | Yes | enrollment + freeze + check-in, resource on enrollment ★ (locker) | — |
| COACHING | Yes | enrollment fixed dates + capacity, contact-link field ★, EVENT sessions | `academic` (exams, results) |
| RESTAURANT | Yes for orders and reservations | modifiers ★, non-stock items, RENTAL tables | `kitchen-display` (KOT) |
| HOSTEL | Yes | enrollment + resource on enrollment ★ + security deposit ★ | — |

Lint guarantee: feature code never reads `industryTemplateKey` (ADR-033). Everything above comes through `resolveOrgConfig` (kinds, modules, fields, terms, settings).

## 5. New generic features found by this card (synced into `09`/`11`)

**Modifiers (ADR-072, catalog):**
- `ModifierGroup { modifierGroupId, name, selection: SINGLE | MULTIPLE, isRequired, minSelect, maxSelect, options[{ modifierOptionId, name, priceDelta: Money, status }] }` (catalog, org scope), linked to offerings via `Offering.modifierGroupIds[]`.
- Order lines and bookings snapshot the chosen options: `modifiers[{ modifierGroupId, modifierOptionId, nameSnapshot, priceDelta }]`. `unitPrice` includes the deltas. Modifiers never have their own stock.
- The bot sees modifiers through `get_offering` and must collect required ones before `create_request`.

**Contact-link custom field (ADR-073, custom-field engine):**
- A custom field of type `REFERENCE` with `referenceEntity: "contact"` may carry `link { relationKey, createIfMissingByPhone: true, defaultBillTo: boolean }`.
- On save, the engine resolves or creates the linked contact by phone (dedupe rule of `09 §5.1`) and writes `relations[{ relatedContactId, relationKey }]`.
- When `defaultBillTo`, new requests default `billToContactId` to the linked contact.
- The bot collects the linked contact's name and phone.

**Resource on enrollment + security deposit (ADR-074, enrollment):**
- `Enrollment.resourceIds?[]` (bed, locker) with capacity checks like bookings (one active enrollment per resource unit).
- PLAN `kindDetails.securityDeposit?: Money`: collected as an advance (CUSTOMER_ADVANCES), refunded or retained on cancellation/expiry by explicit action (approval). Journal rows use the existing advance rows of `11 §10`.

## 6. Decisions made in this card

| ADR | Decision | Status |
|---|---|---|
| ADR-072 | Offering modifiers: `ModifierGroup` with options and price deltas, linked to offerings and snapshotted on order lines and bookings. Generic catalog feature, not restaurant code. | Accepted (proposed) |
| ADR-073 | Contact-link custom field: a contact REFERENCE field may create/link a contact by phone, add a relation (e.g. `GUARDIAN_OF`) and default `billToContactId`. Generic engine behaviour driven by field metadata. | Accepted (proposed) |
| ADR-074 | Enrollments may hold resources (`resourceIds`, capacity-checked), and PLAN offerings may require a refundable `securityDeposit` (advance liability). | Accepted (proposed) |
| ADR-075 | Launch publishing: FCOMMERCE and RETAIL are PUBLISHED; SALON, CLINIC, GYM, COACHING, RESTAURANT, HOSTEL are DRAFT and assignable to pilot orgs by a platform operator, published later without code. | Accepted (owner) |
| ADR-076 | Templates are seeded from versioned JSON (`packages/seed/industry-templates/*.json`) and stored fully materialized (no runtime inheritance between templates). Edits in the platform panel bump the template version. Orgs pick up changes additively only (ADR-046). Bot defaults per template include `personaKey` and extra `handoffTopics`. | Accepted (proposed) |

## 7. Open questions (not blocking)
- **Q1.** Default delivery charges (৳70 inside Dhaka / ৳130 outside) are placeholders. Each seller edits them in onboarding.
- **Q2.** Pharmacy as its own template needs batch/expiry (`lot-tracking`). Proposed as a Phase 7 capability, not now.
