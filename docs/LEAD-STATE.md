# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.


Last updated: 2026-10-24 (morning, Dhaka) by Opus 5.5 · `main` = `origin/main` = this state save on top of `dad5b4a` (M.7 A1 merged) (pushed); 3.11 A2 waits for CI (§2). **The `/lead` skill reads `main:docs/LEAD-STATE.md` from the local ref: run `git fetch origin && git fetch . origin/main:main` first, or read `origin/main`.**

## 1. Where the project stands
- Phase 3 merged: 3.0, 3.1a/b/c, 3.2a/b, 3.3, 3.4, 3.4b, 3.5a Part A, 3.6, 3.6b A1, A2 **and A3**, 3.7 Part A, 3.8 (all parts), 3.8a, 3.8b, 3.8c, 3.11 A1, 3.12–3.22, 3.25. Track M merged: M.1 to M.5, **M.7 A1**. Details per card: `docs/STATUS.md`.
- **Owner request (2026-10-23):** finish every partly done card and plan everything not started; the owner runs 6–7 sessions (Opus plans and reviews, Sonnet 5.5 codes). Plans 3.23–3.26 exist; the rest is planned just in time in the order of §4.
- **Dependency patch on main** (`cf245e3`, 2026-10-24): body-parser and zod had new high advisories that failed `npm audit` on every branch. A branch whose CI failed on "Audit production dependencies" rebases on main.
- Owner decision (3.24): a stock receipt says how it was paid (CASH/BKASH/NAGAD/BANK) or `ON_CREDIT` (new `ACCOUNTS_PAYABLE`); opening stock → `OPENING_BALANCE`.
- Owner's tools: Claude Code in VS Code is the lead; Qoder, Antigravity (and GPT Codex for 3.26) implement. Disk E: 2.2 GB free: no new folders.
- Note: `npm audit fix --omit=dev` deletes devDependencies from `node_modules`; run `npm install` after it.
- `gh run watch` sometimes exits early on this PC (TLS timeouts). Poll with `gh run view <id> --json status` in a loop instead. DNS to github.com also drops now and then: retry the command.
- **Flaky CI tests:** 3.26 Part A fixed two (idempotency takeover, rate-limit middleware: TTL monitor vs a past clock); the ordered-event-worker skip test is Part B. Until merged, rerun with `gh run rerun <id> --failed`.
- **Run date-sensitive suites between 00:00 and 06:00 Dhaka now and then:** the 3.25 unlock-limit bug only showed then; CI runs in the afternoon.

## 2. Open branches (checked 2026-10-24 morning)
| Card / part | Branch | Folder | Tier | State and next step |
|---|---|---|---|---|
| 3.11 A2 payouts and posting | `s/3.11-api-payouts` (`9b6d2d9`) | `banijjik` | T1 | **T1 review passed**, rebased on M.7 A1. First CI failed only on the permission count (M.7 and A2 each added 2 keys; the lead set 120 in `role-contracts.test.ts`). CI on `9b6d2d9` was running at save. **Next: when green, mark nothing more (STATUS row already says merged) and `git push origin origin/s/3.11-api-payouts:refs/heads/main`.** |
| 3.23 orders as payment requests | `s/3.23-order-payments` (`c74ea61`, on main) | `banijjik-3.5a` (finished by another chat after the session ran out of tokens) | T1 | Handoff written. Plan `3.23.md` + Amendment 1 (older orders payable via `ensureSummary`) + Amendment 2 (summary contact moves only while nothing is paid; `ORDER_CONTACT_LOCKED_BY_PAYMENT`). **Next: T1 review** (money paths, cancel to store credit once, advance check inside the unit of work, list without N+1, the settlement generalization), then release 3.24 and refresh 3.5a Part B. |
| 3.26 stable kernel tests A+B | `s/3.26-stable-kernel-tests` (`ddfef51`, on main) | `banijjik-m2` (finished by another chat) | T2 | Part A passed; Part B (ordered-event-worker test) reported. **Next: merge check** of Part B; at merge the lead adds the proposed "writing time-dependent tests" note from `docs/handoffs/3.26.md` to `05-CONVENTIONS.md` and removes the flaky-test line in §1. |
| M.8a matrimony templates | none on origin | `banijjik-m8a` | T2 | **Not done:** the work (seeds `matrimony.json`, `matrimony-islamic.json`, tests, docs, handoff) is still uncommitted in the folder (10 files) since 2026-10-23; the owner must start a session with the "continue" prompt (commit, fix the hook failure, rebase, push). **M.7 A1 is merged, so at the M.8a merge the lead adds `reportReasons`** (keys in M.8a decision 5) to both seeds. |
| 3.24 order and stock posting | `s/3.24-api-order-stock-posting` | — | T1 | Waits for 3.23. Plan `3.24.md`, ADR-138 (its advance reader call needs `currency`, 3.25 review). |

