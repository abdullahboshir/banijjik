# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.

Last updated: 2026-10-22 (night) by Sonnet 5.5 · local main `e5af140` (3.6 merged) · GitHub main `c4968f2` (local is 8 commits ahead, incl. 3.14; push needs the owner's yes)

## 1. Where the project stands
- Phase 3 merged: 3.0, 3.1a, 3.1b, 3.1c, 3.2a, 3.2b, 3.3, 3.4, 3.4b, 3.8a, 3.8c, 3.12, 3.13, 3.14 (CI for card branches). Track M merged: M.1, M.2. Details per card: `docs/STATUS.md`.
- From 2026-10-22, every plan and session follows `docs/plans/parallel-sessions-guide.md`: Part A (API) and Part B (screens) per card, file ownership, fast local checks, full verification on GitHub CI for every pushed `s/**` branch, one finish checklist. Ready board: guide §9.

## 2. Open branches
The owner reported on 2026-10-22 that all four are fixed and finished. None has been reviewed since. They branch from a main **without** card 3.14, so CI runs on them only after a rebase onto a main that has 3.14 (and, for GitHub, after 3.14 is pushed).

| Branch | Folder | Tier | State and next step |
|---|---|---|---|
| `s/m3-moderation-screens` | `banijjik-1.7b` | T2 | Head `f2ecb32`, based on an old 3.6 head (`cdd75a1`). After 3.6 merges: rebase on main (drop the duplicated 3.6 commits), push, CI, merge check, merge. |
| `s/m4-credits` | `banijjik-m2` | T1 | Head `3fd0c89` fixes B1 (storefront credit routes not module-gated) and B2 (`CreditEntry` not append-only) from `docs/handoffs/M.4-review.md`. Review the delta, rebase, push, CI, merge. |
| `s/3.8b-bookkeeping` | `banijjik` | T1 | Head `997d13c`. The folder has **uncommitted out-of-scope edits** to `AGENTS.md` and `docs/05-CONVENTIONS.md` ("Engineering safeguards"); do not let them into the card. Full T1 review, rebase, push, CI, merge. |

Known flaky test (from 3.14): `apps/api/src/kernel/events/ordered-event-worker.test.ts` › "runs a replayed event again with fresh attempts…" timed out once on CI and passed on rerun. Rerun once; plan a small fix card (condition-based wait) when it repeats.

## 3. Waiting on the owner
- **Push main** (`798b934`, includes 3.14). Needed before rebased card branches and cloud agents get CI on GitHub. Standing permission to push `main` after each reviewed merge was asked; until it is given, ask before each push.
- Keep or drop the `AGENTS.md` / `05-CONVENTIONS.md` edits found in the 3.8b folder.
- Older open items: P1 rotate leaked secrets (repo is public), phone usability check (deferred by the owner), doc 16 §6 matrimony decisions (SMS provider, pricing, photo policy, domain, legal review).

## 4. Next actions, in order
1. Review and merge, one by one, each rebased on main, pushed, green on CI: **M.3 → M.4 → 3.8b** (3.6 is merged locally: CI run 39721717696 green, R1 delta reviewed). Note: rebasing STATUS.md rows conflicts every commit; resolve by keeping main's side and check `git grep "^<<<<<<<"` before pushing.
2. Implementers now: **3.5a Part A** (prompt in the guide §6, branch `s/3.5a-api-orders`). It needs a free folder or a cloud agent; local folders free up as the four branches merge.
3. After 3.6 merges: refresh plans **3.8** and **3.7** (based on `3c0165b`, older than 3.8c and 3.6), then 3.8 Part A and 3.7 Part A; write the **3.6b** plan.
4. After M.4 merges: **M.5 Part A**.
5. After each Part A merges: its Part B (3.5a, 3.8, 3.7, M.5).
6. Later: 3.5b, 3.9 POS, 3.11, 3.10, M.6 to M.9, then the Phase 3 review (`docs/handoffs/phase-3-review.md`).

## 5. How the lead works
- **Role:** plans (just in time), strict T1 reviews, merge checks, integration (rebases, conflicts), fast-forward of `main`. Implementation is done by the owner's Cursor sessions (sometimes Claude Code or Qoder), not by the lead, unless the owner asks.
- **Language:** reply to the owner in Bengali script; code, comments and docs in English.
- **Review:** read the diff against the plan and `AGENTS.md`; try to break T1 security, money, stock and concurrency rules; require a green CI run on the branch head. Never accept an implementer's report as proof; check branches and commits yourself (Cursor chats often leave work uncommitted or claim parts done that are missing).
- **Integration habits:** Cursor branches tend to refactor `routes/v1.ts` and the router builders. Keep the 3.8c layout (`routes/core-tenant-routers.ts`, `routes/tenant-module-routers.ts`, `routes/iam-tenant-router.ts`). i18n catalog end-of-file conflicts: keep both sides joined by a comma. Keep `\\.` escaping in `eslint/restrictions.mjs`.
- **Folders:** one chat per folder. `banijjik`, `banijjik-1.7b`, `banijjik-lead`, `banijjik-m2` have their own `node_modules`. `banijjik-docs` is light: its `node_modules` is a junction to `banijjik`'s (enough for the commit hooks; not for builds). Disk is nearly full (E: about 5.5 GB, C: about 4.3 GB free), so there are no new full folders. Extra sessions run as cloud agents.
- **Docs commits:** in `banijjik-docs`, `git switch -c s/docs-<slug> main`, commit, then from any folder `git fetch . s/docs-<slug>:main` (fast-forward only).
- **Local verify** (only for integration of several branches; one heavy run at a time): environment `MONGOMS_SYSTEM_BINARY="C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe" MONGOMS_VERSION_CHECK=false TEST_REDIS_URL=redis://127.0.0.1:6380 NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 NEXT_PUBLIC_BRAND_NAME=Example CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"`. Then `npm run lint`, `npm run format:check`, `VITEST_MAX_WORKERS=2 npx turbo run build typecheck test --force --env-mode=loose --concurrency=1 --continue`, and the browser suites with `VITEST_MAX_WORKERS=1 npm run test:browser` in `apps/admin` and `apps/platform`. Move `apps/api/.env` aside during the run (it exists only in `banijjik`) and put it back. Docker (`infra/docker-compose.yml`: Mongo 27018, Redis 6380) may need starting after a reboot; never touch other containers.
- **Never:** `--no-verify`, resetting existing commits, committing `.env` files, printing env values, pushing `main` without permission.
- **Token cost** (measured 2026-10-22): about 90% of a day's usage went to carrying a 900k-token session, mostly full cache rewrites after a break of over an hour or a `/model` switch. Keep sessions short: one task, then `/save-state`, then a new session with `/lead`.

## 6. Session log (last five)
- **2026-10-22 night** (Sonnet): rebased 3.6 on main (STATUS.md conflicts), CI green, reviewed R1 delta, fast-forwarded local main to `e5af140`. banijjik-lead folder is now free. M.3, M.4, 3.8b not yet reviewed; none pushed.
- **2026-10-22** (Opus): parallel sessions guide; plans 3.14, 3.5a, M.5; session parts for 3.7 and 3.8; pushed main `c4968f2`; implemented and merged 3.14 locally (CI green after one flaky rerun); token-usage analysis; created this file and the user-level `/lead` and `/save-state` skills. The owner reports 3.6, M.3, M.4 and 3.8b finished (not yet reviewed).
- **2026-10-20 to 21** (Opus): merged 3.8c, 3.4, 3.3 and M.2 together (`8258669`); planned 3.8b, M.3, M.4; reviewed 3.6 (R1: bookable service fields missing in the offering editor).
- **2026-10-19** (Opus): merged M.1 and 3.4b; planned 3.4, 3.4b, 3.6, 3.8, 3.8c, 3.3, 3.7, M.2.
