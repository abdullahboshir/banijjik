# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.


Last updated: 2026-10-24 (early morning, Dhaka) by Opus 5.5 · `main` = `origin/main` = this state save on top of `62883d7` (3.7 Part A merged) (pushed). **The `/lead` skill reads `main:docs/LEAD-STATE.md` from the local ref: run `git fetch origin && git fetch . origin/main:main` first, or read `origin/main`.**

## 1. Where the project stands
- Phase 3 merged: 3.0, 3.1a/b/c, 3.2a/b, 3.3, 3.4, 3.4b, 3.5a Part A, 3.6, 3.6b A1 and A2, **3.7 Part A**, 3.8 (all parts), 3.8a, 3.8b, 3.8c, 3.11 A1, 3.12–3.21, **3.22, 3.25**. Track M merged: M.1 to M.5. Details per card: `docs/STATUS.md`.
- **Owner request (2026-10-23):** finish every partly done card and plan everything not started; the owner runs 6–7 sessions (Opus plans and reviews, Sonnet 5.5 codes). Plans 3.23–3.26 exist; the rest is planned just in time in the order of §4.
- **Dependency patch on main** (`cf245e3`, 2026-10-24): body-parser and zod had new high advisories that failed `npm audit` on every branch. A branch whose CI failed on "Audit production dependencies" rebases on main.
- Owner decision (3.24): a stock receipt says how it was paid (CASH/BKASH/NAGAD/BANK) or `ON_CREDIT` (new `ACCOUNTS_PAYABLE`); opening stock → `OPENING_BALANCE`.
- Owner's tools: Claude Code in VS Code is the lead; Qoder, Antigravity (and GPT Codex for 3.26) implement. Disk E: 2.2 GB free: no new folders.
- Note: `npm audit fix --omit=dev` deletes devDependencies from `node_modules`; run `npm install` after it.
- `gh run watch` sometimes exits early on this PC (TLS timeouts). Poll with `gh run view <id> --json status` in a loop instead. DNS to github.com also drops now and then: retry the command.
- **Flaky CI tests:** 3.26 Part A fixed two (idempotency takeover, rate-limit middleware: TTL monitor vs a past clock); the ordered-event-worker skip test is Part B. Until merged, rerun with `gh run rerun <id> --failed`.
- **Run date-sensitive suites between 00:00 and 06:00 Dhaka now and then:** the 3.25 unlock-limit bug only showed then; CI runs in the afternoon.

## 2. Open branches (checked 2026-10-24 early morning)
| Card / part | Branch | Folder | Tier | State and next step |
|---|---|---|---|---|
| 3.6b A3 event bookings | `s/3.6b-api-event-booking` (`f25f12a`) | `banijjik-3.6b-a3` | T1 | In progress (pushed, no done yet). Plan `3.6b.md` "Refresh 2". Next: T1 review on done. |
| 3.23 orders as payment requests | `s/3.23-order-payments` (`09591ad`) | `banijjik-3.5a` | T1 | In progress. Plan `3.23.md` + **Amendment 1** (`d30f34f`: older orders become payable through `ensureSummary`). Next: T1 review on done. |
| 3.26 stable kernel tests | `s/3.26-stable-kernel-tests` (`4c4a04c`) | `banijjik-m2` | T2 | Part A passed the merge check (not merged yet). Owner told the session to rebase and do Part B now (3.22 merged). Next: merge check of A+B together; the lead adds the proposed conventions note from the handoff to `05-CONVENTIONS.md` and removes the flaky note in §1. |
| M.7 A1 reports | `s/M.7-api-reports` (`1f4cb3f`) | `banijjik-3.11` | T1 | In progress (handoff exists, no done yet). Next: T1 review on done. |
| M.8a matrimony templates | `s/M.8a-matrimony-templates` | `banijjik-m8a` | T2 | Work was left uncommitted in the folder (hook failure?); continue prompt given 2026-10-24. **At merge of the second of M.7 A1 / M.8a, the lead adds `reportReasons`** (M.8a decision 5) to both seeds. |
| 3.11 A2 payouts and posting | `s/3.11-api-payouts` | free folder (`banijjik`, `banijjik-1.7b` or `banijjik-lead`) | T1 | **Ready now** (3.22 merged). Plan 3.11 decisions 7–8 + Amendments 1–3; `accounting.postCommission` must declare `streamPrefixes: ["commission:"]` (3.22 decision 6). Prompt not given yet. |
| 3.24 order and stock posting | `s/3.24-api-order-stock-posting` | — | T1 | Waits for 3.23. Plan `3.24.md`, ADR-138. Its advance reader takes `currency` now (3.25 review). |

