# 16 · Matrimony track: directory listings, customer accounts and credits

Status: **approved by the owner on 2026-10-18** (binding, like the D docs) · Author: Opus 5.5 (Claude) · Date: 2026-10-18 · Decision: ADR-118

## 1. Why and what
The owner wants to run a matrimony website like OrdhekDeen (অর্ধেকদ্বীন) on banijjik:
- **first for the owner's own use**
- **later sold** to other matrimony services and marriage-bureau businesses

That fits the platform when every piece is generic (ADR-033, ADR-034):
- The matrimony site is **one organization** (the owner's), using an industry template `MATRIMONY`.
- The code that makes it work is **generic capability modules**, each reusable by other businesses: a directory of member-submitted listings (tutors, rental rooms, job seekers), customer accounts, and prepaid credits.
- A second matrimony business is a second organization with the same template; nothing in code knows about marriage.

How such sites work, in short (from OrdhekDeen):
1. A person (with a guardian's consent) submits a biodata for free.
2. The site's team reviews and approves it.
3. Visitors search with filters (age, district or upazila, education, profession, marital status) and see the public part.
4. Contact details (the guardian's name, phone and email) are revealed only through a paid **connection**.
5. Couples never talk directly; the guardian is the contact.

## 2. Principles
1. **No matrimony code.** Biodata fields, filters, eligibility text, rejection reasons, photo policy and prices are template and organization data. Words come from terms (`listing` = "বায়োডাটা").
2. **Privacy first.** Every listing field has a visibility tier, and personal data is protected as in ADR-107. The 18+ rule and guardian consent are enforced by the server. Erasure removes personal data and keeps only ids for ledgers.
3. **Money is a ledger.** Credits are an append-only ledger (ADR-014); a purchase is idempotent; amounts are integer minor units (ADR-013).
   *Erasure note (M.7):* when a customer erases their account, credit entries, unlocks and purchases stay as ids only, the remaining balance is forfeited (the response says how many credits), and a PENDING purchase is cancelled first so staff never verify money for an erased account.
4. **The site's members are customers, not staff.** They use customer accounts (`09 §5.2`, ADR-045) with their own token audience; they never become Users or Members.

## 3. Capabilities (new or pulled forward)
| Module | Kind | What it owns | Reused by |
|---|---|---|---|
| `contact` customer accounts (card 4.3a, pulled forward) | CORE (part of contact) | `CustomerAccount`, `CustomerSession`, phone OTP login per organization, storefront token audience | every storefront: shops, bookings |
| **`directory`** (new) | OPTIONAL | `Listing`: a customer-submitted profile with template custom fields (entity `listing`), visibility tiers, moderation workflow, public listing number, filters, photos | tutor and job-seeker directories, rental rooms, pet adoption |
| **`credit`** (new) | OPTIONAL | `CreditPack`, `CreditEntry` ledger, balance, `ListingUnlock` (a paid connection) | any pay-to-unlock or prepaid-points use |
| `payment` manual verification (part of 3.8, pulled forward for credits) | CORE | a customer pays by bKash or Nagad send-money with a transaction id, and staff verify it; the gateway (5.17) comes later | all request types |
| storefront (card 4.2, minimal form) | app | `apps/storefront`: public pages rendered for the organization's domain, with the theme from branding (3.12) | every website |

### 3.1 Listing (directory)
- **Fields:** `listingId`, `listingNumber` (per-organization sequence, shown as `<prefix>-<n>`, never `count()+1`), `ownerCustomerAccountId`, `status`, `customFields` (entity `listing`), `customFieldSearch`, `photoFileIds` (file purpose `LISTING_PHOTO`, PRIVATE), `submittedAt`, `reviewedAt`, `reviewedByUserId`, `rejection { reasonKeys[], note }`, `publishedAt`, audit fields, `version`.
- **Status:**

  ```
  DRAFT → SUBMITTED → APPROVED (published) | REJECTED
  APPROVED → HIDDEN (by staff) → APPROVED
  APPROVED → SUBMITTED (edited, when the setting directory.reviewEdits is on)
  any → ARCHIVED (deleted by its owner, anonymized)
  ```

  A REJECTED listing can be fixed and resubmitted unless a reason is marked final.
- **Visibility tier per field** (a new optional template field property, default `PUBLIC` for directory fields):

  | Tier | Who sees it | Biodata example |
  |---|---|---|
  | `PUBLIC` | anyone | age, district, education, profession |
  | `MEMBERS` | signed-in customers | detailed family or religious answers, if the template wants |
  | `UNLOCKED` | only accounts that unlocked this listing, plus staff | guardian name, guardian phone, email |
  | `PRIVATE` | staff only | the applicant's own name and phone, ID numbers |

  The API never sends a field to a caller below its tier. The storefront cannot leak it, because it never receives it.
- **Rules from the template** (data, checked by the server):
  - `minAgeYears` on a date-of-birth field (18 for matrimony)
  - "this phone must differ from the account's phone" on the guardian-phone field
  - required consent statements (checkboxes with the template's text)
  - one ACTIVE listing per account (setting)
- **Filters:** template fields flagged `isFilterable`: SELECT, MULTI_SELECT, NUMBER and DATE ranges, plus geography. A Bangladesh **geography registry** (division → district → upazila, data file in contracts) backs the address fields. Filters use the attribute-pattern index of ADR-102. Free text is not searched; ID search uses the listing number.
- **Photos:** the template setting `directory.photoPolicy` = `NONE | BLURRED_PUBLIC | UNLOCKED_ONLY`. OrdhekDeen shows no photos, so `NONE` is the matrimony default. Photos are PRIVATE files served only to allowed callers.
- **Moderation:**
  - an admin queue (oldest first) showing the answers next to the template's **review checklist**
  - approve, or reject with reasons from the template list (for example "guardian consent missing", "own number in guardian field", "unclear answers", "false information") plus a note
  - the applicant is notified by SMS (outbox)
  - permissions `directory.listing.{read, review, hide}`

### 3.2 Credits and connections
- **`CreditPack`:** `name`, `credits`, `price: Money`, `validityDays?`, `status`. Sold to customer accounts; for example "5 connections ৳500".
- **`CreditEntry`** (append-only): `customerAccountId`, `type` (`PURCHASE`, `SPEND`, `REFUND`, `EXPIRE`, `ADJUST`), `credits` (signed integer), the reference (payment, unlock or staff adjustment with reason), `occurredAt`. The balance is a projection updated in the same transaction; it never goes below zero (conditional update).
- **`ListingUnlock`:** `customerAccountId`, `listingId`, `creditEntryId`, `unlockedAt`, unique per (account, listing). Unlocking twice costs once (idempotent). The listing owner can see how many times their listing was unlocked (setting), never by whom unless the template allows it.
- **Price:** `credit.unlockCost` (credits per unlock, default 1). Limits against scraping: unlocks per account per day (setting), and search rate limits per IP and account.
- Credit sales post to accounting once 3.8 exists (event `credit.entry.created` with `orderingKey: creditAccount:<customerAccountId>`, 3.8a).

### 3.3 Payments for credits
- **First version: manual verification**, as most Bangladeshi sites start.
  1. The customer picks a pack and sends money to the business's bKash or Nagad number (organization setting).
  2. They enter the sender number and transaction id.
  3. Staff see a queue and verify; the credits are granted on verification.
  4. A duplicate transaction id is refused.
- The **SSLCommerz or bKash gateway** (card 5.17) replaces the manual step later without changing credits.

### 3.4 Public site (storefront, minimal)
- **Pages:**
  - home (branding, short intro, statistics: listings by gender, approved count)
  - search with filters and paged results (public fields only)
  - listing page (public and allowed tiers, "unlock contact" button, report button)
  - sign-in with phone OTP
  - **My biodata:** a multi-step form built from the template's field sections with the 2.5 renderer, save as draft, submit, status and rejection reasons
  - **My connections:** unlocked listings with their contact fields
  - **Credits:** balance, buy a pack (manual payment form), history
  - static pages per organization (about, FAQ, guide, terms, privacy, refund) as simple Markdown pages edited in the admin
- **Rendering:** server-rendered, mobile-first, ≤ 170 KiB per route, SEO for public pages only; listing pages carry `noindex` when the template says so.
- **Domain:** the organization's subdomain first; a custom domain with 4.2.

### 3.5 Trust and safety
- **Reports:** reasons from the template, an admin report queue, and actions: hide listing, warn, block account.
- **Blocks:** a customer can block a listing from their results (at most 500 per account; the detail page by number still opens).
- **Account ban** and erasure: the account deletes its listing → anonymized (3.1a semantics).
- **Audit** of every moderation and credit action.
- **Data protection:** consent text stored with the version accepted; export of one's own data. Handling sensitive personal data (religious practice, health, marital status, photos of women) follows the Bangladesh data-protection rules in force at launch: legal review before go-live (owner).

## 4. The `MATRIMONY` template (data)
Two templates, both data:
- `MATRIMONY_ISLAMIC`: the owner's own site
- `MATRIMONY`: a general one for other bureaus

They contain:
- **Terms:** `listing` "বায়োডাটা" / "Biodata", `contact.RELATED` "অভিভাবক".
- **Listing fields in sections:**

  | Section | Fields |
  |---|---|
  | general | gender, date of birth, marital status, height, complexion, blood group |
  | address | permanent and present (geography), grew up in |
  | education | method, highest level, institution |
  | occupation | profession, monthly income range |
  | family | father's and mother's occupation, siblings, economic status |
  | religious practice | prayer, recitation, dress; question text is data |
  | marriage | for example willing to continue studies or job |
  | expected partner | age range, district, education, qualities |
  | contact (UNLOCKED) | guardian name, relationship, guardian phone, email |
  | identity (PRIVATE) | own name, own phone |

- **Filters:** gender, age, district or upazila, education level, profession, marital status.
- **Rules:** min age 18, guardian phone ≠ own phone, consent statements (the owner's eligibility text: prayer, beard or niqab, guardian consent).
- **Rejection reasons and settings:** `photoPolicy NONE`, `reviewEdits true`, `unlockCost 1`, unlocks per day.

## 5. Cards (track M, its own lane)
| Card | Tier | Content | Depends on |
|---|---|---|---|
| **M.0** | — | Owner approves this document | — |
| **M.1** | T1 | Customer accounts and phone OTP sign-in (4.3a pulled forward): account, session, storefront token audience, OTP by SMS through the outbox (development driver writes to a test inbox), rate limits | 3.1a, 3.1c |
| **M.2** | T1 | `directory` API: listing, visibility tiers, statuses, moderation, listing numbers, filters and the geography registry, photos policy, template rules (min age, distinct phone, consents) | M.1, 3.0, 2.3 |
| **M.3** | T2 | Admin: moderation queue with checklist, listing detail, hide and unhide, review settings | M.2 |
| **M.4** | T1 | `credit`: packs, ledger, balance, unlock, limits; events for accounting | M.2, 3.8a |
| **M.5** | T1 | Manual payment verification for credit packs (customer form, staff queue, duplicate transaction refusal) | M.4 |
| **M.6** | T2 (split a and b when planned) | Minimal storefront app for directories: home, search, listing page, sign-in, my biodata (multi-step), connections, credits, static pages | M.1–M.5, 3.12 |
| **M.7** | T1 | Trust and safety: reports, blocks, bans, erasure, consent records, scraping limits | M.2, M.6 |
| **M.8** | T2 | `MATRIMONY_ISLAMIC` and `MATRIMONY` templates; SMS and email notifications for review results | M.2–M.7 |
| **M.9** | — | Owner's site live: domain, SMS provider, backups (with 6.5), pilot | all |

**Lane:** session 3 (`banijjik-lead`) runs track M after card 3.8a. Sessions 1 and 2 continue the service track of Phase 3. Plans are written just in time, one or two cards ahead, like every other card.

## 6. Owner decisions needed
| # | Decision | Default if the owner says nothing |
|---|---|---|
| 1 | Approve this document | — |
| 2 | SMS provider for OTP and notifications (P5) | development driver until chosen; launch blocked without one |
| 3 | Connection pricing (packs and credits per unlock) | 1 credit per unlock, packs set by the owner in the admin |
| 4 | Photo policy for the owner's site | `NONE` (like OrdhekDeen) |
| 5 | Eligibility and consent text, review checklist, rejection reasons | drafted from OrdhekDeen's public rules, owner edits |
| 6 | Site name and domain | subdomain of the platform until chosen |
| 7 | Legal review of personal-data handling before launch | required before M.9 |
