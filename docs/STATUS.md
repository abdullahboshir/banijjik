# Status & Handoff

The agent updates this file at the **end of every session**. It is the only progress tracker.

**Start-of-session prompts (owner copies one):**
- **PLAN** (Opus): `Read AGENTS.md and docs/STATUS.md. PLAN session for card <id>: write docs/plans/<id>.md from docs/plans/_TEMPLATE.md. No application code. Ask me about any product decision.`
- **IMPLEMENT** (Sonnet): `Read AGENTS.md, docs/STATUS.md and docs/plans/<id>.md. IMPLEMENT card <id> exactly as planned. Stop and ask if the plan has a gap. Verify, then update STATUS.md.`
- **REVIEW** (Opus, T1 cards): `Read AGENTS.md and docs/plans/<id>.md. REVIEW branch s/<id>-… against the plan, AGENTS.md and the DoD. List findings by severity, fix confirmed ones, update STATUS.md.`
- **PHASE REVIEW** (Opus, end of each phase): `Read AGENTS.md, docs/STATUS.md, docs/03-ROADMAP.md and all handoffs of phase <n>. PHASE REVIEW for phase <n>: check cross-card consistency, the "Phase done" criteria and doc/code drift; run all checks without cache; list findings by severity; fix confirmed ones; write docs/handoffs/phase-<n>-review.md and update STATUS.md.`
- **DESIGN** (Opus, D cards): `Read AGENTS.md and docs/STATUS.md. Do card <id> from docs/03-ROADMAP.md: write the design doc only. Ask me about product decisions.`

Card flow: `todo → planned → implemented → reviewed (T1) / merge-checked (T2, T3) → done`. A phase is done only after its PHASE REVIEW passes.

Status values: `todo` · `doing` · `blocked (<why>)` · `implemented (awaiting review)` · `merged (<date>)` · `done (<date>, <PR/commit>)`

## Phase P (owner)
| Card | Status | Note |
|---|---|---|
| P1 rotate secrets | todo | repo is public; `.env` was committed |
| P2 brand checks, domain, pricing | todo | brand = Banijjik (ADR-021), pending domain + trademark check |
| P3 pilot businesses | todo | launch focus (ADR-099): salons and parlours, gyms, coaching centres; review their template fields and gather their top daily pains |
| P4 Meta verification/app review | todo | long lead time |
| P5 courier/payment/SMS accounts | todo | an SMS provider account is needed before the pilot (card 5.13, launch track) |
| P6 hosting | todo | |

## Phase D (design, docs only; `done` only after owner approval)
| Card | Status | Note |
|---|---|---|
| D1 glossary & domain model | done (2026-10-09, branch s/D1-domain-model) | approved by owner; Q1–Q4 answered in 09 §9 |
| D2 module catalog & packages | done (2026-10-09, `f6770ed`, approved by owner) | needed by 1.6 |
| D3 offering kinds & request lifecycles | done (2026-10-09, `7af39c5`, approved by owner) | needed by Phase 2/3 |
| D4 industry templates (8) | done (2026-10-09, `35582a0`, approved by owner) | needed by Phase 2 |
| D5 bot tools & golden conversations | todo | needs P3 real chats |
| D6 UX & design system | done (2026-10-09, `8f74698`, approved by owner) | needed by 0.5 |
| D7 API surface | done (2026-10-09, `693f958`, approved by owner) | |
| D8 manoxen port map | done (2026-10-09, `8aa24bf`, approved by owner) | needed by Phase 3 |

