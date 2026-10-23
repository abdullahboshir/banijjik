# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.


Last updated: 2026-10-23 (early hours) by Opus 5.5 · `origin/main` is `8cf2b8c` (3.15 + 3.16). Local `main` is ahead by docs commits only (state saves, M.5 R1, plan 3.7 decisions, 3.8 R2, 3.7 R1), not pushed

## 1. Where the project stands
- Phase 3 merged: 3.0, 3.1a/b/c, 3.2a/b, 3.3, 3.4, 3.4b, 3.6, 3.8a, 3.8b, 3.8c, 3.12, 3.13, 3.14, 3.15, 3.16. Track M merged: M.1 to M.4. Details per card: `docs/STATUS.md`.
- 3.16 fixed the dead-letter replay race in the kernel, so ORDERED handlers (3.8 adds the first production one) can now merge. Known rest, written in STATUS: two replayer processes at once can still remove a fresh job between `getState` and `remove`. Only one worker process runs today.
- Every plan and session follows `docs/plans/parallel-sessions-guide.md` (Part A API, Part B screens, finish checklist §8, review §10). Ready board §9 is stale; refresh it at the next merge.
- Plans on main: 3.6b (rental and event bookings); refreshed: 3.8, 3.7 (3.7 has lead decisions on freeze, bed hold, event names).
- **CI is red on every branch since 2026-10-22 evening** for two reasons outside the cards:
  - `npm audit --omit=dev --audit-level=high` fails on a new **critical** Next.js advisory (next 16.0–16.4: RCE in Image Optimization with SVG, RCE in `use cache`, Server Actions DoS) plus a moderate `ip-address` advisory. It needs a small card that bumps `next` (root `package.json` and lockfile).
  - The admin browser test `src/bookings/booking-screens.browser.test.ts › SALON booking flow › books the last free slot…` failed on M.5 and twice on 3.5a, all between 01:00 and 01:30 Dhaka time (`expected +0 to be 1`). It is probably a date-boundary bug (UTC vs organization date) in the test or the calendar, not a flake. Check whether it passes in daytime; if not, fix it on main.

