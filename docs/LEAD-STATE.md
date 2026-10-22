# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.

Last updated: 2026-10-22 (late night, 2) by Opus 5.5 · `origin/main` is `8cf2b8c` (3.15 + 3.16). Local `main` is ahead by docs commits only (state saves, M.5 R1, plan 3.7 bed-hold decision, 3.8 R2), not pushed

## 1. Where the project stands
- Phase 3 merged: 3.0, 3.1a/b/c, 3.2a/b, 3.3, 3.4, 3.4b, 3.6, 3.8a, 3.8b, 3.8c, 3.12, 3.13, 3.14, 3.15, 3.16. Track M merged: M.1 to M.4. Details per card: `docs/STATUS.md`.
- 3.16 fixed the dead-letter replay race in the kernel, so ORDERED handlers (3.8 adds the first production one) can now merge. Known rest, written in STATUS: two replayer processes at once can still remove a fresh job between `getState` and `remove`. Only one worker process runs today.
- Every plan and session follows `docs/plans/parallel-sessions-guide.md` (Part A API, Part B screens, finish checklist §8, review §10). Ready board §9 is stale; refresh it at the next merge.
- Plans on main: 3.6b (rental and event bookings); refreshed: 3.8, 3.7 (3.7 has a lead decision on freeze).

