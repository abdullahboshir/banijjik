# Lead state (planner and reviewer)

Last updated: 2026-10-31 by Codex · audit baseline `origin/main af785811`.

## 1. Where the project stands
- Phase 3 cards 3.40–3.43 are merged on origin/main. Phase 4 is in progress; do not label Phase 4 complete (4.4, 4.5 and formal phase review remain separate gates).
- 4.3 is NOT COMPLETE. Evidence matrix and closure blockers: `docs/handoffs/4.3-completion-check.md`.
- Main 4.3 parts A0–A4, B1–B3 are included in `origin/main`; A5A has four independent T1 blockers, A5B is uncommitted, V is uncommitted and not ready.
- All 15 mandatory COD parts have no implementation evidence on origin. COD-S1's Phase 3 prerequisite is now satisfied, but its refresh baseline is stale and independent T1 plan check is missing.
- Folded 4.6 acceptance tests remain unverified.
- No authorization to fast-forward any branch to main has been given in this session. Prepare verified branches and request the applicable owner yes as the final step.

## 2. Open branches / worktrees (checked 2026-10-31)
- `banijjik`, `s/4.3-a5a-request-projections-claim`: A5A handoff head `4af21a4c`, CI rerun running; fresh independent T1 review FAIL. Do not call done.
- `banijjik-4.3-a5a-fixes`, `s/4.3-a5a-review-fixes`: prepared isolated continuation; implementer agent assigned the four review fixes. Next: local verification, push branch, separate T1 re-review, green CI.
- `banijjik-4.1-a1`, `s/4.3-a5b-privacy-participants`: has uncommitted A5B code. Preserve; not completion evidence. Do not start until A5A review/CI and dependency merge gate are clear.
- `banijjik-1.7b`, `s/4.3-v-commerce-scenarios`: branch points at A5A; dirty V files are uncommitted and this is not the planned V branch. Preserve; V waits for A5B and all COD.
- `banijjik-4.3-audit`, `s/docs-4.3-audit`: interim completion matrix, corrected 4.3 STATUS row and this state update; local docs branch only, not pushed to main.
- No `s/4.3-cod-*` remote branches found.

## 3. Waiting on the owner
- Owner authorization is required before any main fast-forward (RUN-WITHOUT-CLAUDE.md §6.3 / AGENTS.md).
- No product/architecture decision found to ask for in the current COD-S1 refresh; stop and ask only if refreshed code surfaces a binding ambiguity.

## 4. Next actions in order
1. Finish the active A5A review-fix session and independently review its resulting branch; require exact-head green CI.
2. Confirm A5A integration readiness and resolve its main inclusion only after owner approval.
3. Refresh COD-S1 against current main, then obtain independent T1 plan check before implementation. Phase 3 gate is satisfied.
4. Follow exact COD order: S1 → S2 → S3 → C → R → P → J1 → J2 → I0 → I1 → I2 → I3 → B1 → B2 → V. Each later blueprint gets a just-in-time refresh and independent T1 check as applicable; one approved part per implementation session.
5. Finish A5B after A5A dependency; resolve its independent T1 review and green CI.
6. Close any A1 review follow-ups confirmed in current source; record tests/evidence.
7. Complete both V tracks only after all API/UI/COD dependencies merge; exercise real worker/outbox, all five kinds, privacy/claim/financial/report assertions, COD loss/recovery/corrections, 4.6 checks and storefront browser suite.
8. Update `docs/handoffs/4.3-completion-check.md` with exact implementation commits, reviews, local test output and green CI links; mark 4.3 complete only after every gate and owner-approved main inclusion.

## 5. Working rules
- One approved part per implementation session; separate branches/worktrees. No parallel part work unless phase-4-lanes explicitly pairs it.
- Lead plans, audits, reviews and coordinates; implementer and reviewer are different sessions/tools. Never approve own code.
- No whole monorepo suite locally. Every part runs planned/changed tests, touched workspace lint/typecheck and browser suite for screens before push; exact-head green CI before merge.
- No guessed design. Update only the relevant 4.3 STATUS row; maintain the completion handoff with evidence. Do not run 4.4/4.5 implementation in this task.
- Use `git merge origin/main` for pushed branches; never rebase/force-push. No main push without owner authorization.
- Storefront delivery options remain disabled until COD I0–I3 and V pass.

## 6. Session log (last five)
- 2026-10-31: reality audit corrected Phase 3 status from stale lead state; audited remote CI/branches/worktrees; A5A rerun requested after cancelled Build; fresh independent T1 review found four A5A blockers; assigned isolated fix session; wrote evidence-based NOT COMPLETE matrix.
- Earlier sessions: see prior main history and individual handoffs.