Merged and safe to delete (local and `origin`):
- card branches: `s/M.7-api-reports`, `s/3.6b-api-event-booking`, `s/3.22-ordered-stream-follow`, `s/3.25-posting-dates-advances`, `s/3.7-api-enrollment-v2`, `s/chore-audit-2026-10-24`, `s/3.6b-api-event-sessions`, `s/3.8-ui-payments`, `s/3.5a-api-orders`, `s/3.6b-api-rental`, `s/3.11-api-accruals`, `s/3.8-ui-dues-store-credit`, `s/3.8-api-payments`, `s/M.5-ui-credit-purchases`, `s/3.15-test-stability`, `s/3.16-dead-letter-replay-race`, `s/3.17-next-security`, `s/3.18-delivery-guardrails`, `s/3.19-job-config-version`, `s/M.5-api-credit-purchases`, `s/M.5-threshold-cleanup`, `s/3.20-local-fonts`, `s/3.21-accounting-currency`
- merge branches: `s/merge-3.6b-a2-3.8-b1`, `s/merge-3.5a`, `s/merge-M.5`, `s/merge-3.18-3.19`, `s/merge-3.20`, `s/merge-3.21`
- docs branches: all `s/docs-*` (every one is merged into main)
- PR #2 (3.8) can be closed as merged.

Folders: free now: `banijjik-1.7b`, `banijjik-lead`, `banijjik-3.6b-a3`, `banijjik-3.11` (M.7 done). `banijjik` frees after the 3.11 A2 merge. `banijjik-docs` is the docs and merge folder; the next lead session opens there. Disk E: about 2 GB free: no new folders; consider removing one finished folder (`git worktree remove`) if space runs out.

**Agents claim "done" early.** A "done" without the full `npm run card:check` output (all PASS) is not reviewed. Verify anyway: `git status` in the folder (M.8a left everything uncommitted), `origin/<branch>`, `gh run view <run> --json jobs`, `--log-failed`. Always `git fetch` and compare with `origin/main`. **Before touching a session's folder, check it is idle** (`git status`, no `rebase-merge` dir, last commit time): the lead once started a rebase while the M.7 session was rebasing in the same folder.

**Parallel branches that each bump a count test** (permission keys, audit actions, sequence keys) merge cleanly but fail CI together: after a rebase, run `packages/contracts` tests before pushing.

Stash `stash@{4}` in `banijjik` holds the owner's uncommitted edits to `AGENTS.md` and `docs/05-CONVENTIONS.md` ("Engineering safeguards"). The owner has not said keep or drop.

## 3. Waiting on the owner
- Start M.8a with the "continue" prompt in `banijjik-m8a`.
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions (SMS provider, pricing, photo policy, domain, legal review).