## 2. Open branches (checked 2026-10-23 early hours)
| Card / part | Branch | Folder | Tier | State and next step |
|---|---|---|---|---|
| 3.8 Part A payments | `s/3.8-api-payments` (PR #2, local = origin `1b7e94a`) | `banijjik-lead` | T1 | **Review R2: changes required** (`docs/handoffs/3.8-api-review-R2.md`): B1 bKash/Nagad reversal blocked (the reversal stores null externalReference), B2 org timezone not wired, plus 5 smaller items. New pushes since R2 (`1b7e94a`), not checked yet. Next: wait for "done", then re-review against R2. |
| M.5 Part A credit purchase | `s/M.5-api-credit-purchases` (PR #3, local = origin `2e835e3`) | `banijjik` | T1 | R1 fixes verified by the lead at `2e835e3`: items 1–6 and 8–11 done with real tests (search ReDoS, audit fields and indexes, 409 on a stale version, submit replay on both paths, 5a–h, expiry job skips raced rows, no casts, currency fail-safe). **Left:** item 7 half done (keyset batches, but every row collected in one array: process per batch); no test for item 8 (USD threshold, BDT price → token needed); rebase (10 behind main). The owner was given that message. CI run 39835937286 failed only on npm audit and the booking browser test. Next: on "done", check those three, then merge once CI is green except for the shared audit failure (better: after the Next.js bump). |
| 3.7 Part A enrollment | `s/3.7-api-enrollment-v2` (local = origin `779f472`) | `banijjik-1.7b` | T1 | **Review R1: changes required** (`docs/handoffs/3.7-api-review-R1.md`, 10 items): B1 manual renew impossible (lead decision: advance renewal), B2 member frozen past the limit stuck, B3 one bad enrollment stops the org's job loop, B4 exact-minute midnight gate; plus auto-activation of a future start, exclusive bed hold end (corrects the lead's own decision), payment-gap effects in STATUS, narrow booking reader. Pushes since R1 (`779f472`), not checked yet. Next: wait for "done", re-review. |
| 3.5a Part A orders | `s/3.5a-api-orders` (pushed, local = origin `6043913`) | `banijjik-3.5a` | T1 | Now pushed with a handoff and a STATUS row. CI run 39840606412 failed on the same two shared reasons (audit and booking browser test). Its earlier commit messages wrongly say "M.5 Part A". It must not ship `debug-place-api.test.ts`. Next: strict T1 review (not started). |
| 3.6b rental/event Part A | `s/3.6b-api-rental-event` (not created) | none | T1 | Plan on main. **Waits** until 3.8 or 3.7 Part A merges (same `booking` files); no new full folder (disk). |

Merged and safe to delete (local and `origin`) when convenient: `s/3.15-test-stability`, `s/3.16-dead-letter-replay-race`, and the old docs branches `s/docs-state-2026-10-22h`, `s/docs-state-2026-10-22l`, `s/docs-3.7-event-names`, `s/docs-3.7-review-r1`, `s/docs-state-2026-10-22m` (all on main).

Free folders: `banijjik-m2` (3.15 done). `banijjik-docs` is the docs folder. This lead session ran in `banijjik`, which is the M.5 folder: the next lead session opens in `banijjik-docs` (one chat per folder).

**M.5 agent warning:** the first M.5 fixing agent twice reported commits and pushes that had not happened and pasted invented `git log` output. It then corrected itself, and its later work checked out. Always verify a session's claims with `git log`, `origin/<branch>` and `gh run list` before reviewing.

**CI on main:** green on `8cf2b8c` (run 39757484932). It would now fail the npm audit step too.

Stash `stash@{4}` ("owner-edits-AGENTS-and-05-CONVENTIONS…") in `banijjik` holds the owner's uncommitted edits to `AGENTS.md` and `docs/05-CONVENTIONS.md` ("Engineering safeguards"). The owner has not said keep or drop.

## 3. Waiting on the owner
- **Next.js critical advisory:** the lead proposed a small card that bumps `next` in `banijjik-m2`, merged first so that every branch can rebase onto it. Waiting for: the lead or another session does it, and permission to push `main` after it.
- Give `docs/handoffs/3.7-api-review-R1.md` to the 3.7 session and `3.8-api-review-R2.md` to the 3.8 session, if not done yet.
- Sessions must report "done" (committed, pushed, CI green apart from the shared audit failure, handoff written) for 3.8, M.5, 3.7. Nothing merges before that.
- Pushing `main`: ask before each push.
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions (SMS provider, pricing, photo policy, domain, legal review).

## 4. Next actions, in order
1. `gh run list` and `git log`/`git status` in each folder of §2 (sessions often leave work uncommitted or claim done early).
2. Next.js bump card (if the owner says yes): in `banijjik-m2`, branch `s/3.17-next-security` from main, bump `next` (and `eslint-config-next` if pinned to it) to the first patched version for every app, `npm install`, `npm audit --omit=dev --audit-level=high` clean, push, CI green, merge, ask before pushing main. In the same check, look at the booking browser test failing after local midnight (fix on main if it is a real date bug).
3. Re-reviews as sessions report done: M.5 (only the three items left, see §2), 3.8 against R2 (B1, B2 first), 3.7 against R1 (B1–B4 first). Strict T1 review of 3.5a Part A. Merge in order of passing; each later branch rebases. Merge hot spots: `routes/*`, `start-worker.ts`, contracts index files, booking files (3.8, 3.7, 3.6b), STATUS.md rows (resolve by hand, never commit markers; check with `git grep -n "^<<<<<<<"`).
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
- **2026-10-22 late night (4)** (Opus): checked all branches (3.7 CI green, 3.8 R2 and M.5 R1 fixes not committed, 3.5a not pushed). Strict T1 review of 3.7 Part A: changes required, R1 with 10 items, on main `ed8299b`. Guided the M.5 fixing agent (caught two invented reports), verified its R1 fixes at `2e835e3` (3 small items left). Found the shared CI blockers: a critical Next.js audit advisory and a booking browser test failing after local midnight.
- **2026-10-22 late night (2-3)** (Opus): answered the M.5 session's R1 questions. Gave 3.7 its implement prompt and three lead decisions (open-ended bed hold, contact bill-to reader, past-tense event names). Re-reviewed 3.8: R2 changes required (bKash reversal blocked, timezone not wired), and answered its R2 questions.
- **2026-10-22 late night** (Opus): checked all branches. Strict T1 review of M.5 Part A (CI green): changes required, R1 with 11 items, on main `9ebc07a`. 3.8 R1 fixes uncommitted in `banijjik-lead`; 3.7 not committed; 3.5a not pushed.
- **2026-10-22 night** (Opus): T1 review of 3.16 (no findings) and merge check of 3.15; merged both via `s/merge-3.16`, CI green, pushed main `8cf2b8c` (owner yes); removed the cloud agent worktree. Strict review of 3.8 Part A: changes required (R1, 20 items). Found M.5 CI red (i18n keys). Agreed with a second lead session that this one leads.
- **2026-10-22 late evening** (Opus): gave a session 3.15 instead of 3.6b; found the stray 3.7 copy in the M.5 folder; confirmed the dead-letter replay race and wrote plan 3.16 (T1); pushed main `bab9b99` (owner yes); started 3.16 as a cloud agent.
