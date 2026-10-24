# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.


Last updated: 2026-10-24 (afternoon, Dhaka) by Opus 5.5 · `main` = `origin/main` = this state save on top of `8e729ae` (M.8a, 3.27 and the screen-plan refreshes merged) (pushed). **The `/lead` skill reads `main:docs/LEAD-STATE.md` from the local ref: run `git fetch origin && git fetch . origin/main:main` first, or read `origin/main`.**

## 1. Where the project stands
- Phase 3: 42 numbered cards. **32 fully merged**: 3.0–3.4b, 3.6, 3.8 (all parts), 3.8a/b/c, 3.12–3.23, 3.25–3.30. Partly done (API merged, screens left): 3.5a (B), 3.6b (B), 3.7 (B), 3.11 (B, C). Running: 3.24. Not started: 3.5b, 3.9, 3.10, 3.31, 3.32, 3.33. Track M: M.0–M.5, M.7 A1 and **M.8a** merged; M.6, M.7 A2/B, M.8b, M.9 left. Details: `docs/STATUS.md`.
- **Owner request (2026-10-23):** finish every partly done card and plan everything not started; the owner runs 6–7 sessions (Opus plans and reviews, Sonnet 5.5 codes).
- **Owner (2026-10-24): the lead may run small T2/T3 cards itself with Sonnet subagents** (`model: "sonnet"`, background) in free folders that have `node_modules` (no new worktrees, disk ~1.7 GB).
- Owner decision (3.24): a stock receipt says how it was paid (CASH/BKASH/NAGAD/BANK) or `ON_CREDIT` (new `ACCOUNTS_PAYABLE`); opening stock → `OPENING_BALANCE`.
- Owner's tools: Claude Code in VS Code is the lead; Qoder, Antigravity implement.
- Note: `npm audit fix --omit=dev` deletes devDependencies from `node_modules`; run `npm install` after it.
- `gh run watch` drops on this PC (TLS timeouts). Poll jobs with `gh run view <id> --json jobs`: the run-level `status` can say "completed" while the `browser` job still runs. DNS to github.com also drops now and then: retry.
- Folders' `@banijjik/contracts` / `validation` `dist` can be stale after switching branches: `npx turbo run build --filter=<pkg>` before local tests. Low RAM: run API tests with `--maxWorkers=1`.
- **The admin browser stack starts only the API, not the worker:** a browser test can never wait for an event handler (written into the 3.7 and 3.11 refreshes).
- Time-dependent tests follow `05-CONVENTIONS.md` "Testing" (3.26). Run date-sensitive suites between 00:00 and 06:00 Dhaka now and then.

## 2. Open branches (checked 2026-10-24 afternoon)
| Card / part | Branch | Folder | Tier | State and next step |
|---|---|---|---|---|
| 3.24 order and stock posting | `s/3.24-api-order-stock-posting` | `banijjik-3.5a` | T1 | Plan `3.24.md` Refresh 1. Work uncommitted in the folder (admin stock form + accounting), nothing pushed. **Next: T1 review on done.** |
| 3.5a B order screens | `s/3.5a-ui-orders` | `banijjik-m2` | T2 | Plan Refresh 2 (payments through the shared sheet, `ADVANCE_NEEDS_PAYMENTS`, 180 KiB). Merge check on done. |
| 3.6b B rental and event screens | `s/3.6b-ui-rental-event` | `banijjik-1.7b` | T2 | Plan Refresh 3 (one add-only manifest menu entry "Event sessions"). Merge check on done. |
| 3.7 B enrollment screens | `s/3.7-ui-enrollment` | `banijjik-lead` | T2 | Plan Refresh 2 (pay periods; activate syncs the period itself). Merge check on done. |
| 3.11 B commission screens | `s/3.11-ui-commission` | `banijjik-3.11` | T2 | Plan Refresh B (entries and payouts menu under `money`, rules under `settings`; "My commission" in the account menu). Merge check on done. |
| M.7 A2 blocks, erasure, export | `s/M.7-api-erasure` | `banijjik-3.6b-a3` | T1 | Plan `M.7.md` Refresh A2 (OTP purpose `ERASE_ACCOUNT`, erasure and export participant ports, files, tests). **T1 review on done.** |
| M.7 B report screens | `s/M.7-ui-reports` | `banijjik` | T2 | Plan Refresh B. Merge check on done. |

The lead gave the prompts for the six new rows on 2026-10-24 afternoon. Check `origin/<branch>` to see whether a session really started.

Merged and safe to delete (local and `origin`): `s/M.8a-matrimony-templates`, `s/3.27-api-enrollment-payments`, `s/merge-M.8a`, `s/merge-3.27`, `s/docs-refresh-screens`, `s/3.28-credit-expiry-job`, `s/3.29-booking-sales-leftovers`, `s/3.30-refund-amount-label`, and every older card, `s/merge-*` and `s/docs-*` branch. **`s/merge-3.29` (on origin) is broken** (conflict markers): never merge it, delete it. PR #2 (3.8) can be closed as merged.

