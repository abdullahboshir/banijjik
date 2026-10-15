# Phase 2: lanes and conflict rules

Planned by: Opus 5.5 (Claude) · Date: 2026-10-14 · Based on commit: `main 8291363` (card 2.1a merged)

## Waves
Each wave starts only after the previous wave has merged. Plans for later waves are written from the merged code (`AGENTS.md`, rolling wave), so they match what really exists.

| Wave | Cards (in parallel) | Why they can run together | Depends on |
|---|---|---|---|
| **1 (now)** | **2.1b** platform template writes · **2.3** custom field engine (API) · **2.4** settings engine | Three different modules: `platform/industry`, `core/custom-field`, `core/settings` | 2.1a |
| 2 | 2.2 resolver integration (terms, settings and fields in the resolved config, tenant-disabled optional modules) · 2.5 dynamic form renderer | 2.2 is API (`platform/entitlement`, `core/settings`); 2.5 is `packages/ui` | 2.3, 2.4 |
| 3 | 2.6 platform UI builders · 2.7 tenant UI for settings and fields | 2.6 is `apps/platform`, 2.7 is `apps/admin` | 2.1b, 2.2, 2.5 |

Card 2.2 moved to wave 2: it puts the terms, settings and fields of 2.3 and 2.4 into `resolveOrgConfig`, so it needs both. Terms (`TermOverride`, `GET/PATCH /terms`) belong to 2.2 as well.

## Folders and machine
- **One folder per session.** Two sessions never share a folder.
  - Session 1: `banijjik`.
  - Session 2: `banijjik-1.7b`.
  - Session 3: `banijjik-lead`, which needs `npm install`, about 0.8 GB.
- **Disk:** E: has about 1.7 GB free. **Three sessions need at least 4 GB free.** With less, run two sessions and start the third card when one finishes.
- **Memory:** the machine cannot run two heavy test runs at once. Only one session at a time runs `turbo … test`, a full suite or a browser suite. Small runs of single test files are fine in parallel. The owner says which session may run its "Done means" list.
- **Browser suites use fixed ports.** Never run two at once.

## Conflict rules (every wave-1 session follows them)
1. **Stay in your module.** Change other modules only where your plan says so, by file name.
2. **Shared files are add-only.** Add new lines at the end of the list or object, and never reorder or reformat. The shared files:
   - `packages/contracts/src/index.ts`, `packages/validation/src/index.ts`
   - `packages/contracts/src/iam/permission-key.ts`
   - `apps/api/src/modules/core/iam/domain/system-role-grants.ts`
   - `apps/api/src/routes/v1.ts`, `routes/platform.ts`, `routes/module-registry.ts`
   - the i18n catalogs
   - `docs/04-DECISIONS.md`, `docs/14-API.md`
3. **Files owned by one card only** in wave 1:

   | File | Owner | Others |
   |---|---|---|
   | `packages/contracts/src/modules/module-manifest.ts` | 2.4 (settings definitions) | do not edit |
   | `packages/validation/src/platform/industry-template-schemas.ts` | 2.3, only to add the optional `label` and `optionLabels` to the custom field entry | 2.1b adds its write schemas in a new file and does not edit this one |
| `apps/api/src/modules/platform/industry/infrastructure/seeds/*.json` | 2.3, only to add those labels to the seed fields | 2.1b does not edit the seed files |
   | `apps/api/src/modules/platform/entitlement/**` (the resolver) | nobody | do not edit (2.2 integrates in wave 2) |
   | `apps/api/src/modules/platform/industry/**` | 2.1b | 2.3 and 2.4 each add exactly one new use-case file and one export line in `index.ts`, as their plans say |

4. **ADR numbers are reserved**, so two sessions never take the same one: 2.1b → ADR-101, 2.3 → ADR-102, 2.4 → ADR-103.
5. **STATUS:** each session edits only its own row.
6. **Merging order:** the reviewer merges in the order the cards pass review. The second and third branches are rebased onto `main` by the reviewer, or, when a real code conflict appears, by the implementing session on request.
7. **Never commit on `main`, never push, never merge.** The owner or the reviewer does those.

## Review
Claude reviews each card when it is ready, one at a time, with the strict process (re-run everything, read the diff, try to break the T1 parts). When GitHub CI is available for card branches (owner permission to push card branches), the reviewer uses the pull request's CI run instead of the local turbo run, which keeps the owner's machine free.

## Wave 2 (planned 2026-10-15 on `main 1b4f85d`)
Wave 1 merged on 2026-10-15: 2.1b, 2.3, 2.4.

| Session | Card | Folder | ADR |
|---|---|---|---|
| 1 | **2.2** resolver integration, terms, tenant module switches (`docs/plans/2.2.md`) | `banijjik` | ADR-104 |
| 2 | **2.5** dynamic form renderer (`docs/plans/2.5.md`) | `banijjik-1.7b` | ADR-105, only if needed |

The two cards share almost no files:
- **2.2** works in `apps/api` (`core/settings`, `core/custom-field`, `platform/entitlement`, one new file in `platform/industry`) and in two admin shell files.
- **2.5** works in `packages/ui` and `packages/web-client` only.

Shared files, add-only:
- `packages/contracts/src/index.ts`, `packages/validation/src/index.ts`
- the i18n catalogs
- `docs/04-DECISIONS.md`, `docs/STATUS.md` (own row)

The same machine rules as wave 1 apply: **one heavy test run at a time**, and browser suites never in parallel. Lessons from wave 1:
1. After a rebase, rebuild the workspace packages before `test:tools`, or a stale `dist` fails `new-module.test.mjs`.
2. Run turbo with `--continue`, so one failure does not hide the others.
3. Check that Docker (Mongo 27018, Redis 6380) is running before a full run.
4. After a rebase, search the branch's own tests for manifest fields and expected module lists the merged card changed.

## Wave 3 (planned 2026-10-15 on `main 52bf49e`)
Wave 2 merged on 2026-10-15: 2.2, 2.5. Card 2.7 is split, because the Phase 2 done-criterion ("tenants see the right forms with server-side validation") needs a real entity that stores custom field values:
- **2.7a:** values on the business profile and on staff
- **2.7b:** the settings, terms, fields and modules screens

| Session | Cards, in order | Folder | ADR |
|---|---|---|---|
| 1 | **2.6** platform template, module and field builders (`docs/plans/2.6.md`) | `banijjik` | ADR-106 |
| 2 | **2.7a** custom field values on profile and staff (`docs/plans/2.7a.md`), then **2.7b** tenant settings, terms, fields and modules screens (`docs/plans/2.7b.md`) once 2.7a is merged | `banijjik-1.7b` | ADR-107 (2.7a), ADR-108 only if needed (2.7b) |

**Ownership:**
- **2.6** works in `apps/platform`, `platform/industry` (a read API and the settings-default check), and `routes/platform.ts`.
- **2.7a** works in `core/organization`, `apps/admin/src/{profile,staff}`, and one routes adapter.
- **2.7b** works in `apps/admin` settings pages and the `settings` and `custom-field` manifests' menu entries.
- Shared, add-only: the contracts and validation indexes, the i18n catalogs (platform catalogs mostly 2.6, main catalogs mostly 2.7a/b), `docs/04-DECISIONS.md`, `docs/14-API.md`, `docs/STATUS.md` (own row).

The machine rules and the wave-1/2 lessons above still apply. After wave 3, Phase 2 gets its **phase review** before Phase 3 starts.
