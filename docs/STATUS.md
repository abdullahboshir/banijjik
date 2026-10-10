# Status & Handoff

The agent updates this file at the **end of every session**. It is the only progress tracker.

**Start-of-session prompts (owner copies one):**
- **PLAN** (Opus): `Read AGENTS.md and docs/STATUS.md. PLAN session for card <id>: write docs/plans/<id>.md from docs/plans/_TEMPLATE.md. No application code. Ask me about any product decision.`
- **IMPLEMENT** (Sonnet): `Read AGENTS.md, docs/STATUS.md and docs/plans/<id>.md. IMPLEMENT card <id> exactly as planned. Stop and ask if the plan has a gap. Verify, then update STATUS.md.`
- **REVIEW** (Opus, T1 cards): `Read AGENTS.md and docs/plans/<id>.md. REVIEW branch s/<id>-… against the plan, AGENTS.md and the DoD. List findings by severity, fix confirmed ones, update STATUS.md.`
- **PHASE REVIEW** (Opus, end of each phase): `Read AGENTS.md, docs/STATUS.md, docs/03-ROADMAP.md and all handoffs of phase <n>. PHASE REVIEW for phase <n>: check cross-card consistency, the "Phase done" criteria and doc/code drift; run all checks without cache; list findings by severity; fix confirmed ones; write docs/handoffs/phase-<n>-review.md and update STATUS.md.`
- **DESIGN** (Opus, D cards): `Read AGENTS.md and docs/STATUS.md. Do card <id> from docs/03-ROADMAP.md: write the design doc only. Ask me about product decisions.`

Card flow: `todo → planned → implemented → reviewed (T1) / merge-checked (T2, T3) → done`. A phase is done only after its PHASE REVIEW passes.

Status values: `todo` · `doing` · `blocked (<why>)` · `done (<date>, <PR/commit>)`

## Phase P (owner)
| Card | Status | Note |
|---|---|---|
| P1 rotate secrets | todo | repo is public; `.env` was committed |
| P2 brand checks, domain, pricing | todo | brand = Banijjik (ADR-021), pending domain + trademark check |
| P3 pilot sellers | todo | |
| P4 Meta verification/app review | todo | long lead time |
| P5 courier/payment/SMS accounts | todo | |
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
| 0.3 API package, config & local infra | done (2026-10-10; real-port Docker check passed after a Docker Desktop restart: rs.ok 1, writable primary, transaction abort/commit, Redis PONG, MongoDB 8.0.32) | host 6379 is taken by another project on the owner machine: run with BANIJJIK_REDIS_PORT=6380 (default change planned with 1.5) |
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
| 1.3 tenant and location enforcement | merged (2026-10-10, Opus review passed after 2 fixes; ADR-087) | branch `s/1.3-tenant-enforcement`; handoff `docs/handoffs/1.3.md`; ADR-087. Plan amendments A/B/C from the coordinator are in the handoff. Gaps: no membership cache until 1.4 (two indexed reads per tenant request); entitlement and permission middleware slots empty (1.6/1.4); production `tenantRouters` is empty until 1.4 |
| 1.4 RBAC and permission cache | merged (2026-10-10, Opus review passed; ADR-088) | branch `s/1.4-rbac`; handoff `docs/handoffs/1.4.md`; ADR-088. Gaps: no membership cache and no Redis adapter for the permission cache (1.5); archive-vs-assignment race closes with the member endpoints (1.7); organization endpoints that use the `organization.*` keys come with 1.7 |
| 1.5a idempotency and audit log | merged (2026-10-10, Opus review passed; ADR-089) | branch `s/1.5a-idempotency-audit`; handoff `docs/handoffs/1.5a.md`; ADR-089. Idempotency-Key middleware on `POST /me/orgs`, append-only guard, `core/audit` with `GET /orgs/{organizationId}/audit-logs`. Parallel with 1.5b |
| 1.5b events, outbox, queue, worker | merged (2026-10-10, Opus review passed; ADR-090) | branch `s/1.5b-events-queue`; handoff `docs/handoffs/1.5b.md`; ADR-090. Gaps: no dead-letter replay tool; handler gating by module effectiveness in 1.6. Redis default port is now 6380 |
| 1.6a module registry, packages, resolver, gate, /me/config | merged (2026-10-10, Opus review passed after 3 fixes; ADR-091) | branch `s/1.6a-module-registry`; handoff `docs/handoffs/1.6a.md`; ADR-091. Gaps: the industry template reader is an interim (all modules, all kinds) until card 2.1 (template filter and PUBLISHED check at signup); `settings`/`fields`/`terms` empty until 2.3/2.4; real manifests have no menu entries until 1.7c; `StartTrial` does not bump `configVersion` (open question in the handoff); Questions for the planner: `courier`/`risk` are CORE with "tenant can disable: yes" in 10 §5 against 10 §1 (decide before card 5.2); kinds are computed before the dependency drop; the `$in` partial index on `platform_subscriptions` is unverified on MongoDB 8.0.13 until CI runs. Review fixes applied (gate answers 404, seed at startup, CORS exposed headers) |
| 1.6b new-module script and generated module-off tests | planned (2026-10-10, `docs/plans/1.6b.md`, Opus) | parallel with 1.7b |
| 1.7a admin sign in, sign up, business list and switcher | merged (2026-10-10, merge-checked by Opus; redirect loop guard added) | parallel with 1.6a; creating a business in the UI waits for 2.1/6.1 |
| 1.7b organization tenant API (profile, locations, members, invitations) | planned (2026-10-10, `docs/plans/1.7b.md`, Opus, T1) | invitation links are shared by hand until SMS/email sending exists (5.13) |
| 1.7c admin menu from /me/config, home, staff and locations screens | todo | after 1.6a + 1.7b |
| 1.8 platform skeleton | todo | |

## Phases 2–8
Track here once Phase 1 is done (copy the cards from the roadmap).

## Handoffs
One file per card: `docs/handoffs/<card>.md` (template: `docs/handoffs/_TEMPLATE.md`). Parallel sessions never edit the same handoff file. In this file, each session edits only its own card row.