Folders: busy as in the table. Free: `banijjik-m8a` (no `node_modules`, light work only). `banijjik-docs` is the docs and merge folder. Disk E: about 1.7 GB free: no new folders.

**Agents claim "done" early.** A "done" without the full `npm run card:check` output (all PASS) is not reviewed. Verify anyway: `git status` in the folder, `origin/<branch>`, `gh run view <run> --json jobs`, `--log-failed`, behind count against `origin/main`. Before touching a session's folder, check it is idle. A `card:check` FAIL on "rebased" when main moved only by docs commits is fine: the lead cherry-picks onto a merge branch anyway.

**Parallel branches that each bump a count test** (permission keys, audit actions, sequence keys, template keys, menu entries) merge cleanly but fail CI together: after a rebase, run `packages/contracts` tests before pushing.

Stash `stash@{4}` in `banijjik` holds the owner's uncommitted edits to `AGENTS.md` and `docs/05-CONVENTIONS.md` ("Engineering safeguards"). The owner has not said keep or drop. M.7 B now runs in `banijjik`: that session must not pop or drop it.

## 3. Waiting on the owner
- Paste the done messages (with `card:check`) of the seven running sessions.
- **Product decision:** a payment reversal after a cancel reopens dues (orders since 3.23, enrollment periods since 3.27): cancel caps the summary at net paid, and a later reversal lowers net paid below it. Is a reversed payment on a cancelled request still owed? (`docs/handoffs/3.27-api-review-R1.md`.)
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions (SMS provider, pricing, photo policy, domain, legal review).

## 4. Next actions, in order
1. Verify reality (`git fetch`, folders, `origin/<branch>`, `gh run list`).
2. Reviews as sessions report done: T1 for 3.24 and M.7 A2; merge checks for 3.5a B, 3.6b B, 3.7 B, 3.11 B and M.7 B. Merge one by one. Cherry-pick each later branch onto a fresh `s/merge-<card>` from main (i18n and manifest menu conflicts are add-only: keep both sides).
3. **Plan 3.33 "event sessions occupy their resources"** (T1; 3.6b A3 left it out: a hall used by a session can still be rented).
4. **Plan M.6** (storefront app): read ADR-010, ADR-031, `06 §8`, `13-UX`, `routes/storefront.ts`, `contact/presentation/customer-cookies.ts`, CORS in `app.ts`. Open questions: host → organization resolution, customer cookies across the app and API hosts. M.6a T1; M.6b T2. The M.7 A2 erase and export endpoints need M.6 pages.
5. After 3.24 merges: plan 3.31 (enrollment revenue posting and advance settle) and 3.32 (enrollment cancel refunds). After 3.5a B and 3.24: 3.11 C, 3.5b, 3.9 POS. Then M.8b, M.9, 3.10, `docs/handoffs/phase-3-review.md`.
6. Follow-ups:
   - **New flaky test:** `apps/api/src/kernel/events/ordered-event-worker.test.ts` "runs a replayed event again with fresh attempts, and the stream continues behind it" timed out on main CI 40066380468 ("timed out waiting for both events to be handled in order"). A small T3 card in the 3.26 style.
   - Refund dialog has no client-side maximum (3.30 test uses amount 0); a small T3 card if wanted.
   - The session-cancel job makes one pass over all unsettled sessions per run (3.29 handoff); fine at current volume.
   - Replayer safety across more than one worker process (STATUS 3.16 note).
   - Auto-confirm of an order after its advance is paid (3.23 left it out) belongs to the storefront/bot phase.
   - Supplier payments clearing `ACCOUNTS_PAYABLE` (3.24 leaves it out): a later card.
   - 3.23 review follow-ups (`docs/handoffs/3.23-api-review-R1.md`): the advance holds only at confirm; a pre-3.23 order without a summary can race its cancel with a first payment; instant sales show as UNPAID dues until 3.9.

