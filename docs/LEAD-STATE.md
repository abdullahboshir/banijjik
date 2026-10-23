# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.


Last updated: 2026-10-23 (late night 4, Dhaka) by Opus 5.5 · `main` = `origin/main` = `e22df9f` (3.6b A2 + 3.8 B1 merged at `4ec9879`, CI 39982376348 green; 3.6b A3 refresh) plus this state save (pushed). **The `/lead` skill reads `main:docs/LEAD-STATE.md` from the local ref: run `git fetch origin && git fetch . origin/main:main` first, or read `origin/main`.**

## 1. Where the project stands
- Phase 3 merged: 3.0, 3.1a/b/c, 3.2a/b, 3.3, 3.4, 3.4b, 3.5a Part A, 3.6, 3.6b A1 **and A2**, **3.8 (all parts)**, 3.8a, 3.8b, 3.8c, 3.11 A1, 3.12–3.21. Track M merged: M.1 to M.5. Details per card: `docs/STATUS.md`.
- **Still left in Phase 3** (told to the owner 2026-10-23): 3.22 (foundation, not started); 3.7 Part A (R1 open) and B; 3.6b A3 then B; 3.11 A2, B, C; new small T1 card "orders as a payment request", then 3.5a Part B; 3.5b; 3.9 POS; 3.10; a test-stability card; a booking-posting fix card; the phase review. Track M: M.6 to M.9 (M.7 A1 and M.8a planned).
- Owner's tools (2026-10-23): Claude Code in VS Code is the lead; Qoder and Antigravity implement. Cursor is off until its weekly limit resets.
- Note: `npm audit fix --omit=dev` deletes devDependencies from `node_modules`; run `npm install` after it.
- `gh run watch` sometimes exits early on this PC (TLS timeouts). Poll with `gh run view <id> --json status` in a loop instead.
- **Flaky CI tests** (seen 2026-10-23 on docs-only heads, green on rerun): `kernel/idempotency/idempotency.middleware.test.ts` "takes over a request whose lock has expired" (sleep-based timing), `kernel/events/ordered-event-worker.test.ts` "lets the stream continue after a skip" (timeout) and `kernel/rate-limit/mongo-rate-limiter.test.ts` "answers 429 RATE_LIMITED with Retry-After once the limit is passed" (time window). Rerun failed jobs with `gh run rerun <id> --failed`; a test-stability card should remove the sleeps.

## 2. Open branches (checked 2026-10-23 late night 4)
| Card / part | Branch | Folder | Tier | State and next step |
|---|---|---|---|---|
| 3.6b A3 event bookings | `s/3.6b-api-event-booking` | `banijjik-m2` (suggested) | T1 | Plan `docs/plans/3.6b.md` **"Refresh 2"** (`e22df9f`): one kind-keyed reader, seat counter, one release path, reschedule between sessions, async session cancel with `bookingsSettledAt`, session completion, expire-holds per-row catch. Prompt given to the owner this session. Next: T1 review on done. |
| 3.7 Part A enrollment | `s/3.7-api-enrollment-v2` (`779f472`) | `banijjik-1.7b` | T1 | **R1: changes required** (`docs/handoffs/3.7-api-review-R1.md`, 10 items). No commit since R1 (2026-10-22), 85+ behind main; its rebase touches booking files (3.8, 3.6b A1 merged). Ask the owner whether a session has it. |
| 3.22 ordered handlers follow whole streams | `s/3.22-ordered-stream-follow` | `banijjik` (still on old `s/3.6b-api-rental`) | T1 | Plan `docs/plans/3.22.md`, ADR-136 reserved. **Not started** (no branch on origin). Must merge before 3.11 A2 (Amendment 3). Next: T1 review on done. |
| 3.11 A2 payouts and posting | `s/3.11-api-payouts` | `banijjik-3.11` (still on old `s/3.11-api-accruals`) | T1 | **Not started.** A2 = decisions 7–8 + Amendments 1–3. Runs after 3.22. Next: T1 review on done. |
| M.7 Part A1 reports | `s/M.7-api-reports` | cloud | T1 | Plan `docs/plans/M.7.md` A1, ADR-134. Not started (waits for capacity). |
| M.8a matrimony templates | `s/M.8a-matrimony-templates` | cloud | T2 | Plan `docs/plans/M.8a.md`. Not started. **At merge of the second of M.7 A1 / M.8a, the lead adds `reportReasons`** (keys in M.8a decision 5) to both seeds. |