## 2. Open branches (checked 2026-10-22 late night)
| Card / part | Branch | Folder | Tier | State and next step |
|---|---|---|---|---|
| 3.8 Part A payments | `s/3.8-api-payments` (pushed, PR #2, head `2ea32f2`) | `banijjik-lead` | T1 | R1 fixes pushed, CI green (run 39774463702). **Review R2: changes required** (`docs/handoffs/3.8-api-review-R2.md`): B1 a bKash/Nagad payment cannot be reversed (the reversal copies externalReference into the unique index; lead decision: the reversal stores null), B2 org timezone never wired (R1 item 13 not done), plus 5 smaller items. R1 items other than 13 are fixed. Next: the owner gives R2 to the session; re-review, then merge. |
| M.5 Part A credit purchase | `s/M.5-api-credit-purchases` (pushed, PR #3) | `banijjik` | T1 | R1 (11 items) given to the session; it asked 11 questions and the lead answered them (items 1-4 and 9 as it read them; corrections on 3, 4, 5, 6, 8, 10, 11). Fixing now. Next: re-review against R1 and the answers, then merge after 3.8. |
| 3.7 Part A enrollment | `s/3.7-api-enrollment-v2` | `banijjik-1.7b` | T1 | Session started from the implement prompt. Commit `5633e61` holds the bed hold. Lead decisions so far: the bed hold is open-ended until a terminal transition (plan 3.7, new section), and a narrow read-only `buildContactBillToReader` may be added to contact `index.ts` (findActive, readLinkValue; write it in the handoff deviations). Not pushed yet. Next: wait for done (§8), then a strict T1 review. |
| 3.5a Part A orders | `s/3.5a-api-orders` | `banijjik-3.5a` | T1 | 4 commits, clean folder, local branch not pushed (`origin/s/3.5a-api-orders` points at an old docs commit), 53 behind main. Its commit messages wrongly say "M.5 Part A". Next: rebase, push, CI, handoff (§8). |
| 3.6b rental/event Part A | `s/3.6b-api-rental-event` (not created) | none | T1 | Plan on main. **Waits** until 3.8 or 3.7 Part A merges (same `booking` files); no new full folder (disk). |

Merged and safe to delete (local and `origin`) when convenient: `s/3.15-test-stability`, `s/3.16-dead-letter-replay-race` (content on main under other hashes; the STATUS row differs only). `s/docs-state-2026-10-22h` (`5d0c918`) is an older lead's state save, replaced by this file; delete it.

Free folders: `banijjik-m2` (3.15 done). `banijjik-docs` is the docs folder.

**Stray 3.7 files in the M.5 folder:** resolved. The M.5 diff has no booking or enrollment file (checked at review R1). Check again at merge.

**CI on main:** green on `8cf2b8c` (run 39757484932, the merge branch `s/merge-3.16`, now deleted).

Stash `stash@{4}` ("owner-edits-AGENTS-and-05-CONVENTIONS…") in `banijjik` holds the owner's uncommitted edits to `AGENTS.md` and `docs/05-CONVENTIONS.md` ("Engineering safeguards"). The owner has not said keep or drop.

## 3. Waiting on the owner
- Give `docs/handoffs/3.8-api-review-R2.md` to the 3.8 session (in `banijjik-lead`).
- Sessions must report "done" (committed, pushed, CI green, handoff written) for 3.8 (R1 fixes), M.5 (R1 fixes), 3.7, 3.5a. Nothing merges before that.
- Standing permission to push `main` after each reviewed merge: today the owner again said yes for one push only. An older lead session claimed a standing yes; not confirmed by the owner in this session, so ask before each push.
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions (SMS provider, pricing, photo policy, domain, legal review).

## 4. Next actions, in order
1. `gh run list` and `git log`/`git status` in each folder of §2 (sessions often leave work uncommitted or claim done early).
2. 3.8 R2 fixes: re-review against `docs/handoffs/3.8-api-review-R2.md` (B1 and B2 first, with their tests). On green CI: rebase on main, merge via `s/merge-3.8`, ask the owner before pushing main.
3. M.5 R1 fixes: re-review against `docs/handoffs/M.5-api-review-R1.md` item by item (item 4 is a binding lead decision). Require the 8 tests of item 5 and a green CI run on the new head. Then 3.7 and 3.5a as they report done. Order of arrival; each later branch rebases. Merge hot spots: `routes/*`, `start-worker.ts`, contracts index files, booking files (3.8, 3.7, 3.6b), STATUS.md rows (the 3.15/3.16 rows conflicted today: resolve by hand, never commit markers; check with `git grep -n "^<<<<<<<"`).
4. After 3.8 Part A merges: refresh and release 3.8 Part B, 3.11 plan, 3.9 plan inputs; release 3.6b. After 3.5a Part A: 3.5a Part B, plan 3.5b. After M.5 Part A: M.5 Part B, plan M.6. After 3.7 Part A: 3.7 Part B (enrollment payment link: plan 3.7 refresh item 1).
5. Later: 3.9 POS, 3.11, 3.10, M.6 to M.9, then `docs/handoffs/phase-3-review.md`.
6. Follow-ups: reports and approval amounts in bookkeeping hardcode `"BDT"`. Admin script budget is 180 KiB (owner, 2026-10-22). Replayer: if more than one worker process is ever run, make `remove`+`add` safe across processes (STATUS 3.16 note).

## 5. How the lead works
- **Role:** plans (just in time), strict T1 reviews, merge checks, integration (rebases, conflicts), fast-forward of `main`. Implementation is done by the owner's sessions (Cursor, Antigravity, Claude Code, Qoder), not by the lead, unless the owner asks.
- **One lead session at a time.** On 2026-10-22 two lead sessions ran together and both started merging 3.15/3.16. If another lead session messages, agree who owns which branch before touching `main` or `banijjik-docs`.
- **Language:** reply to the owner in Bengali script; code, comments and docs in English.
- **Review:** read the diff against the plan and `AGENTS.md`; try to break T1 security, money, stock and concurrency rules; require a green CI run on the branch head. Never accept an implementer's report as proof (3.8's handoff said "Deviations: None" while ADR-123 and half the tests were missing). Review findings go in `docs/handoffs/<card>-review-R<n>.md` and the owner pastes them to the session.
- **Integration habits:** Cursor branches tend to refactor `routes/v1.ts` and the router builders. Keep the 3.8c layout (`routes/core-tenant-routers.ts`, `routes/tenant-module-routers.ts`, `routes/iam-tenant-router.ts`). i18n catalog end-of-file conflicts: keep both sides joined by a comma. Keep `\\.` escaping in `eslint/restrictions.mjs`. To merge several branches or one whose base is behind, build `s/merge-<card>` in `banijjik-docs` (`git switch -c s/merge-<card> main`, `git cherry-pick <base>..<branch>`), push it, wait for green CI, fast-forward `main` to it; the implementer's branch is not rewritten. There is no `python` on this PC; edit conflicts with the Edit tool.
- **Folders:** one chat per folder. `banijjik`, `banijjik-1.7b`, `banijjik-lead`, `banijjik-m2` have their own `node_modules`. `banijjik-docs` is light: its `node_modules` is a junction to `banijjik`'s (enough for the commit hooks; not for builds). Disk is nearly full (E: about 5.5 GB, C: about 4.3 GB free), so there are no new full folders. Extra sessions run as cloud agents (they leave a local worktree under `banijjik/.claude/worktrees/`; remove it with `git worktree remove` after the merge).
- **Docs commits:** in `banijjik-docs`, `git switch -c s/docs-<slug> main`, commit, then from any folder `git fetch . s/docs-<slug>:main` (fast-forward only).
- **Local verify** (only for integration of several branches; one heavy run at a time): environment `MONGOMS_SYSTEM_BINARY="C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe" MONGOMS_VERSION_CHECK=false TEST_REDIS_URL=redis://127.0.0.1:6380 NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 NEXT_PUBLIC_BRAND_NAME=Example CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"`. Then `npm run lint`, `npm run format:check`, `VITEST_MAX_WORKERS=2 npx turbo run build typecheck test --force --env-mode=loose --concurrency=1 --continue`, and the browser suites with `VITEST_MAX_WORKERS=1 npm run test:browser` in `apps/admin` and `apps/platform`. Move `apps/api/.env` aside during the run (it exists only in `banijjik`) and put it back. Docker (`infra/docker-compose.yml`: Mongo 27018, Redis 6380) may need starting after a reboot; never touch other containers.
- **Never:** `--no-verify`, resetting existing commits, committing `.env` files, printing env values, pushing `main` without permission.
- **Token cost** (measured 2026-10-22): about 90% of a day's usage went to carrying a 900k-token session, mostly full cache rewrites after a break of over an hour or a `/model` switch. Keep sessions short: one task, then `/save-state`, then a new session with `/lead`.

## 6. Session log (last five)
- **2026-10-22 late night (2)** (Opus): answered the M.5 session's R1 questions; gave 3.7 its implement prompt and two lead decisions (open-ended bed hold in plan 3.7, contact bill-to reader); re-reviewed 3.8 R1: R2 changes required (bKash reversal blocked, timezone not wired).
- **2026-10-22 late night** (Opus): checked all branches. Strict T1 review of M.5 Part A (CI green): changes required, R1 with 11 items, on main `9ebc07a`. 3.8 R1 fixes uncommitted in `banijjik-lead`; 3.7 not committed; 3.5a not pushed.
- **2026-10-22 night** (Opus): T1 review of 3.16 (no findings) and merge check of 3.15; merged both via `s/merge-3.16`, CI green, pushed main `8cf2b8c` (owner yes); removed the cloud agent worktree. Strict review of 3.8 Part A: changes required (R1, 20 items). Found M.5 CI red (i18n keys). Agreed with a second lead session that this one leads.
- **2026-10-22 late evening** (Opus): gave a session 3.15 instead of 3.6b; found the stray 3.7 copy in the M.5 folder; confirmed the dead-letter replay race and wrote plan 3.16 (T1); pushed main `bab9b99` (owner yes); started 3.16 as a cloud agent.
- **2026-10-22 evening** (Sonnet): pushed main (owner yes); refreshed plans 3.8 and 3.7, decided 3.7 freeze rule; wrote plans 3.15 and 3.6b; audited all branches; found main CI flake and re-ran it.
