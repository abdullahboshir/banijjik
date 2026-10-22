# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.

Last updated: 2026-10-22 (late evening) by Opus 5.5 · GitHub `main` is `072fb8f` (CI run `39748953629` green); local `main` is ahead with docs-only commits (plan 3.16, this save), not pushed

## 1. Where the project stands
- Phase 3 merged: 3.0, 3.1a/b/c, 3.2a/b, 3.3, 3.4, 3.4b, 3.6, 3.8a, 3.8b, 3.8c, 3.12, 3.13, 3.14. Track M merged: M.1 to M.4. Details per card: `docs/STATUS.md`.
- `main` was pushed on 2026-10-22 (owner said yes). Cloud agents and new branches now see 3.6, M.3, M.4, 3.8b.
- Every plan and session follows `docs/plans/parallel-sessions-guide.md` (Part A API, Part B screens, finish checklist §8, review §10). Ready board §9 is stale (still shows 3.6 "running"); refresh it at the next merge.
- Plans on main: 3.15 (test stability), 3.6b (rental and event bookings), 3.16 (dead-letter replay race, new); refreshed: 3.8, 3.7. 3.7 has a lead decision on freeze (narrow exception: latest period end moves on unfreeze).
- Kernel defect found by the 3.15 session and confirmed by the lead: the dead-letter replayer can write REPLAYED while BullMQ ignores the new job (old job still `active`). Not fixed in 3.15 (T3, no production code); card 3.16 (T1) fixes it in the replayer only.

## 2. Open branches (checked 2026-10-22; none is pushed except main, so no CI has run on any)
| Card / part | Branch | Folder | Tier | State and next step |
|---|---|---|---|---|
| 3.8 Part A payments | `s/3.8-api-payments` | `banijjik-lead` | T1 | 2 commits (contracts, validation) plus about 28 uncommitted files (payment module, booking ports, contact, routes, grants). Not reviewed. Owner told the session: commit, push, CI green, finish checklist. Then strict T1 review. It must also supply the accounting `PaymentPostingSource` adapter (plan refresh item 3). |
| 3.7 Part A enrollment | `s/3.7-api-enrollment-v2` | `banijjik-1.7b` | T1 | No commits; uncommitted `enrollment/` module and booking `resource-exclusive-hold` files. The first attempt in folder `banijjik` was disturbed by a branch switch; old branch `s/3.7-api-enrollment` has no real work. Same instruction as above. |
| M.5 Part A credit purchase | `s/M.5-api-credit-purchases` | `banijjik` | T1 | 1 commit (contracts, validation, entity, repo) plus uncommitted files. Same instruction. |
| 3.5a Part A orders | `s/3.5a-api-orders` | `banijjik-3.5a` | T1 | 1 commit (sales vocabulary), 2 uncommitted files; hardly moved. Same instruction. |
| 3.15 test stability | `s/3.15-test-stability` | `banijjik-m2` | T3 | Running (the session first asked for 3.6b; the lead gave it 3.15 instead). Scope stays tests only; the replayer race goes in its handoff as a known gap. |
| 3.16 dead-letter replay race | `s/3.16-dead-letter-replay-race` (new) | `banijjik-m2` after 3.15, or a cloud agent | T1 | Plan on main. Not started. Failing unit test first, then the fix; strict T1 review of `dead-letter-replayer.ts`. |
| 3.6b rental/event Part A | `s/3.6b-api-rental-event` (new) | none yet | T1 | Plan on main. **Waits** until 3.8 or 3.7 Part A merges (same `booking` files); no new full folder (disk). |

Free folders: none (`banijjik-m2` runs 3.15). Do not run two sessions in one folder (it broke 3.7 once).

**Stray 3.7 files in `banijjik` (the M.5 folder):** an older copy of 3.7 work sits there uncommitted: `commerce/enrollment/`, the booking `resource-exclusive-hold*` files, and small edits in booking `index.ts` and `register-booking-models.ts`. The newer copy is in `banijjik-1.7b` (only `resource-exclusive-hold.schema.ts` differs). The M.5 session was told to stage by file name and never commit them. Delete them only after the owner says yes and after comparing that schema file. When reviewing M.5, check that no booking or enrollment file is in the diff.

