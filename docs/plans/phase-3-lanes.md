# Phase 3: lanes and conflict rules

Planned by: Opus 5.5 (Claude) · Date: 2026-10-17 · Based on commit: `main a04012d` (Phase 2 merged and reviewed; GitHub CI run `39020750964` green)

The folder, machine, review and merging rules of `docs/plans/phase-2-lanes.md` still apply. This file adds what is new for Phase 3.

## Gate
Phase 3 code merges only after card **2.8** is merged (Phase 2 review F1). The CI condition (F2) is met: run `39020750964` on `a04012d` passed.

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

## Wave 2 (planned when wave 1 has merged)
3.2 offerings catalog ‖ 3.12 business branding. 3.12 needs 3.0 (logo file) and 3.13 (settings topics: "Business" and "Website").