## Phase 0
| Card | Status | Note |
|---|---|---|
| 0.1 archive & skeleton | done (2026-10-10, `b772501`, merge-checked by Opus: build/typecheck/test pass without cache) | apps/api + infra moved to 0.3 (owner); build, typecheck, test pass |
| 0.2a lint, format, hooks | done (2026-10-10, `c823fcc`, Opus review passed) | T1; parallel with 0.3; docs/ excluded from Prettier, see handoff |
| 0.2b CI, secret scan, PR template, Claude hook | merged (2026-10-10, `40f4f4f`, merge-checked by Opus; first GitHub CI run unverified until the owner pushes) | after 0.2a + 0.3 |
| 0.3 API package, config & local infra | done (2026-10-10; real-port Docker check passed after a Docker Desktop restart: rs.ok 1, writable primary, transaction abort/commit, Redis PONG, MongoDB 8.0.32) | Redis host port default is 6380 (recorded with 1.5b; host 6379 is taken by another project) |
| 0.4a HTTP kernel, logger, context, app entry | merged (2026-10-10, Opus review passed after 6 fixes) | SIGTERM spawn test skipped on Windows (see handoff) |
| 0.4b DB kernel, transactions, sequences, runAsSystem | merged (2026-10-10, Opus review passed after 3 fixes; ADR-084) | production index-sync task still needed before first deploy (see handoff) |
| 0.5a design system and i18n packages | merged (2026-10-10, merge-checked by Opus; link context added, bottom nav at lg) | branch `s/0.5a-ui-i18n`; handoff `docs/handoffs/0.5a.md`; parallel with 0.2b/0.4a/0.4b |
| 0.5b admin app skeleton | merged (2026-10-10, merge-checked by Opus; Lighthouse mobile performance 0.95, accessibility 1.00; no ssr:false) | known gap: simulated LCP 2.9 s vs 2.5 s, recheck on a real phone in 6.4 (font budget set to 140 KB by the owner, 2026-10-10); Work/Catalog menu keys to confirm in 1.6 |
| 0.6a phase 0 review fixes: API kernel and lint | merged (2026-10-11, Opus review passed; ADR-085) | branch `s/0.6a-review-fixes-api`; handoff `docs/handoffs/0.6a.md`; fixes B1, J1, J2, J4, J5 and the api/lint minors; tests ran on local MongoDB 8.2.5, pinned 8.0.13 still to be run in CI; `packages/ui` build config left to 0.6b |
| 0.6b phase 0 review fixes: UI, admin, CI, docs | merged (2026-10-10, `3b3e2a4`, merge-checked by Opus) | J3 proven fixed in a real browser; 4 drift rows in apps/api files and the `storeId` lint entry are left to 0.6a |
| Phase 0 review | PASS (2026-10-11): the blocker, all 5 majors and the minors of `docs/handoffs/phase-0-review.md` are fixed in 0.6a/0.6b and re-verified without cache (23/23 tasks; api 153, ui 118, lint fixtures 214, admin 25) | open owner items: real-port Docker check (0.3), first GitHub CI run incl. the Windows-skipped SIGTERM test and MongoDB 8.0.13, P1 secret rotation. Phase 1 may start. |

