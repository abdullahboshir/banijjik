# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.

Last updated: 2026-10-22 (plans 3.8 and 3.7 refreshed) by Sonnet 5.5 · local main `433c179` · GitHub main `c4968f2` (not pushed; needs the owner's yes)

## 1. Where the project stands
- Phase 3 merged: 3.6, 3.8b, 3.0, 3.1a, 3.1b, 3.1c, 3.2a, 3.2b, 3.3, 3.4, 3.4b, 3.8a, 3.8c, 3.12, 3.13, 3.14 (CI for card branches). Track M merged: M.1, M.2, M.3, M.4. Details per card: `docs/STATUS.md`.
- From 2026-10-22, every plan and session follows `docs/plans/parallel-sessions-guide.md`: Part A (API) and Part B (screens) per card, file ownership, fast local checks, full verification on GitHub CI for every pushed `s/**` branch, one finish checklist. Ready board: guide §9.

## 2. Open branches
All four earlier cards (3.6, M.3, M.4, 3.8b) are merged into local `main`. Their branches and folders are free to reuse (`banijjik-lead`, `banijjik-1.7b`, `banijjik-m2`, `banijjik`); do not delete the branches until main is pushed.

| Branch | Folder | Tier | State and next step |
|---|---|---|---|
| `s/3.5a-api-orders` | `banijjik-3.5a` | T1 | Started by the owner's Cursor session (first commit `600b297`, uncommitted edits). Not reviewed. When it reports done: CI green, strict T1 review, merge. |

Known flaky test: `apps/api/src/kernel/events/ordered-event-worker.test.ts` times out now and then on CI (seen 3 times on 2026-10-22). Rerun failed jobs once. Plan a small fix card (condition-based wait) now: it costs a rerun on every card.

Stash `stash@{0}` in `banijjik` holds the owner's uncommitted edits to `AGENTS.md` and `docs/05-CONVENTIONS.md` ("Engineering safeguards"). Not lost; the owner has not said keep or drop.

## 3. Waiting on the owner
- **Push main** (local `main` is ahead of GitHub `c4968f2` by 3.14, 3.6, M.3, M.4, 3.8b). Needed so cloud agents and new branches see the CI rules and the merged cards. Standing permission to push `main` after each reviewed merge was asked twice and not answered; ask before pushing.
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older open items: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions (SMS provider, pricing, photo policy, domain, legal review).

## 4. Next actions, in order
1. Plans 3.8 and 3.7 are refreshed (last section of each, based on `8f4c63e`). Implementers can start **3.8 Part A** (payments; also supplies the accounting `PaymentPostingSource` adapter) and **3.7 Part A** (enrollment; no payment link, no `commerce/payment` edits). Still to write: **3.6b** (rental/event booking plan).
2. **M.5 Part A** (credit purchase) can start now (M.4 is merged).
3. **3.5a Part A** is running; review when done. Then Part B of 3.5a, 3.8, 3.7, M.5 after their Part A.
4. Small card: fix the flaky `ordered-event-worker` test.
5. Later: 3.5b, 3.9 POS, 3.11, 3.10, M.6 to M.9, then the Phase 3 review (`docs/handoffs/phase-3-review.md`).
6. Follow-ups noted in review: reports and approval amounts in bookkeeping hardcode `"BDT"` (fine while `CURRENCY_CODE` has only BDT; read the organization currency when a second currency is added). Admin script budget is now 180 KiB (owner, 2026-10-22); the contact credit section loads on demand.


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
- **2026-10-22 afternoon** (Sonnet): checked state (3.5a branch unpushed, one commit only), refreshed plans 3.8 and 3.7 against main (accounting adapter duty, existing payment contracts, bed-hold port risk for 3.7). No code merged.
- **2026-10-22 morning** (Sonnet): reviewed, rebased, pushed and merged 3.6, M.3, M.4 and 3.8b in that order, each green on CI. Fixed on the way: JS budget (contact credit section lazy, admin budget 180 KiB by owner), duplicate probe module in the platform browser stack, router builder length, long setting key overflow. All branches stayed unpushed to main.
- **2026-10-22 night** (Sonnet): rebased 3.6 on main (STATUS.md conflicts), CI green, reviewed R1 delta, fast-forwarded local main to `e5af140`. banijjik-lead folder is now free. M.3, M.4, 3.8b not yet reviewed; none pushed.
- **2026-10-22** (Opus): parallel sessions guide; plans 3.14, 3.5a, M.5; session parts for 3.7 and 3.8; pushed main `c4968f2`; implemented and merged 3.14 locally (CI green after one flaky rerun); token-usage analysis; created this file and the user-level `/lead` and `/save-state` skills. The owner reports 3.6, M.3, M.4 and 3.8b finished (not yet reviewed).
- **2026-10-20 to 21** (Opus): merged 3.8c, 3.4, 3.3 and M.2 together (`8258669`); planned 3.8b, M.3, M.4; reviewed 3.6 (R1: bookable service fields missing in the offering editor).