## 5. How the lead works
- **Role:** plans (just in time), strict T1 reviews, merge checks, integration (rebases, conflicts), fast-forward of `main`. Implementation is done by the owner's sessions (Antigravity, Claude Code, Qoder, Cursor), not by the lead, unless the owner asks.
- **One lead session at a time.** If another lead session messages, agree who owns which branch before touching `main` or `banijjik-docs`.
- **Language:** reply to the owner in Bengali script; code, comments and docs in English.
- **Review:** read the diff against the plan and `AGENTS.md`; try to break T1 security, money, stock and concurrency rules; require a green CI run on the branch head. Never accept an implementer's report as proof. Review findings go in `docs/handoffs/<card>-review-R<n>.md` and the owner pastes them to the session.
- **Integration habits:** Cursor branches tend to refactor `routes/v1.ts` and the router builders. Keep the 3.8c layout (`routes/core-tenant-routers.ts`, `routes/tenant-module-routers.ts`, `routes/iam-tenant-router.ts`). i18n catalog end-of-file conflicts: keep both sides joined by a comma. Keep `\\.` escaping in `eslint/restrictions.mjs`. To merge several branches or one whose base is behind, build `s/merge-<card>` in `banijjik-docs` (`git switch -c s/merge-<card> main`, `git cherry-pick <base>..<branch>`), push it, wait for green CI, fast-forward `main` to it. Merge branches can be stacked (`s/merge-B` from `s/merge-A`) so both CI runs go at once; fast-forward `main` in order. A branch already on top of main is fast-forwarded directly (`git push origin <branch>:main`); mark its STATUS row merged on the branch first. There is no `python` on this PC; edit conflicts with the Edit tool. Commit subjects must not be sentence-case (commitlint).
- **Folders:** one chat per folder. `banijjik`, `banijjik-1.7b`, `banijjik-lead`, `banijjik-m2`, `banijjik-3.11`, `banijjik-3.5a` and `banijjik-3.6b-a3` have `node_modules`. `banijjik-docs` is light: its `node_modules` is a junction to `banijjik`'s (enough for the commit hooks and prettier; not for builds). Disk is nearly full, so there are no new full folders. Extra sessions run as cloud agents (they leave a local worktree under `banijjik/.claude/worktrees/`; remove it with `git worktree remove` after the merge).
- **Docs commits:** in `banijjik-docs`, `git switch -c s/docs-<slug> main`, commit, then from any folder `git fetch . s/docs-<slug>:main` (fast-forward only).
- **Local verify:** environment `MONGOMS_SYSTEM_BINARY="C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe" MONGOMS_VERSION_CHECK=false TEST_REDIS_URL=redis://127.0.0.1:6380 NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 NEXT_PUBLIC_BRAND_NAME=Example CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"`. Single API test files: `npx vitest run --config src/test-support/vitest.config.ts <files>` in `apps/api` (without the config the test databases are missing). Full: `npm run lint`, `npm run format:check`, `VITEST_MAX_WORKERS=2 npx turbo run build typecheck test --force --env-mode=loose --concurrency=1 --continue`, and the browser suites with `VITEST_MAX_WORKERS=1 npm run test:browser` in `apps/admin` and `apps/platform`. Move `apps/api/.env` aside during the run (it exists only in `banijjik`) and put it back. Docker (`infra/docker-compose.yml`: Mongo 27018, Redis 6380) may need starting after a reboot; never touch other containers.
- **Finish gate and leftovers (owner, 2026-10-23):** a review starts only from a `card:check` output with every line PASS. When a re-review leaves at most three small items, the lead fixes them on the branch and merges instead of starting another round.
- **Pushing `main`:** the owner allowed it for green-CI merges (2026-10-23 night) and confirmed it again on 2026-10-24 afternoon ("verify kore push koro"). Confirm at the start of a new session that this still holds.
- **Never:** `--no-verify`, resetting existing commits, committing `.env` files, printing env values.
- **Shell pipelines hide failures:** `git cherry-pick ... | tail` returns tail's exit code, so a conflict does not stop a `&&` chain (it pushed `s/merge-3.29` with conflict markers). Never pipe a git command whose failure must stop the chain.
- **Token cost:** keep sessions short: one task, then `/save-state`, then a new session with `/lead`.

## 6. Session log (last five)
- **2026-10-24 afternoon** (Opus): merge check of M.8a passed and merged (`d06e36a`); T1 review R1 of 3.27 passed, the lead fixed the stale period version after a sync, merged (`5ebe469`). Refreshed and released the screen parts 3.5a B, 3.6b B, 3.7 B, 3.11 B, plus M.7 A2 (T1) and M.7 B; new ready board (`8e729ae`). Found a new flaky kernel test and the reversal-after-cancel dues question.
- **2026-10-24 midday** (Opus): T1 review and merge of 3.23 and merge check of 3.26 (`cecb5a0`); another lead chat was turned off by the owner. Planned 3.27 (enrollment payments, ADR-139), refreshed 3.24, planned and ran 3.28–3.30 with Sonnet subagents (owner request), merged all three (`67848d6`). Checked M.8a content; gave 3.24, 3.27 and M.8a prompts.
- **2026-10-24 morning 2** (Opus): landed 3.11 A2 (`e103af6`, via `s/merge-3.11-a2`: force-push of the card branch is blocked by the auto-mode classifier, so rebase by cherry-pick onto a merge branch). Merge check of 3.26 A+B passed (conventions note added). T1 review of 3.23 passed (lead renamed `hoursOf` → `integerOf`; review R1 file). Both merged at `cecb5a0`, CI 40059020558 green.
- **2026-10-24 morning** (Opus): T1 reviews passed and merged 3.6b A3 (`86230ea`) and M.7 A1 (`dad5b4a`, rebased by the lead after the session finished its own rebase); 3.11 A2 review passed, rebased, count-test fix. Plan 3.23 Amendment 2 (summary contact moves only while unpaid).
- **2026-10-24 early morning** (Opus): verified all sessions. T1 review and merge of 3.22 (`53dbb41`). 3.25 T1 review: the lead fixed four leftovers (including the unlock limit that counted the UTC day) and merged (`a84e076`). Lockfile patch for new advisories (`cf245e3`). 3.7 Part A R1 re-review passed and merged (`62883d7`).