Merged and safe to delete (local and `origin`):
- card branches: `s/3.22-ordered-stream-follow`, `s/3.25-posting-dates-advances`, `s/3.7-api-enrollment-v2`, `s/chore-audit-2026-10-24`, `s/3.6b-api-event-sessions`, `s/3.8-ui-payments`, `s/3.5a-api-orders`, `s/3.6b-api-rental`, `s/3.11-api-accruals`, `s/3.8-ui-dues-store-credit`, `s/3.8-api-payments`, `s/M.5-ui-credit-purchases`, `s/3.15-test-stability`, `s/3.16-dead-letter-replay-race`, `s/3.17-next-security`, `s/3.18-delivery-guardrails`, `s/3.19-job-config-version`, `s/M.5-api-credit-purchases`, `s/M.5-threshold-cleanup`, `s/3.20-local-fonts`, `s/3.21-accounting-currency`
- merge branches: `s/merge-3.6b-a2-3.8-b1`, `s/merge-3.5a`, `s/merge-M.5`, `s/merge-3.18-3.19`, `s/merge-3.20`, `s/merge-3.21`
- docs branches: `s/docs-state-2026-10-24`, `s/docs-3.23-amend-1`, `s/docs-3.26-amend-1`, `s/docs-plans-3.23-3.26`, `s/docs-state-2026-10-23-a3`, `s/docs-3.6b-a3-refresh`, `s/docs-reviews-2026-10-23`, `s/docs-state-2026-10-23*`, `s/docs-state-2026-10-22h/l/m`, `s/docs-3.7-event-names`, `s/docs-3.7-review-r1`, `s/docs-3.5a-review-r1`, `s/docs-plans-3.20-3.21`, `s/docs-3.21-amendment`, `s/docs-plan-M.7`
- PR #2 (3.8) can be closed as merged.

Folders: free now: `banijjik` (3.22 done), `banijjik-1.7b` (3.7 A done), `banijjik-lead` (3.25 done). `banijjik-docs` is the docs and merge folder; the next lead session opens there.

**Agents claim "done" early.** A "done" without the full `npm run card:check` output (all PASS) is not reviewed. Verify anyway: `git status` in the folder (M.8a left everything uncommitted; 3.25 left a handoff edit uncommitted), `origin/<branch>`, `gh run view <run> --json jobs`, `--log-failed`. Always `git fetch` and compare with `origin/main`, not a stale local `main`.

Stash `stash@{4}` in `banijjik` holds the owner's uncommitted edits to `AGENTS.md` and `docs/05-CONVENTIONS.md` ("Engineering safeguards"). The owner has not said keep or drop.

## 3. Waiting on the owner
- Start 3.11 A2 in a free folder (prompt to give: next lead action 2).
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions (SMS provider, pricing, photo policy, domain, legal review).