Merged and safe to delete (local and `origin`):
- card branches: `s/3.6b-api-event-sessions`, `s/3.8-ui-payments`, `s/3.5a-api-orders`, `s/3.6b-api-rental`, `s/3.11-api-accruals`, `s/3.8-ui-dues-store-credit`, `s/3.8-api-payments`, `s/M.5-ui-credit-purchases`, `s/3.15-test-stability`, `s/3.16-dead-letter-replay-race`, `s/3.17-next-security`, `s/3.18-delivery-guardrails`, `s/3.19-job-config-version`, `s/M.5-api-credit-purchases`, `s/M.5-threshold-cleanup`, `s/3.20-local-fonts`, `s/3.21-accounting-currency`
- merge branches: `s/merge-3.6b-a2-3.8-b1`, `s/merge-3.5a`, `s/merge-M.5`, `s/merge-3.18-3.19`, `s/merge-3.20`, `s/merge-3.21`
- docs branches: `s/docs-3.6b-a3-refresh`, `s/docs-reviews-2026-10-23`, `s/docs-state-2026-10-23*`, `s/docs-state-2026-10-22h/l/m`, `s/docs-3.7-event-names`, `s/docs-3.7-review-r1`, `s/docs-3.5a-review-r1`, `s/docs-plans-3.20-3.21`, `s/docs-3.21-amendment`, `s/docs-plan-M.7`
- PR #2 (3.8) can be closed as merged.

Folders: free: `banijjik-3.5a`, `banijjik-lead`; `banijjik-m2` → 3.6b A3 (suggested). Switch each to a new card branch from main. `banijjik` → 3.22, `banijjik-3.11` → 3.11 A2 (both idle). `banijjik-docs` is the docs and merge folder; the next lead session opens there.

**Agents claim "done" early** (this session: 3.8 B1 and 3.6b A2 both claimed done; B1 had 5 defects, A2 had red CI and no handoff). A "done" without the full `npm run card:check` output (all PASS) is not reviewed. Verify anyway: `git status` in the folder, `origin/<branch>`, `gh run view <run> --json jobs`, `--log-failed`. Always `git fetch` and compare with `origin/main`, not a stale local `main`.

Stash `stash@{4}` in `banijjik` holds the owner's uncommitted edits to `AGENTS.md` and `docs/05-CONVENTIONS.md` ("Engineering safeguards"). The owner has not said keep or drop.

## 3. Waiting on the owner
- Start 3.22 (folder `banijjik`) and then 3.11 A2 (`banijjik-3.11`): prompts were given but neither started.
- 3.7 R1: does any session have it?
- Start 3.6b A3 with the prompt given this session (`banijjik-m2`).
- M.7 A1 and M.8a as cloud sessions when capacity allows. Two folders are free (`banijjik-3.5a`, `banijjik-lead`).
- Owner capacity (2026-10-23): 6–7 implement sessions at once. Model rule: Sonnet 5.5 for T1/T2 implementation; Haiku 5.5 only for T3 mechanical cards.
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions (SMS provider, pricing, photo policy, domain, legal review).

