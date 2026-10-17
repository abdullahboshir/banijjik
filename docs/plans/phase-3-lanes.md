# Phase 3: lanes and conflict rules

Planned by: Opus 5.5 (Claude) · Date: 2026-10-17 · Based on commit: `main a04012d` (Phase 2 merged and reviewed; GitHub CI run `39020750964` green)

The folder, machine, review and merging rules of `docs/plans/phase-2-lanes.md` still apply. This file adds what is new for Phase 3.

## Gate
Phase 3 code merges only after card **2.8** is merged (Phase 2 review F1). Met: 2.8 merged on 2026-10-17 (`main 36390a6`). The CI condition (F2) is met: run `39020750964` on `a04012d` passed.

## Wave 1
| Session | Card | Folder | Starts | ADR |
|---|---|---|---|---|
| 1 | **2.8** terms in visible labels (`docs/plans/2.8.md`), then **3.1a** contacts API (`docs/plans/3.1a.md`) | `banijjik` | 2.8 now; 3.1a after 2.8 is merged | 3.1a → ADR-110 |
| 2 | **3.0** files and images (`docs/plans/3.0.md`) | `banijjik-1.7b` | now | ADR-109 |
| 3 | **3.13** clear structure and visual design pass (`docs/plans/3.13.md`) | `banijjik-lead` | after 2.8 is merged | ADR-112 |
| 1 (later) | **3.1b** contacts screens (`docs/plans/3.1b.md`) | `banijjik` | after 3.1a is merged | ADR-111, only if needed |

Card 3.1 is split in two: 3.1a is the API (T1), 3.1b the screens (T2). The roadmap name "3.1 Contacts" covers both.

## Files owned by one card only (wave 1)
| File or area | Owner | Others |
|---|---|---|
| `packages/contracts/src/modules/module-manifest.ts` | 2.8 (`termKey`), then 3.13 (`settingsTopicKey`) | 3.0 and 3.1a do not edit it |
| `packages/validation` custom-field value builder | 3.1a (contact-link `{ create }` input) | 3.0 does not edit it; its file check lives in the use cases |
| `packages/web-client` custom-field glue (`custom-field-form.ts`) | 3.0 (IMAGE, FILE), later 3.1b (REFERENCE contact) | 3.13 adds the setting-value inputs in a **new** file |
| `packages/ui` `CustomFieldInputs` | 3.0 (image and file inputs), later 3.1b (contact link) | 3.13 restyles through tokens and shared components only, not the field logic |
| `packages/ui/src/tokens/**`, shared components (buttons, cards, inputs, empty states) | 3.13 | 3.0 and 3.1b build new components from the existing tokens, without editing them |
| `apps/api/src/modules/core/organization/**` | 3.0 (`FileReferenceChecker`) | nobody else in wave 1 |
| `apps/api/src/modules/platform/industry/**` | 3.13 (`isInUse` on detail) | nobody else in wave 1 |
| `apps/admin` shell and settings pages | 3.13 | 2.8 merges first; 3.1b adds its own `contacts` folder only |

Shared files stay add-only as in Phase 2. That covers the contracts and validation indexes, `permission-key.ts`, `system-role-grants.ts`, `routes/*`, `module-registry.ts`, the i18n catalogs, `04-DECISIONS.md` and `14-API.md`.

## Merging order
- 2.8 first.
- Then 3.0, 3.1a and 3.13 in the order they pass review. The later branches are rebased by the reviewer.
- 3.1b is planned to use 3.13's `PageLayout` and `PageSection` if 3.13 is merged first; otherwise it follows the existing screens and 3.13 restyles it.

## Wave 2 (planned 2026-10-17 on `main 9ceb629`)
Wave 1 merged on 2026-10-17: 3.0, 3.1a, 3.13 (3.1b moved after 3.1c). Main was pushed and checked by GitHub CI.

| Session | Cards, in order | Folder | ADR |
|---|---|---|---|
| 1 | **3.1c** contact roles for fields (`docs/plans/3.1c.md`, T1) → **3.1b** contacts screens (`docs/plans/3.1b.md`) | `banijjik` | 3.1c → ADR-113, 3.1b → ADR-111 if needed |
| 2 | **3.2a** catalog API (`docs/plans/3.2a.md`, T1) → **3.2b** catalog screens (`docs/plans/3.2b.md`) | `banijjik-1.7b` | 3.2a → ADR-116, 3.2b → ADR-117 if needed |
| 3 | **3.12** business branding (`docs/plans/3.12.md`, T2) → **3.8a** ordered event streams (`docs/plans/3.8a.md`, T1) | `banijjik-lead` | 3.12 → ADR-114, 3.8a → ADR-115 |

