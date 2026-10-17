# Phase 2 review · 2026-10-17 · PASS WITH FIXES

Reviewer: Claude (Opus 5.5). Scope: cards 2.1a, 2.1b, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7a, 2.7b, all merged on `main` (tip `4c3b2ff`). Every card had its own review, with a full re-run of lint, format, `test:tools`, turbo and both browser suites. This review looks across the cards.

## Phase done criterion (`03-ROADMAP.md`)
> A new industry with new fields and new terms is created from the Platform Panel alone, and its tenants see the right menu, labels and forms with server-side validation. No deploy is needed. CI proves no code reads `industry` outside the resolver.

| Part | Evidence | Holds? |
|---|---|---|
| New industry from the panel alone, no deploy | 2.6's browser path: create BAKERY by copying RETAIL, add a member field and a term, set a setting default, publish, sign up on BAKERY. Template keys are data (ADR-097). | **Yes** |
| Right menu | The menu follows the effective modules (resolver, 2.2) and permissions; tenant module switches (2.2) | **Yes** |
| Right forms with server-side validation | Profile and staff forms show the template's and the business's fields (2.5, 2.7a); the server validates with the same builder (2.3); sensitive values are protected (2.7a) | **Yes** |
| **Right labels (terms)** | Terms are resolved in both languages and carried in `/me/config` (2.2), and editable (2.7b). **But no visible label uses a term**: every menu entry's `labelTermKey` is a message key (`menu.organization.locations`, …), and no page title reads a term. Renaming `location` to "আউটলেট" changes the terms page and `/me/config`, and nothing else. | **No: finding F1** |
| CI proves no industry branching | Lint R16 with fixtures (now also for the platform screens, 2.6). The last GitHub CI run was 1.10c; **82 commits of Phase 2 have never run on CI** (Linux, MongoDB 8.0.13). | **Not yet: finding F2** |

## Findings
**F1 · MAJOR · terms reach no visible label.**
- **Fix:** card **2.8** (`docs/plans/2.8.md`).
  - Menu entries get an optional `termKey`, and the label is the term in the user's language, falling back to the message key.
  - The organization manifest's Locations entry and the locations page title use the term `location`.
  - `05-CONVENTIONS` gets the rule that every Phase 3 entity menu entry and page title names its term (`contact`, `offering`, `order`, `booking`, `enrollment`, `resource`, `location`).
- Small, but Phase 3's first entity card (3.1 contacts) depends on it.

**F2 · MAJOR (process) · Phase 2 has never run on GitHub CI.** Push `main` and get a green run before Phase 3 code merges. This needs the owner's permission (`AGENTS.md`). Local runs are green on Windows with MongoDB 8.2.

## Consistency across the cards (checked, no action)
- **ADR numbers** 097–108 are unique. 105 was reserved for 2.5 and not needed.
- **Every new tenant collection is tenancy `ORGANIZATION`**, so the tenant plugin filters and stamps it:
  - `custom_field_definitions`, `custom_field_preferences` (2.3)
  - `setting_values` (2.4)
  - `term_overrides` (2.2)
- **The two platform-wide collections are tenancy `NONE`:** `industry_templates` (2.1a) and `platform_operators`.
- **One shape for localized text** (`LocalizedText { bn, en }`) everywhere: template names, terms, field labels, option labels.
- **One value builder for custom fields** (2.3), used by the API (2.7a), the browser glue (2.5) and the panel's field editor (2.6).
- **One additive rule** for template edits and organization moves (2.1b), with guard-document touches serializing signup, retire, move and PATCH (ADR-092 pattern).
- **Sensitive custom-field values:**
  - redacted on read by permission
  - masked in the audit log
  - refused on write without the read permission
  - never indexed for search (2.7a)
- **No cycle in the resolver:** the module set is passed into the terms, settings and fields sources (2.2).
- **`/me/config` cold payload** is asserted under 50 KB (2.2).
- **Route budgets:** every admin and platform route is ≤ 170 KiB; the largest are admin `/acme/settings/locations` at 165.4 KiB and fields at 165.1 KiB.

## Doc drift (fixed in this review's commit)
- `07 §3` said the resolved config is "cached in Redis". It is an in-process LRU keyed by `configVersion`, `templateVersion` and `registryHash`. Corrected.
- `09 §4.6`:
  - `CustomFieldDefinition` claimed platform-stored INDUSTRY rows; INDUSTRY fields are read from the template (ADR-102). Corrected.
  - `CustomFieldPreference` was missing. Added.
- `STATUS.md`: the 1.6a note still called the template reader "interim until 2.1", and the 2.1a note said "Not merged, not pushed". Corrected.

## Open items carried into Phase 3 (in `03-ROADMAP.md`, "Carried over from Phase 2")
- FILE and IMAGE inputs → 3.0; the REFERENCE and contact-link input (COACHING's required `guardian`) → 3.1.
- Search by custom field value → 3.1.
- A draft template in use shows no lock in the panel → 3.13.
- The setting-value input mapping exists twice (admin 2.7b and platform 2.6) → move to `@banijjik/web-client` in 3.13.
- Per-organization event ordering before 3.8 (ADR-090).

## For the owner
- **Twelve ADRs of Phase 2 are "Accepted (proposed)":** 097, 101–104, 106–108. The other four were owner decisions (098–100 on 2026-10-14). Read the summary lines of 097 (template keys are data), 102 (custom fields), 103 (settings) and 107 (sensitive staff data) when you have time. They shape every later module.
- **`next dev` writes `apps/admin/AGENTS.md` and `apps/platform/AGENTS.md`** (Next.js agent notes; untracked). Decide in 3.13 whether to commit them or ignore them.

## Verdict
**PASS WITH FIXES.** Phase 3 starts when:
1. card 2.8 is merged
2. `main` has a green GitHub CI run

Cards 3.0 and 3.13 do not depend on terms and may be planned now, so they can start the moment both conditions hold. 3.1 waits for 2.8.
