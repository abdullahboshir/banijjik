# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.

Last updated: 2026-10-26 (evening) by Cursor (lead, this session) · `main` = `origin/main` = `016bd228`. This branch adds plans 3.41–3.43; fast-forward `main` when the owner says yes.

## 1. Where the project stands
- **Claude plan ends 2026-10-29.** Operating manual: `docs/RUN-WITHOUT-CLAUDE.md`. Owner summary: `lead-orchestra/owner-guide/00-CLAUDE-CHARA.md`. This session is the Cursor lead.
- **Phase 3 review: PASS WITH FIXES.** Phase 4 code merges only after **3.40 (F1)** and **3.41 (F2)**. 3.40 A merged (`c328eac1`). 3.40 B ready. Plans for 3.41, 3.42, 3.43 written this session. 3.42 and 3.43 B wait for 3.40 B (shared admin folders). Track M: M.9 A2 merged; next M.9 B (owner go-live).
- **Owner decisions:** ADR-149 (each business website its own design); ADR-150 (full Phase 4 website before the pilot; 4.6 folded into 4.3). Owner still allows fast-forward of `main` after green CI — confirm at the start of a merge.
- Docker Desktop + Redis 6380 run; compose Mongo stays stopped (local Mongo on 27018). RAM 16 GB: two owner-tool cards at once, three at most. E: ~8 GB free.
- Force-push is blocked: `git merge origin/main` on card branches, or `s/merge-<card>`. 3.44/3.45: docs-only pushes skip CI; behind-main is INFO.

## 2. Open branches (checked 2026-10-26 evening)
**Ownership:** this Cursor lead session. No other lead session should touch `main` or `banijjik-docs`. Prompts: `E:/WEB-DEVELOPMENT/PROJECTS/business-platform/lead-orchestra/owner-guide/`. Final message: `STATUS: DONE | QUESTION | BLOCKED`. Never commit `.claude/settings.json` in `banijjik`.

| Card / part | Branch | Folder | Tier | State → next step |
|---|---|---|---|---|
| 3.40 B walk-in screens | `s/3.40-ui-walk-in-services` | `banijjik-m2` | T2 | Ready (`19-3.40-B.md`). On DONE: merge check vs plan 12–14 and `/pos` budget. |
| 3.41 day scenarios | `s/3.41-api-day-scenarios` | `banijjik-3.6b-a3` | T2 | Ready after this plan is on `main` (`20-3.41.md`). Blocks Phase 4. |
| 3.43 A API leftovers | `s/3.43-api-correctness` | `banijjik-3.5a` | T1 | Ready after this plan is on `main` (`21-3.43-A.md`). Strict T1 review. |
| 3.42 till leftovers | `s/3.42-ui-pos-till-leftovers` | `banijjik-m2` | T2 | After 3.40 B (`22-3.42.md`). |
| 3.43 B placeOrder key | `s/3.43-ui-place-idempotency` | `banijjik-lead` | T2 | After 3.40 B (`23-3.43-B.md`). |

Folders with `node_modules`: `banijjik`, `banijjik-1.7b`, `banijjik-lead`, `banijjik-m2`, `banijjik-3.11`, `banijjik-3.5a`, `banijjik-3.6b-a3`. `banijjik-docs` is light. Stash `owner-edits-AGENTS-and-05-CONVENTIONS`: never pop or drop.

## 3. Waiting on the owner
- Yes to fast-forward `main` with this plan branch (`s/docs-plan-phase-3-close`).
- Docker Desktop "Start when you sign in".
- Open product decisions: 3.9 offline selling; M.6 `noindex`; 3.5b refund-vs-commission (merged default).
- P1 rotate leaked secrets; M.9 B go-live (P5, P6); keep or drop the stashed AGENTS edits.

## 4. Next actions, in order
1. Owner says yes → fast-forward `main` to this docs branch so implementers see the plans.
2. Owner pastes `19-3.40-B.md` into a tool in `banijjik-m2`, and `20-3.41.md` into a tool in `banijjik-3.6b-a3`. Optional third: `21-3.43-A.md` in `banijjik-3.5a`.
3. On each DONE: `card:check` in that folder, then merge check (T2) or T1 review (3.43 A). Push `main` only after the owner says yes for that merge.
4. After 3.40 B merges: `22-3.42.md` and `23-3.43-B.md`.
5. After 3.40–3.43 merge: Phase 3 close re-check of F1–F4, then plan 4.1 (theme engine).
6. Non-blocking follow-ups stay in `phase-3-review.md` "Open items carried forward".

## 5. How the lead works
- Plans just in time, T1 reviews, merge checks. The tool that wrote code never approves it. Push `main` only when the owner says yes for that merge.
- Reply in Bengali script; code, comments and docs in English.
- Add-only on shared files. i18n conflicts: keep both sides joined by a comma. Never `--no-verify`. Commit headers not sentence-case, ≤ 100 characters.
- Docs commits: this folder, branch `s/docs-<slug>` from `main`, then fast-forward `main` after the owner says yes.
- Verify: `card:check` all PASS + green CI on the last code commit. Do not trust the implementer's report.

## 6. Session log (last five)
- **2026-10-26 evening** (Cursor lead): owner asked to finish Phase 3 with plans/guides for another tool. Wrote `docs/plans/3.41.md`, `3.42.md`, `3.43.md` and owner-guide `19` (already there) plus `20`–`23`. 3.40 B and 3.41 start in parallel once this branch is on `main`.
- **2026-10-26 day** (Opus 5.5, `banijjik-bd`): Claude ends 2026-10-29; `RUN-WITHOUT-CLAUDE.md`; ADR-150; 3.40 A merged (`c328eac1`); prompt `19-3.40-B.md`.
- **2026-10-26 after midnight, 2** (Opus 5.5, `banijjik-87`): 3.39 B merged; 3.40 A Amendment A-1; M.9 A2 pending CI then merged later.
- **2026-10-26 after midnight** (Opus 5.5, `banijjik-cd`): owner reconfirmed pushing `main`; 3.39 A merged.
- **2026-10-26 late night** (Opus 5.5, `banijjik-cd`): ADR-149; 3.44, M.9 A1, 3.38 merged; 3.40 planned.