## 4. Next actions, in order
1. Verify reality (`git fetch`, folders, `origin/<branch>`, `gh run list`). For every "done", require the `card:check` output.
2. **Plan a small T1 card "orders as a payment request"** (next card number, check `03-ROADMAP.md`): register the `ORDER` request reader in payment, replace the zero `PaymentSummaryReader` stub in `routes/`, enforce `sales.advance.required` on confirm (see `docs/handoffs/3.5a-api-review-R2.md` follow-ups). Then **refresh 3.5a Part B** (screens; it shows payment status only after that card).
3. T1 review of 3.6b A3, 3.22 and then 3.11 A2 as each reports done. After A3: 3.6b Part B (screens; lead refreshes first).
4. **Plan the gap left out of A3:** event sessions do not occupy their resources' slots, so a hall used by a session can still be rented or booked (Refresh 2 item 11). Decide how a session takes resource capacity (on create/update/cancel) and plan it as a small T1 card.
5. Plans still missing: refresh 3.9 POS inputs; plan M.6 (storefront app, see M.6 notes in STATUS/doc 16: host → organization resolution, customer cookies across hosts; M.6a T1, M.6b T2); plan 3.5b; refresh the ready board (guide §9).
6. After 3.7 Part A: 3.7 Part B. After M.7 A1: refresh M.7 A2 and B. Later: 3.9, 3.10, M.8b, M.9, then `docs/handoffs/phase-3-review.md`.
7. Follow-ups:
   - Test-stability card for the three flaky kernel tests (§1).
   - 3.8 B1 leftover (UX, small): the refund dialog shows its "refund failed" label for an invalid amount instead of an amount-specific one.
   - `sales` job rows log at `warn`; booking jobs use `error`. Align in 3.5a Part B or 3.5b.
   - The admin script budget is 180 KiB. New admin routes need a budget check in their browser test.
   - Replayer safety across more than one worker process (STATUS 3.16 note).
   - Booking posting source: the business date is the UTC date of `startsAt` and `advancesToSettle` = `depositRequired`, not the deposit paid (`kind` was fixed in 3.6b A1). Plan a small T2 fix card.

## 5. How the lead works
- **Role:** plans (just in time), strict T1 reviews, merge checks, integration (rebases, conflicts), fast-forward of `main`. Implementation is done by the owner's sessions (Antigravity, Claude Code, Qoder, Cursor), not by the lead, unless the owner asks.
- **One lead session at a time.** If another lead session messages, agree who owns which branch before touching `main` or `banijjik-docs`.
- **Language:** reply to the owner in Bengali script; code, comments and docs in English.
- **Review:** read the diff against the plan and `AGENTS.md`; try to break T1 security, money, stock and concurrency rules; require a green CI run on the branch head. Never accept an implementer's report as proof. Review findings go in `docs/handoffs/<card>-review-R<n>.md` and the owner pastes them to the session.
- **Integration habits:** Cursor branches tend to refactor `routes/v1.ts` and the router builders. Keep the 3.8c layout (`routes/core-tenant-routers.ts`, `routes/tenant-module-routers.ts`, `routes/iam-tenant-router.ts`). i18n catalog end-of-file conflicts: keep both sides joined by a comma. Keep `\\.` escaping in `eslint/restrictions.mjs`. To merge several branches or one whose base is behind, build `s/merge-<card>` in `banijjik-docs` (`git switch -c s/merge-<card> main`, `git cherry-pick <base>..<branch>`), push it, wait for green CI, fast-forward `main` to it. A branch already on top of main is fast-forwarded directly (`git push origin <branch>:main`); mark its STATUS row merged on the branch first. There is no `python` on this PC; edit conflicts with the Edit tool. Commit subjects must not be sentence-case (commitlint).
- **Folders:** one chat per folder. `banijjik`, `banijjik-1.7b`, `banijjik-lead`, `banijjik-m2` have their own `node_modules`. `banijjik-docs` is light: its `node_modules` is a junction to `banijjik`'s (enough for the commit hooks; not for builds). Disk is nearly full, so there are no new full folders. Extra sessions run as cloud agents (they leave a local worktree under `banijjik/.claude/worktrees/`; remove it with `git worktree remove` after the merge).
- **Docs commits:** in `banijjik-docs`, `git switch -c s/docs-<slug> main`, commit, then from any folder `git fetch . s/docs-<slug>:main` (fast-forward only).
- **Local verify:** environment `MONGOMS_SYSTEM_BINARY="C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe" MONGOMS_VERSION_CHECK=false TEST_REDIS_URL=redis://127.0.0.1:6380 NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 NEXT_PUBLIC_BRAND_NAME=Example CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"`. Single API test files: `npx vitest run --config src/test-support/vitest.config.ts <files>` in `apps/api` (without the config the test databases are missing). Full: `npm run lint`, `npm run format:check`, `VITEST_MAX_WORKERS=2 npx turbo run build typecheck test --force --env-mode=loose --concurrency=1 --continue`, and the browser suites with `VITEST_MAX_WORKERS=1 npm run test:browser` in `apps/admin` and `apps/platform`. Move `apps/api/.env` aside during the run (it exists only in `banijjik`) and put it back. Docker (`infra/docker-compose.yml`: Mongo 27018, Redis 6380) may need starting after a reboot; never touch other containers.
- **Finish gate and leftovers (owner, 2026-10-23):** a review starts only from a `card:check` output with every line PASS. When a re-review leaves at most three small items, the lead fixes them on the branch and merges instead of starting another round.
- **Pushing `main`:** the owner allowed it again on 2026-10-23 night ("push koro") and confirmed it in the late night 4 session, for green-CI merges. Confirm at the start of a new session that this still holds.
- **Never:** `--no-verify`, resetting existing commits, committing `.env` files, printing env values.
- **Token cost:** keep sessions short: one task, then `/save-state`, then a new session with `/lead`.

