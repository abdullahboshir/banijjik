# Plan: card M.8a · MATRIMONY_ISLAMIC and MATRIMONY templates (data only)

Tier: **T2** (seed data, no new code paths) · Planned by: Opus 5.5 (lead) · Date: 2026-10-23 · Based on commit: `main 3126a257`

Track M (`docs/16-MATRIMONY-TRACK.md` §4). M.8 is split:
- **M.8a:** the two templates, now.
- **M.8b:** SMS and email for review results and report outcomes, after 5.13 or an SMS provider exists.

This card proves the principle of ADR-034: a matrimony site is **data**. If any step seems to need code, stop and ask.

## Session parts
One part, branch `s/M.8a-matrimony-templates`, merge check by the lead. It touches no file of M.7 A1, so it runs in parallel.

## Goal
A fresh database seeds two DRAFT templates, `MATRIMONY_ISLAMIC` (the owner's site) and `MATRIMONY` (general, for other bureaus). An operator publishes one. An organization created on it can then take a biodata through the M.2 API with all the rules of doc 16 §4, with no code change.

## Inputs read
- `docs/16-MATRIMONY-TRACK.md` §3.1, §4, §6 (owner decisions 3, 4, 5)
- `apps/api/src/modules/platform/industry/infrastructure/load-seed-templates.ts`: `SEED_FILE_NAMES`. Seeding is insert-only; existing keys are never overwritten (ADR-076).
- `seeds/hostel.json`, the shape to follow
- `packages/contracts/src/platform/industry-template.ts`: listing field properties `listingTier`, `isFilterable`, `sectionKey`, `minAgeYears`, `mustDifferFromAccountPhone`, and the `directory` block
- `packages/contracts/src/organization/industry-template-key.ts`: `SEED_INDUSTRY_TEMPLATE_KEY`
- `apps/api/src/modules/commerce/directory/presentation/directory-api.test.ts`: how a test organization gets a directory template

## Decisions
1. **Two seed files:** `seeds/matrimony-islamic.json` and `seeds/matrimony.json`, both `"status": "DRAFT"`. A DRAFT template is not offered at signup, so nobody signs up before the storefront exists (M.6). The operator publishes the template in the platform app when the owner's site is ready (M.9).
2. **Kinds and modules:**
   - `enabledKinds: ["SERVICE"]`. The schema needs one kind, and bureaus sell matchmaking or counselling as a service.
   - `allowedModuleKeys: ["contact", "catalog", "pricing", "directory", "credit", "sms", "website", "report"]`.
3. **Terms:**
   - `listing`: বায়োডাটা / Biodata
   - `contact.RELATED`: অভিভাবক / Guardian
   - `contactRoleKeys: ["CUSTOMER", "RELATED"]`, `relationKeys: ["GUARDIAN_OF"]`
4. **Settings defaults** (doc 16 §4 and §6, owner defaults):
   - `contact.customerLogin: true`
   - `directory.photoPolicy: "NONE"`
   - `directory.reviewEdits: true`
   - `directory.oneListingPerAccount: true`
   - `credit.unlockCost: 1`

   Keys come from the contracts constants. Write the literal strings in the JSON exactly as those constants hold them.
5. **Directory block:**
   - `listingNumberPrefix: "BIO"`
   - `sections` in this order: `general`, `address`, `education`, `occupation`, `family`, `religious` (MATRIMONY_ISLAMIC only), `marriage`, `expectedPartner`, `contact`, `identity`. BN and EN labels.
   - `consents`, BN and EN (owner decision 5: drafted, the owner edits later in the platform app):
     - both templates: `truthful` (the information is true), `guardianConsent` (a guardian knows and agrees), `adultAge` (18 or older), `termsAccepted` (site terms and privacy)
     - MATRIMONY_ISLAMIC also: `islamicEligibility`, the owner's eligibility text. Draft it neutrally from doc 16 §4: regular prayer, and beard or niqab as applicable. Mark it `DRAFT: owner to edit` in the handoff, not in the data.
   - `rejectionReasons`: `guardianConsentMissing`, `ownNumberInGuardianField`, `unclearAnswers`, `falseInformation` (`isFinal: true`), `incomplete`
   - **No `reportReasons`.** That property arrives with M.7 A1. Whichever of M.7 A1 and M.8a merges second gets the reasons from the lead at merge: `fakeProfile`, `alreadyMarried`, `inappropriateContent`, `contactMisuse`, `other`.
6. **Listing fields** (`entityType: "listing"`):
   - `visibility { admin: true, storefront: true, bot: false }` on every field
   - `botAsk: false`
   - `isSearchable` equals `isFilterable`
   - `isSensitive: true` only on the `contact` and `identity` sections
   - option keys in UPPER_SNAKE, with BN and EN `optionLabels`

   | Section | fieldKey | Type | Tier | Filter | Req. | Notes |
   |---|---|---|---|---|---|---|
   | general | `gender` | SELECT `MALE, FEMALE` | PUBLIC | yes | yes | |
   | general | `dateOfBirth` | DATE | PUBLIC | yes | yes | `minAgeYears: 18` (the age filter) |
   | general | `maritalStatus` | SELECT `NEVER_MARRIED, DIVORCED, WIDOWED, MARRIED` | PUBLIC | yes | yes | |
   | general | `heightCm` | NUMBER | PUBLIC | no | no | |
   | general | `complexion` | SELECT (5 options) | PUBLIC | no | no | |
   | general | `bloodGroup` | SELECT `A_POS … O_NEG` | PUBLIC | no | no | |
   | address | `permanentAddress` | GEO_BD | PUBLIC | yes | yes | |
   | address | `presentAddress` | GEO_BD | PUBLIC | no | no | |
   | address | `grewUpIn` | TEXT | MEMBERS | no | no | |
   | education | `educationMethod` | SELECT `GENERAL, QAWMI, ALIYA, ENGLISH_MEDIUM` | PUBLIC | no | yes | |
   | education | `highestEducation` | SELECT (SSC … PhD, about 8) | PUBLIC | yes | yes | |
   | education | `institution` | TEXT | MEMBERS | no | no | |
   | occupation | `profession` | SELECT (about 12, with `OTHER`) | PUBLIC | yes | yes | |
   | occupation | `monthlyIncomeRange` | SELECT (5 ranges) | MEMBERS | no | no | |
   | family | `fatherOccupation`, `motherOccupation` | TEXT | MEMBERS | no | no | |
   | family | `siblings` | LONG_TEXT | MEMBERS | no | no | |
   | family | `familyEconomicStatus` | SELECT (4) | MEMBERS | no | no | |
   | religious | `dailyPrayers`, `quranRecitation` | SELECT (4 each) | MEMBERS | no | yes | MATRIMONY_ISLAMIC only |
   | religious | `dress` | LONG_TEXT | MEMBERS | no | no | MATRIMONY_ISLAMIC only |
   | marriage | `marriageViews` | LONG_TEXT | MEMBERS | no | no | for example study or work after marriage |
   | expectedPartner | `partnerAgeRange` | TEXT | PUBLIC | no | no | |
   | expectedPartner | `partnerDistricts`, `partnerEducation`, `partnerQualities` | LONG_TEXT | PUBLIC | no | no | |
   | contact | `guardianName` | TEXT | UNLOCKED | no | yes | |
   | contact | `guardianRelationship` | SELECT `FATHER, MOTHER, BROTHER, SISTER, UNCLE, OTHER` | UNLOCKED | no | yes | |
   | contact | `guardianPhone` | PHONE | UNLOCKED | no | yes | `mustDifferFromAccountPhone: true` |
   | contact | `contactEmail` | EMAIL | UNLOCKED | no | no | |
   | identity | `fullName` | TEXT | PRIVATE | no | yes | |
   | identity | `ownPhone` | PHONE | PRIVATE | no | no | |

   MATRIMONY (general) has the same table without the `religious` section and without `QAWMI` and `ALIYA` in `educationMethod`.
   If the seed schema or the M.2 rules refuse any row (for example `minAgeYears` on a filterable DATE), stop and ask. Do not change code.
7. **Contracts:** add `MATRIMONY_ISLAMIC` and `MATRIMONY` to `SEED_INDUSTRY_TEMPLATE_NAMES`. Change its comment to "the seed templates of 12-INDUSTRY-TEMPLATES and doc 16 §4". The production rule stays the same: no code branches on a key.
8. **Docs:** one line in `docs/12-INDUSTRY-TEMPLATES.md` pointing to doc 16 §4 for the two templates.

## Files
| Path | Create/Change | Owns / add-only | Purpose |
|---|---|---|---|
| `apps/api/src/modules/platform/industry/infrastructure/seeds/matrimony-islamic.json`, `matrimony.json` | Create | owns | the data |
| `apps/api/src/modules/platform/industry/infrastructure/load-seed-templates.ts` | Change | add-only | two names in `SEED_FILE_NAMES` |
| `packages/contracts/src/organization/industry-template-key.ts` and its test | Change | add-only | two keys |
| `apps/api/src/modules/platform/industry/industry-template-seeds.test.ts` | Change | owns | counts and keys |
| `apps/api/src/modules/commerce/directory/matrimony-template.test.ts` | Create | owns | the end-to-end proof below |
| `docs/12-INDUSTRY-TEMPLATES.md`, `docs/handoffs/M.8a.md`, STATUS row M.8 | Change/Create | add-only | records |

## Tests (must exist and pass)
- [ ] `seeds both matrimony templates as DRAFT and parses them with the seed schema`
- [ ] `a second seed run leaves an edited matrimony template unchanged` (insert-only)
- [ ] In `matrimony-template.test.ts`, on an organization created from the published `MATRIMONY_ISLAMIC` seed:
  - `submits a complete biodata`
  - `refuses a date of birth under 18`, with a fixed clock on the 18th birthday edge
  - `refuses a guardian phone equal to the account phone`
  - `refuses a submit without every consent`
  - `a public search filters by gender, district and age and returns only PUBLIC fields`
  - `a signed-in visitor also gets MEMBERS fields but never UNLOCKED or PRIVATE ones`
  - `the review queue's rejection reasons are the seeded ones`
- [ ] The same "submits" and "PUBLIC fields" tests for `MATRIMONY`, and `the general template has no religious section`
- [ ] `git grep -n -i "matrimony\|biodata" -- apps/api/src ':!*.test.ts' ':!*/seeds/*'` finds nothing (no code knows the template)

## Out of scope
- Notifications (M.8b).
- `reportReasons` (decision 5).
- Photos (policy NONE).
- The storefront (M.6).
- Publishing the template for real (M.9).
- Any change to the field engine or the directory module.

## Done when
The tests pass, CI is green, `npm run card:check` is all PASS, and the handoff lists the drafted consent and eligibility texts for the owner to edit.