## 4. Next actions, in order
1. Verify reality (`git fetch`, folders, `origin/<branch>`, `gh run list`). For every "done", require the `card:check` output.
2. Give the owner the **3.11 A2** prompt (free folder; plan 3.11 decisions 7–8, Amendments 1–3, the `commission:` stream prefix).
3. **Plan "enrollment as a payment request"** (new T1 card, next number 3.27; 3.7 Part A merged): register `ENROLLMENT` in payment's request readers (use 3.23's `buildPaymentRequestReaders` once merged), allocations to `enrollmentPeriodId`, period PAID/PARTIAL, OVERDUE → ACTIVE, activation on the first full payment of period 1 (3.7 handoff "Known gaps"). Until then default `requirePaymentToActivate: true` means no enrollment can be activated. Then refresh 3.7 Part B.
4. Reviews as sessions report done: 3.23 (then release 3.24, refresh 3.5a Part B), 3.6b A3 (then plan "event sessions occupy resources", refresh 3.6b Part B), M.7 A1 (then refresh M.7 A2 and B), merge checks of 3.26 (A+B) and M.8a, then 3.11 A2.
5. **Plan M.6** (storefront app): read ADR-010, ADR-031, `06 §8`, `13-UX`, `routes/storefront.ts`, `contact/presentation/customer-cookies.ts`, CORS in `app.ts`. Open questions: host → organization resolution, customer cookies across the app and API hosts. M.6a T1; M.6b T2.
6. Later plans, just in time: 3.11 B after A2; 3.11 C, 3.5b and 3.9 POS after 3.5a B, 3.23 and 3.24; M.8b, M.9; 3.10; then `docs/handoffs/phase-3-review.md`.
7. Follow-ups:
   - **Credit expiry never runs:** `ExpireCreditsUseCase` is not registered as a scheduled job (M.4 gap; 3.25 made its `organizationId` input required). Small card.
   - `booking-org-adapter.ts` `buildOrganizationTimezoneReader` falls back to `"Asia/Dhaka"` when an organization has no time zone (silent default). Make it fail like the credit and payment readers.
   - 3.8 B1 leftover (UX, small): the refund dialog shows its "refund failed" label for an invalid amount instead of an amount-specific one.
   - `sales` job rows log at `warn`; booking jobs use `error`. Align in 3.5a Part B or 3.5b.
   - The admin script budget is 180 KiB. New admin routes need a budget check in their browser test.
   - Replayer safety across more than one worker process (STATUS 3.16 note).
   - Auto-confirm of an order after its advance is paid (3.23 left it out) belongs to the storefront/bot phase.
   - Supplier payments clearing `ACCOUNTS_PAYABLE` (3.24 left it out): a later card.

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
- **2026-10-24 early morning** (Opus): verified all sessions. T1 review and merge of 3.22 (`53dbb41`). 3.25 T1 review: the lead fixed four leftovers (BDT fallback in the advance reader, random org id in credit expiry, unguarded org context, and a real bug: the unlock limit counted the UTC day, so it failed 00:00–06:00 Dhaka) and merged (`a84e076`). New body-parser/zod advisories broke every CI: lockfile patch merged (`cf245e3`). 3.7 Part A R1 re-review passed, rebased, merged (`62883d7`). 3.26 A passed. Amended plans 3.26 (no conventions edit) and 3.23 (older orders payable). Gave M.8a and 3.23 prompts again.
- **2026-10-23 late night 5** (Opus): owner asked to finish all partial cards and plan the rest for 6–7 sessions. Planned 3.23 (orders as payment requests, ADR-137), 3.24 (order and stock posting, ADR-138; owner decision on receipt funding), 3.25 (local posting dates, held advances), 3.26 (flaky kernel tests); refreshed the ready board; gave eight prompts. Found that no order or stock posting exists at all.
- **2026-10-23 late night 4** (Opus): merge CI 39982376348 green; `main` reached `4ec9879` (another chat pushed it first; the owner made this chat the lead). Wrote 3.6b plan "Refresh 2" for A3 on the merged A1/A2 code (`e22df9f`) and gave the A3 prompt. Found: expire-holds has no per-row catch, reschedule's optional time zone with an `"Asia/Dhaka"` fallback (both fixed in A3), sessions do not block resources (§4 item 4).
- **2026-10-23 late night 3** (Opus): re-checked 3.6b A2 (all R1 fixed, passed) and 3.8 B1 (R1 fixed; the lead fixed three leftovers in `e900c89`), built `s/merge-3.6b-a2-3.8-b1`, CI rerun after a flaky rate-limiter test. Told the owner the remaining Phase 3 list (§1).
- **2026-10-23 late night 2** (Opus): owner asked to verify every "done". 3.5a Part A: R2 passed, merged (`5958710`, one flaky kernel test rerun). 3.6b A1 and 3.11 A1 confirmed merged. 3.8 B1 merge check R1 (5 must-fix) and 3.6b A2 R1 (not done) written to `docs/handoffs/` and pasted by the owner. 3.22 and 3.11 A2 never started.