**CI on main:** green on `072fb8f` (run `39748953629`). Known flakes (`branding-form.test.tsx`, `ordered-event-worker.test.ts`, `package-form.test.tsx`) are card 3.15.

Stash `stash@{4}` ("owner-edits-AGENTS-and-05-CONVENTIONS…") in `banijjik` holds the owner's uncommitted edits to `AGENTS.md` and `docs/05-CONVENTIONS.md` ("Engineering safeguards"). The owner has not said keep or drop.

## 3. Waiting on the owner
- Sessions must report "done" (committed, pushed, CI green, handoff written) for 3.8, 3.7, M.5, 3.5a. Nothing can be merged before that; the lead does not merge unfinished branches.
- Standing permission to push `main` after each reviewed merge (asked three times; today's push was a one-time yes). Ask before each push.
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Yes or no: delete the stray 3.7 copy in `banijjik` once M.5 is committed (see §2).
- Who runs 3.16 (after 3.15 in `banijjik-m2`, or a cloud agent).
- Older: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions (SMS provider, pricing, photo policy, domain, legal review).

## 4. Next actions, in order
1. Check `gh run list` for main and every pushed `s/**` branch; check each folder in §2 with `git log` and `git status` (the owner's sessions often leave work uncommitted).
2. For each card that reports done and has green CI: strict T1 review of the risky files (guide §10), findings back as a numbered list, then rebase on main, wait for green CI, fast-forward main, push (with permission). Order of arrival; each later branch rebases. Merge hot spots: `routes/*`, `start-worker.ts`, contracts index files, booking files (3.8, 3.7 and 3.6b all touch them), STATUS.md rows.
3. After 3.8 Part A merges: refresh and release 3.8 Part B, 3.11 plan, 3.9 plan inputs. After 3.5a Part A: 3.5a Part B, plan 3.5b. After M.5 Part A: M.5 Part B, plan M.6. After 3.7 Part A: 3.7 Part B; payment link for enrollment goes to 3.8 or a small follow-up (plan 3.7 refresh item 1).
4. When 3.15 reports done: merge check (T3) and confirm its handoff records the replayer race as a known gap. When 3.16 reports done: strict T1 review (the first test must fail on main; the state table in plan decision 2). 3.16 is foundation code: merge it before 3.8 Part A adds the first production ORDERED handler, if both are ready.
5. Later: 3.9 POS, 3.11, 3.10, M.6 to M.9, then `docs/handoffs/phase-3-review.md`.
6. Follow-ups: reports and approval amounts in bookkeeping hardcode `"BDT"` (read the organization currency when a second currency is added). Admin script budget is 180 KiB (owner, 2026-10-22).

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
- **2026-10-22 late evening** (Opus): told a session not to start 3.6b (booking overlap, no folder) and gave it 3.15 in `banijjik-m2`; found the stray 3.7 copy in the M.5 folder; confirmed the dead-letter replay race the 3.15 session reported and wrote plan 3.16 (T1).
- **2026-10-22 evening** (Sonnet): pushed main (owner yes); refreshed plans 3.8 and 3.7, decided 3.7 freeze rule; wrote plans 3.15 and 3.6b; audited all branches (none done, none pushed, much uncommitted); found main CI flake and re-ran it; told the owner how to run sessions in separate folders.
- **2026-10-22 afternoon** (Sonnet): checked state (3.5a branch unpushed, one commit only), refreshed plans 3.8 and 3.7 against main (accounting adapter duty, existing payment contracts, bed-hold port risk for 3.7). No code merged.
- **2026-10-22 morning** (Sonnet): reviewed, rebased, pushed and merged 3.6, M.3, M.4 and 3.8b in that order, each green on CI. Fixed on the way: JS budget (contact credit section lazy, admin budget 180 KiB by owner), duplicate probe module in the platform browser stack, router builder length, long setting key overflow. All branches stayed unpushed to main.
- **2026-10-22 night** (Sonnet): rebased 3.6 on main (STATUS.md conflicts), CI green, reviewed R1 delta, fast-forwarded local main to `e5af140`. banijjik-lead folder is now free. M.3, M.4, 3.8b not yet reviewed; none pushed.