## Phase 1
| Card | Status | Note |
|---|---|---|
| 1.1 IAM auth | merged (2026-10-10, Opus review passed) | phone or email + password, 30-day sliding sessions, register included (owner); OTP and password reset wait for SMS/email sending |
| 1.2 org, location, membership | merged (2026-10-10, Opus review passed after 1 fix; ADR-086) | branch `s/1.2-org-location`; handoff `docs/handoffs/1.2.md`. Gaps: verified identifier before public signup (6.1); template publish check and trial subscription on `POST /me/orgs` (1.6); events declared, not emitted (1.5); Idempotency-Key on `POST /me/orgs` (1.5); 1.3 must place the cross-org membership lookup (see handoff). Runs alone: 1.4 waits for Redis (Docker down) |
| 1.3 tenant and location enforcement | merged (2026-10-10, Opus review passed after 2 fixes; ADR-087) | branch `s/1.3-tenant-enforcement`; handoff `docs/handoffs/1.3.md`; ADR-087. Plan amendments A/B/C from the coordinator are in the handoff. Gaps: no membership cache (dropped for now, ADR-087); entitlement and permission middleware shipped in 1.6 and 1.4 |
| 1.4 RBAC and permission cache | merged (2026-10-10, Opus review passed; ADR-088) | branch `s/1.4-rbac`; handoff `docs/handoffs/1.4.md`; ADR-088. Gaps: no membership cache and no Redis adapter for the permission cache (1.5); archive-vs-assignment race closes with the member endpoints (1.7); organization endpoints that use the `organization.*` keys come with 1.7 |
| 1.5a idempotency and audit log | merged (2026-10-10, Opus review passed; ADR-089) | branch `s/1.5a-idempotency-audit`; handoff `docs/handoffs/1.5a.md`; ADR-089. Idempotency-Key middleware on `POST /me/orgs`, append-only guard, `core/audit` with `GET /orgs/{organizationId}/audit-logs`. Parallel with 1.5b |
| 1.5b events, outbox, queue, worker | merged (2026-10-10, Opus review passed; ADR-090) | branch `s/1.5b-events-queue`; handoff `docs/handoffs/1.5b.md`; ADR-090. Gaps: no dead-letter replay tool; handler gating by module effectiveness in 1.6. Redis default port is now 6380 |
| 1.6a module registry, packages, resolver, gate, /me/config | merged (2026-10-10, Opus review passed after 3 fixes; ADR-091) | branch `s/1.6a-module-registry`; handoff `docs/handoffs/1.6a.md`; ADR-091. Gaps: the industry template reader is an interim (all modules, all kinds) until card 2.1 (template filter and PUBLISHED check at signup); `settings`/`fields`/`terms` empty until 2.3/2.4; real manifests have no menu entries until 1.7c; `StartTrial` does not bump `configVersion` (accepted by the reviewer, ADR-091); Questions for the planner: `courier`/`risk` are CORE with "tenant can disable: yes" in 10 §5 against 10 §1 (decide before card 5.2); kinds are computed before the dependency drop; the `$in` partial index on `platform_subscriptions` is unverified on MongoDB 8.0.13 until CI runs. Review fixes applied (gate answers 404, seed at startup, CORS exposed headers) |
| 1.6b new-module script and generated module-off tests | merged (2026-10-10, merge-checked by Opus) | the generated module-off suite covers no production module until the first CORE or OPTIONAL module (Phase 3). That card must check the suite lists it. Also still open: record model ownership (`moduleKey` on `registerModel`) so the "data untouched" check needs no hand-kept map; contracts registries for settings, bot tools and sections |
| 1.7a admin sign in, sign up, business list and switcher | merged (2026-10-10, merge-checked by Opus; redirect loop guard added) | parallel with 1.6a; creating a business in the UI waits for 2.1/6.1 |
| 1.7b organization tenant API (profile, locations, members, invitations) | merged (2026-10-10, Opus review passed after 3 fixes; ADR-092) | branch `s/1.7b-org-tenant-api`; handoff `docs/handoffs/1.7b.md`; ADR-092. Gaps: the admin menu entries of decision 12 move to card 1.7c (it designs the "only with 2 or more locations" flag and updates the three menu assertions in `entitlement-api.test.ts`); invitation links are shared by hand until SMS/email sending exists (5.13); the identifier match is the only binding until identifiers are verified; existing databases keep the old full unique index on `locations.name` until the index-sync task exists |
| 1.7c admin menu, home banners, staff and invitations | merged (2026-10-11, merge-checked by Opus; all routes ≤ 170 KiB after trimming) | branch `s/1.7c-admin-menu-staff`; handoff `docs/handoffs/1.7c.md`. Browser round trip works; all five routes fit the 170 KiB budget after trimming. Gaps: audit-log history link not shown; profile and locations menu entries lead to 1.7d routes; suspended-business shell unit tested only |
| 1.7d admin business profile, locations and roles screens | merged (2026-10-11, merge-checked by Opus) | gap: optional profile and location fields cannot be cleared (the PATCH API has no way to unset a field); roles and locations lists show the first 100 without paging UI |
| 1.8a platform API: operator sign-in, tenants, packages, module grants | merged (2026-10-11, Opus review passed after 4 fixes; ADR-093 proposed, owner confirmation pending) | T1; branch `s/1.8a-platform-api`; handoff `docs/handoffs/1.8a.md`; ADR-093 (role mapping is a proposal). Opus fixes applied (handoff "Review fixes"); api tests need `VITEST_MAX_WORKERS=2` on a low-memory machine |
| 1.8b platform web app | merged (2026-10-11, merge-checked by Opus) | role mapping (ADR-093) still a proposal; no browser test with SUPPORT or BILLING operators; Lighthouse not run for the platform app |
| 1.9a phase 1 review fixes: access control (iam, organization) | merged (2026-10-12, Opus review passed) | review M3 (organization-level permissions held at one location) is decided by the lead under owner delegation and lands in card 1.9c |
| 1.9b phase 1 review fixes: plugin bypass, system-access lint, production indexes | merged (2026-10-12, Opus review passed; ADR-094 proposed) | release step: run `npm run db:sync-indexes -w @banijjik/api` on every deploy; the old full unique index on `locations.name` must be dropped by hand where it exists |
| 1.9c phase 1 follow-up: recorded decisions, location-aware staff management, clearable fields | merged (2026-10-12, Opus review passed; ADR-095) | branch `s/1.9c-decisions-reach-clearable`; handoff `docs/handoffs/1.9c.md`; ADR-095. Redis 6380 = owner decision 2026-10-11; platform roles and the location-manager rule = decided by the lead under owner delegation. Open: location and role keys still reported per location in `/me/config` |
| 1.9d phase 1 minors, part 1: abuse limits, readiness, outbox, config hardening | merged (2026-10-13, implemented with Cursor, Claude review 2 passed; ADR-096 proposed) | branch `s/1.9d-abuse-limits`; handoff `docs/handoffs/1.9d.md`; ADR-096 and notes in ADR-087, ADR-089, ADR-090. Lead decisions in it (login throttling, proxy hops, per-user limit, readiness) are proposals the owner may override. Open: the worker has no readiness check, and requiring Redis for the worker is left to the owner (the worker role has no HTTP endpoint, so the readiness change applies to the API role only). Event dispatch order is unchanged: per-organization ordering is required before card 3.8 (ledger posting). Until billing (6.2) every organization becomes READ_ONLY 21 days after signup unless an operator extends the trial. M10 (no membership cache) and M4 (idempotency scope = organization) are recorded in ADR-087 and ADR-089 |
| 1.9e phase 1 minors, part 2: shared helpers, one concept per file, lint gaps, docs | merged (2026-10-13, implemented with Cursor, Claude review 2 passed) | branch `s/1.9e-hygiene-docs`; handoff `docs/handoffs/1.9e.md`. No behaviour change. New lint rules R37 (JSX text in `apps/admin` and `apps/platform`; a new app must be added to the rule's `files`) and R38 (bare `id` in domain and contracts). A "cast without a comment" rule needs a custom plugin (ADR-082), so it stays a review checklist item. `maskEmail` / `maskPhone` stay two helpers by design. All Phase 1 review minors are now closed except M14 (card 1.10) and M13 (checked by the first CORE/OPTIONAL module card) |
| 1.10a platform operator management API | merged (2026-10-13, implemented with Cursor, Claude T1 review passed) | branch `s/1.10a-operator-api`; handoff `docs/handoffs/1.10a.md`. `/platform/operators` (14 §7): list, read, grant, roles, disable/enable, SUPER_ADMIN only, audited; the last active SUPER_ADMIN cannot be removed even under concurrency. Closes the API half of review M14; operator sign-in stays unaudited (ADR-093). Screens are 1.10b |
| 1.10b platform operator screens | merged (2026-10-14, implemented with Cursor, Claude review passed; closes M14) | branch `s/1.10b-operator-screens`; handoff `docs/handoffs/1.10b.md`. Super admin list, add, change roles, disable and enable on the 1.10a API. `/operators` initial JS 155.4 KiB. Not merged, not pushed |
| 1.10c make the first GitHub CI run green | merged (2026-10-13, implemented with Cursor, Claude merge check 3 passed; GitHub CI green on PR #1, api 1275 on MongoDB 8.0.13) | branch `s/1.10c-ci-green`; handoff `docs/handoffs/1.10c.md`. CI test step is `turbo run test --concurrency=2 --continue`, jsdom timeouts raised, runner pinned to `ubuntu-24.04`. `test.passThroughEnv` is `CI`, `TEST_REDIS_URL`, `MONGOMS_*`, `VITEST_MAX_WORKERS`. The new-module lint helper disables typescript-eslint single-run inference so `CI=true` still sees files written in the test. Not pushed |
| Phase 1 review | PASS (2026-10-12): both blockers and all five majors of `docs/handoffs/phase-1-review.md` are fixed in 1.9a/1.9b/1.9c and re-verified by the lead (turbo 29/29, api 1144 passed + 1 skipped, both browser suites); the minors are planned as 1.9d and 1.9e | from 1.9d on, cards are implemented with Cursor and reviewed by Claude: `docs/ops/implement-with-cursor.md`. Owner items: push `main`, P1 secret rotation, `db:sync-indexes` on every deploy |

## Phase 2
| Card | Status | Note |
|---|---|---|
| 2.1a industry templates: model, seeds, real reader, signup check | merged (2026-10-14, implemented with Cursor, Claude T1 review passed) | branch `s/2.1a-industry-templates`; handoff `docs/handoffs/2.1a.md`; ADR-097 proposed. Closes the 1.6a interim template reader (allow-all). Not merged, not pushed |
| 2.1b industry templates: platform writes | planned (2026-10-14 on 8291363, `docs/plans/2.1b.md`, Opus; T1, wave 1) | create, edit, publish, retire, change an organization's template (additive, ADR-046); planned after 2.1a. A signup racing a retire must be serialized with a guard-document touch on the template (ADR-092): 2.1a's second read inside the transaction does not serialize on its own |
| 2.2 resolver integration: terms, settings and fields in the resolved config, tenant-disabled optional modules | todo (wave 2) | after 2.3 and 2.4; owns terms (`TermOverride`, `/terms`) |
| 2.3 custom field engine (API) | merged (2026-10-14, implemented with Cursor, Claude T1 review 2 passed; ADR-102 proposed) | branch `s/2.3-custom-fields`; handoff `docs/handoffs/2.3.md`. Seed fields are labelled. Not merged, not pushed |
| 2.4 settings engine | implemented (awaiting review) | branch `s/2.4-settings`; handoff `docs/handoffs/2.4.md`; ADR-103 proposed. Rebased onto main after 2.3. Full turbo, lint, format and browser suites wait for this session's turn |
| 2.5 dynamic form renderer | todo (wave 2) | after 2.3 |
| 2.6 platform UI: template, module and field builders | todo (wave 3) | pair with 2.7 |
| 2.7 tenant UI: settings and tenant custom fields | todo (wave 3) | pair with 2.6 |

## Phases 3–8
Track here once Phase 2 is done (copy the cards from the roadmap).

## Handoffs
One file per card: `docs/handoffs/<card>.md` (template: `docs/handoffs/_TEMPLATE.md`). Parallel sessions never edit the same handoff file. In this file, each session edits only its own card row.
