# Status & Handoff

The agent updates this file at the **end of every session**. It is the only progress tracker.

**Start-of-session prompts (owner copies one):**
- **PLAN** (Opus): `Read AGENTS.md and docs/STATUS.md. PLAN session for card <id>: write docs/plans/<id>.md from docs/plans/_TEMPLATE.md. No application code. Ask me about any product decision.`
- **IMPLEMENT** (Sonnet): `Read AGENTS.md, docs/STATUS.md and docs/plans/<id>.md. IMPLEMENT card <id> exactly as planned. Stop and ask if the plan has a gap. Verify, then update STATUS.md.`
- **REVIEW** (Opus, T1 cards): `Read AGENTS.md and docs/plans/<id>.md. REVIEW branch s/<id>-… against the plan, AGENTS.md and the DoD. List findings by severity, fix confirmed ones, update STATUS.md.`
- **DESIGN** (Opus, D cards): `Read AGENTS.md and docs/STATUS.md. Do card <id> from docs/03-ROADMAP.md: write the design doc only. Ask me about product decisions.`

Card flow: `todo → planned → implemented → reviewed (T1) → done`.

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
| 0.1 archive & skeleton | planned (2026-10-09, `docs/plans/0.1.md`, Opus) | next: IMPLEMENT with Sonnet |
| 0.2 tooling & CI | todo | |
| 0.3 config & local infra | todo | |
| 0.4 API kernel | todo | |
| 0.5 admin skeleton | todo | |

## Phase 1
| Card | Status | Note |
|---|---|---|
| 1.1 IAM auth | todo | |
| 1.2 org/location/membership | todo | |
| 1.3 tenant & location enforcement | todo | |
| 1.4 RBAC & cache | todo | |
| 1.5 reliability kernel | todo | |
| 1.6 plans/entitlements/module gate | todo | |
| 1.7 admin auth & org shell | todo | |
| 1.8 platform skeleton | todo | |

## Phases 2–8
Track here once Phase 1 is done (copy the cards from the roadmap).

## Handoffs
One file per card: `docs/handoffs/<card>.md` (template: `docs/handoffs/_TEMPLATE.md`). Parallel sessions never edit the same handoff file. In this file, each session edits only its own card row.