## 6. Session log (last five)
- **2026-10-23 late night 4** (Opus): merge CI 39982376348 green; `main` reached `4ec9879` (another chat pushed it first; the owner made this chat the lead). Wrote 3.6b plan "Refresh 2" for A3 on the merged A1/A2 code (`e22df9f`) and gave the A3 prompt. Found: expire-holds has no per-row catch, reschedule's optional time zone with an `"Asia/Dhaka"` fallback (both fixed in A3), sessions do not block resources (§4 item 4).
- **2026-10-23 late night 3** (Opus): re-checked 3.6b A2 (all R1 fixed, passed) and 3.8 B1 (R1 fixed; the lead fixed three leftovers in `e900c89`), built `s/merge-3.6b-a2-3.8-b1`, CI rerun after a flaky rate-limiter test. Told the owner the remaining Phase 3 list (§1).
- **2026-10-23 late night 2** (Opus): owner asked to verify every "done". 3.5a Part A: R2 passed, merged (`5958710`, one flaky kernel test rerun). 3.6b A1 and 3.11 A1 confirmed merged. 3.8 B1 merge check R1 (5 must-fix) and 3.6b A2 R1 (not done) written to `docs/handoffs/` and pasted by the owner. 3.22 and 3.11 A2 never started.
- **2026-10-23 late night** (Opus): T1 review and merge of 3.6b A1 (`964d8f9`). T1 review and merge of 3.11 A1 (`7f55fa5`; lead added the commission module to three templates, plan Amendment 2 for the refund/accrual race); merge check and merge of 3.8 B2 (`7a4e289`; done message lacked card:check, the lead ran it: all PASS). Before that: nothing moved on any branch. Planned 3.11 (A1 → A2 → B, C after 3.5a; ADR-135) after four owner decisions (base after discount without tax, proportional refund adjustment, expense at accrual, higher role rule wins). Found the booking posting business-date bug. Main pushed after the A1 session asked for the plan on origin.
- **2026-10-23 night** (Opus): refreshed 3.8 Part B (B1/B2 parallel) and 3.6b (A1/A2 parallel, A3 after) and gave four prompts; 3.5a claimed done but nothing new on origin (still `6043913`), owner told. Earlier: 3.8 R3 fixes arrived; the lead fixed the last two leftovers (empty job catch, optional summary methods) and merged 3.8 Part A (`471a773`). M.5 Part B merge check: added the credit budget check, found purchases at 186 KiB, made the detail sheet lazy (170.6 KiB), merged (`cf17e3c`). Owner allowed pushing main. Owner is waiting on the unblocked work (3.8 B, 3.6b, 3.11, M.6).