## 4. Next actions, in order
1. Verify reality (`git fetch`, folders, `origin/<branch>`, `gh run list`). For every "done", require the `card:check` output.
2. Land 3.11 A2 (see §2) once its CI is green.
3. T1 review of 3.23; merge check of 3.26 (A+B). Then release 3.24 (prompt) and refresh 3.5a Part B.
4. **Plan "enrollment as a payment request"** (new T1 card 3.27): register `ENROLLMENT` in payment's request readers (via 3.23's `buildPaymentRequestReaders`), allocations to `enrollmentPeriodId`, period PAID/PARTIAL, OVERDUE → ACTIVE, activation on the first full payment of period 1 (3.7 handoff "Known gaps"). Until then default `requirePaymentToActivate: true` means no enrollment can be activated. Then refresh 3.7 Part B.
5. Refresh and release: M.7 A2 (blocks, self-erasure, data export; plan `M.7.md` Part A2) and M.7 B; 3.6b Part B (screens); 3.11 B (screens); plan "event sessions occupy their resources" (T1, 3.6b A3 left it out).
6. **Plan M.6** (storefront app): read ADR-010, ADR-031, `06 §8`, `13-UX`, `routes/storefront.ts`, `contact/presentation/customer-cookies.ts`, CORS in `app.ts`. Open questions: host → organization resolution, customer cookies across the app and API hosts. M.6a T1; M.6b T2.
7. Later plans, just in time: 3.11 C, 3.5b and 3.9 POS after 3.5a B, 3.23 and 3.24; M.8b, M.9; 3.10; then `docs/handoffs/phase-3-review.md`.
8. Follow-ups:
   - **Credit expiry never runs:** `ExpireCreditsUseCase` is not registered as a scheduled job (M.4 gap; its `organizationId` input is required since 3.25). Small card.
   - `booking-org-adapter.ts` `buildOrganizationTimezoneReader` falls back to `"Asia/Dhaka"` when an organization has no time zone (silent default). Make it fail like the credit and payment readers.
   - 3.6b A3: the session-cancel note is only in the audit entry (`transitionBookingProps` never writes `note`); the cancel job's session list is sorted by `startsAt` while its index sorts by `bookingsSettledAt`; 10 permanently failing sessions at the front could starve later ones.
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
- **2026-10-24 morning** (Opus): T1 reviews passed and merged 3.6b A3 (`86230ea`) and M.7 A1 (`dad5b4a`, rebased by the lead after the session finished its own rebase); 3.11 A2 review passed, rebased, count-test fix, CI pending. Plan 3.23 Amendment 2 (summary contact moves only while unpaid). M.8a still uncommitted in its folder. 3.23 and 3.26 B finished by another chat.
- **2026-10-24 early morning** (Opus): verified all sessions. T1 review and merge of 3.22 (`53dbb41`). 3.25 T1 review: the lead fixed four leftovers (BDT fallback in the advance reader, random org id in credit expiry, unguarded org context, and a real bug: the unlock limit counted the UTC day, so it failed 00:00–06:00 Dhaka) and merged (`a84e076`). New body-parser/zod advisories broke every CI: lockfile patch merged (`cf245e3`). 3.7 Part A R1 re-review passed, rebased, merged (`62883d7`). 3.26 A passed. Amended plans 3.26 (no conventions edit) and 3.23 (older orders payable). Gave M.8a and 3.23 prompts again.
- **2026-10-23 late night 5** (Opus): owner asked to finish all partial cards and plan the rest for 6–7 sessions. Planned 3.23 (orders as payment requests, ADR-137), 3.24 (order and stock posting, ADR-138; owner decision on receipt funding), 3.25 (local posting dates, held advances), 3.26 (flaky kernel tests); refreshed the ready board; gave eight prompts. Found that no order or stock posting exists at all.
- **2026-10-23 late night 4** (Opus): merge CI 39982376348 green; `main` reached `4ec9879` (another chat pushed it first; the owner made this chat the lead). Wrote 3.6b plan "Refresh 2" for A3 on the merged A1/A2 code (`e22df9f`) and gave the A3 prompt. Found: expire-holds has no per-row catch, reschedule's optional time zone with an `"Asia/Dhaka"` fallback (both fixed in A3), sessions do not block resources (§4 item 4).
- **2026-10-23 late night 2** (Opus): owner asked to verify every "done". 3.5a Part A: R2 passed, merged (`5958710`, one flaky kernel test rerun). 3.6b A1 and 3.11 A1 confirmed merged. 3.8 B1 merge check R1 (5 must-fix) and 3.6b A2 R1 (not done) written to `docs/handoffs/` and pasted by the owner. 3.22 and 3.11 A2 never started.
