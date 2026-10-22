# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.

Last updated: 2026-10-22 (evening) by Sonnet 5.5 · `main` pushed to GitHub

## 1. Where the project stands
- Phase 3 merged: 3.0, 3.1a/b/c, 3.2a/b, 3.3, 3.4, 3.4b, 3.6, 3.8a, 3.8b, 3.8c, 3.12, 3.13, 3.14. Track M merged: M.1 to M.4. Details per card: `docs/STATUS.md`.
- `main` was pushed on 2026-10-22 (owner said yes). Cloud agents and new branches now see 3.6, M.3, M.4, 3.8b.
- Every plan and session follows `docs/plans/parallel-sessions-guide.md` (Part A API, Part B screens, finish checklist §8, review §10). Ready board §9 is stale (still shows 3.6 "running"); refresh it at the next merge.
- Plans written this session: 3.15 (test stability), 3.6b (rental and event bookings); refreshed: 3.8, 3.7 (last section of each). 3.7 has a lead decision on freeze (narrow exception: latest period end moves on unfreeze).

## 2. Open branches (checked 2026-10-22; none is pushed except main, so no CI has run on any)
| Card / part | Branch | Folder | Tier | State and next step |
|---|---|---|---|---|
| 3.8 Part A payments | `s/3.8-api-payments` | `banijjik-lead` | T1 | 2 commits (contracts, validation) plus about 28 uncommitted files (payment module, booking ports, contact, routes, grants). Not reviewed. Owner told the session: commit, push, CI green, finish checklist. Then strict T1 review. It must also supply the accounting `PaymentPostingSource` adapter (plan refresh item 3). |
| 3.7 Part A enrollment | `s/3.7-api-enrollment-v2` | `banijjik-1.7b` | T1 | No commits; uncommitted `enrollment/` module and booking `resource-exclusive-hold` files. The first attempt in folder `banijjik` was disturbed by a branch switch; old branch `s/3.7-api-enrollment` has no real work. Same instruction as above. |
| M.5 Part A credit purchase | `s/M.5-api-credit-purchases` | `banijjik` | T1 | 1 commit (contracts, validation, entity, repo) plus uncommitted files. Same instruction. |
| 3.5a Part A orders | `s/3.5a-api-orders` | `banijjik-3.5a` | T1 | 1 commit (sales vocabulary), 2 uncommitted files; hardly moved. Same instruction. |
| 3.15 test stability | `s/3.15-test-stability` (new) | `banijjik-m2` (empty) | T3 | Plan on main. Not started. Owner gives it to a session. |
| 3.6b rental/event Part A | `s/3.6b-api-rental-event` (new) | cloud agent or a free folder | T1 | Plan on main. Advice to the owner: start after 3.8 or 3.7 Part A merges (same `booking` files). |

Free folders: `banijjik-m2` (after M.4, empty). Do not run two sessions in one folder (it broke 3.7 once).

**CI on main:** run `39736146807` (commit `5de077a`, docs only) failed on `apps/admin` `branding-form.test.tsx` ("shows every preset by name…"), a timing flake from card 3.12; the lead re-ran the failed jobs. Check `gh run list --branch main`. If it fails again, treat it as a real bug and open a fix. Card 3.15 covers the known flakes (also `ordered-event-worker.test.ts`, `package-form.test.tsx`).

Stash `stash@{0}` in `banijjik` holds the owner's uncommitted edits to `AGENTS.md` and `docs/05-CONVENTIONS.md` ("Engineering safeguards"). The owner has not said keep or drop.

## 3. Waiting on the owner
- Sessions must report "done" (committed, pushed, CI green, handoff written) for 3.8, 3.7, M.5, 3.5a. Nothing can be merged before that; the lead does not merge unfinished branches.
- Standing permission to push `main` after each reviewed merge (asked three times; today's push was a one-time yes). Ask before each push.
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions (SMS provider, pricing, photo policy, domain, legal review).

## 4. Next actions, in order
1. Check `gh run list` for main and every pushed `s/**` branch; check each folder in §2 with `git log` and `git status` (the owner's sessions often leave work uncommitted).
2. For each card that reports done and has green CI: strict T1 review of the risky files (guide §10), findings back as a numbered list, then rebase on main, wait for green CI, fast-forward main, push (with permission). Order of arrival; each later branch rebases. Merge hot spots: `routes/*`, `start-worker.ts`, contracts index files, booking files (3.8, 3.7 and 3.6b all touch them), STATUS.md rows.
3. After 3.8 Part A merges: refresh and release 3.8 Part B, 3.11 plan, 3.9 plan inputs. After 3.5a Part A: 3.5a Part B, plan 3.5b. After M.5 Part A: M.5 Part B, plan M.6. After 3.7 Part A: 3.7 Part B; payment link for enrollment goes to 3.8 or a small follow-up (plan 3.7 refresh item 1).
4. Later: 3.9 POS, 3.11, 3.10, M.6 to M.9, then `docs/handoffs/phase-3-review.md`.
5. Follow-ups: reports and approval amounts in bookkeeping hardcode `"BDT"` (read the organization currency when a second currency is added). Admin script budget is 180 KiB (owner, 2026-10-22).

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
- **2026-10-22 evening** (Sonnet): pushed main (owner yes); refreshed plans 3.8 and 3.7, decided 3.7 freeze rule; wrote plans 3.15 and 3.6b; audited all branches (none done, none pushed, much uncommitted); found main CI flake and re-ran it; told the owner how to run sessions in separate folders.
- **2026-10-22 afternoon** (Sonnet): checked state (3.5a branch unpushed, one commit only), refreshed plans 3.8 and 3.7 against main (accounting adapter duty, existing payment contracts, bed-hold port risk for 3.7). No code merged.
- **2026-10-22 morning** (Sonnet): reviewed, rebased, pushed and merged 3.6, M.3, M.4 and 3.8b in that order, each green on CI. Fixed on the way: JS budget (contact credit section lazy, admin budget 180 KiB by owner), duplicate probe module in the platform browser stack, router builder length, long setting key overflow. All branches stayed unpushed to main.
- **2026-10-22 night** (Sonnet): rebased 3.6 on main (STATUS.md conflicts), CI green, reviewed R1 delta, fast-forwarded local main to `e5af140`. banijjik-lead folder is now free. M.3, M.4, 3.8b not yet reviewed; none pushed.
- **2026-10-22** (Opus): parallel sessions guide; plans 3.14, 3.5a, M.5; session parts for 3.7 and 3.8; pushed main `c4968f2`; implemented and merged 3.14 locally (CI green after one flaky rerun); token-usage analysis; created this file and the user-level `/lead` and `/save-state` skills. The owner reports 3.6, M.3, M.4 and 3.8b finished (not yet reviewed).