Each folder starts with `git switch main` (the `banijjik` folder first deletes its untracked `apps/admin/AGENTS.md` and `apps/platform/AGENTS.md`, which main now tracks), then `npm install`, then a new branch `s/<card>-<slug>`.

### Files owned by one card (wave 2)
| File or area | Owner | Others |
|---|---|---|
| `packages/contracts/src/index.ts` (at its 300-line cap) | nobody adds lines | new exports go through an existing export statement of the same file, or a subpath (`@banijjik/contracts/catalog` for 3.2a, as 3.0 and 3.1a did). A split of the index is a later chore card |
| `packages/contracts/package.json` `exports`, `eslint/restrictions.mjs` domain exception, the new-module test aliases | 3.2a (`./catalog`) | others do not add subpaths in this wave |
| `packages/validation/src/custom-field/**` (builder) | 3.1c | 3.2a filters fields by kind before calling the builder; it does not change the builder |
| `packages/validation/src/platform/industry-template-schemas.ts`, `modules/platform/industry/**` (seeds, additive rule) | 3.1c | nobody else |
| `modules/commerce/contact/**` | 3.1c, then 3.1b; 3.8a adds only the `orderingKey` on contact events | |
| `modules/core/organization/**` | 3.12 | nobody else |
| `modules/core/custom-field/**` | 3.1c | 3.2a reads effective fields through its index only |
| `apps/api/src/kernel/events/**`, existing event handlers (`ordering`) | 3.8a | 3.2a publishes events through the existing port; if 3.8a merged first, it passes `orderingKey: offering:<offeringId>` |
| `apps/platform/src/industry-templates/**` | 3.1c | 3.8a adds a new `failed-events` folder only |
| `apps/admin/src/custom-fields/**` | 3.1c | |
| `apps/admin/src/shell/**` | 3.12 (logo in the top bar) | 3.1b and 3.2b add their own folders only |

Shared add-only files are the same as wave 1.

### Merging order
In the order the cards pass review; the reviewer rebases the later ones. 3.1b and 3.2b start only after their API card is merged. **Heavy test runs need the lead's "go"** (one at a time), as in wave 1.

## Whole-phase map
Only wave 1 has full plans. A later card's plan is written when the cards it builds on have merged (rolling wave, `AGENTS.md`), so it matches the real code. This map fixes the order, the sessions and the gates so the owner can see the whole phase.

| Wave | Session 1 (`banijjik`) | Session 2 (`banijjik-1.7b`) | Session 3 (`banijjik-lead`) | Plans written when | Gate to start |
|---|---|---|---|---|---|
| **1** | 3.1a contacts API → 3.1b contacts screens | 3.0 files and images | 3.13 structure and design pass | done (2026-10-17) | 2.8 merged (done) |
| **2** | 3.1c → 3.1b (contacts) | 3.2a → 3.2b (catalog) | 3.12 branding → 3.8a ordered event streams | done (2026-10-17) | wave 1 merged (done) |
| **3** | 3.4 pricing and tax | 3.8 payments, accounting engine, expenses (lane C) | 3.6 booking core (lane B) | 3.2 merged (3.8 also needs 3.8a) | 3.6 reads offering prices through 3.4's port; the two plans name the port first |
| **4** | 3.7 enrollment core (lane B) | 3.8b bookkeeping UI | 3.9 POS (services and products) | 3.4, 3.6 and 3.8 merged | 3.9 needs 3.4 and 3.8 |
| **5** | 3.3 inventory ledger (lane A) → 3.5 orders | 3.11 staff commission | (free, or 4.1 if Phase 4 starts) | 3.6, 3.7 and 3.9 merged | 3.11 needs 3.6 and 3.8 |
| **6** | 3.10 reports and dashboard (last) | | | every other card merged | |
| **end** | Phase 3 review (Opus), `docs/handoffs/phase-3-review.md` | | | | Phase 4 starts after it passes |

- **Service businesses first (ADR-099):** after wave 4, a salon, gym or coaching centre can run (contacts, catalog, prices, bookings, enrollments, payments, POS). Lane A (stock and online orders) serves product sellers and comes after.
- **Tiers:** T1 = 3.0, 3.1a, 3.2(a), 3.8a, 3.8, 3.3, 3.5, 3.6, 3.9 (money, stock, concurrency, uploads). T2 = the rest. Every T1 card gets the strict Opus review; T2 cards a merge check.
- **One heavy test run at a time** on this machine; three sessions need at least 4 GB free on E:.
- The table may change when a wave's plans are written. Changes are recorded here and in STATUS.
