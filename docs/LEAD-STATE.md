# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.


Last updated: 2026-10-24 (midday, Dhaka) by Opus 5.5 · `main` = `origin/main` = this state save on top of `67848d6` (3.28, 3.29, 3.30 merged) (pushed). **The `/lead` skill reads `main:docs/LEAD-STATE.md` from the local ref: run `git fetch origin && git fetch . origin/main:main` first, or read `origin/main`.**

## 1. Where the project stands
- Phase 3: 42 numbered cards; **31 fully merged**: 3.0–3.4b, 3.6, 3.8 (all parts), 3.8a/b/c, 3.12–3.23, 3.25, 3.26, 3.28, 3.29, 3.30. Partly done (API merged, screens left): 3.5a (B), 3.6b (B), 3.7 (B), 3.11 (B, C). Running: 3.24, 3.27. Not started: 3.5b, 3.9, 3.10, 3.31, 3.32. Track M: M.0–M.5 and M.7 A1 merged; M.8a finishing; M.6, M.7 A2/B, M.8b, M.9 left. Details: `docs/STATUS.md`.
- **Owner request (2026-10-23):** finish every partly done card and plan everything not started; the owner runs 6–7 sessions (Opus plans and reviews, Sonnet 5.5 codes).
- **Owner (2026-10-24): the lead runs small T2/T3 cards itself with Sonnet subagents** (`model: "sonnet"`, background) in free folders that have `node_modules` (no new worktrees, disk ~1.7 GB). 3.28–3.30 were done this way.
- Owner decision (3.24): a stock receipt says how it was paid (CASH/BKASH/NAGAD/BANK) or `ON_CREDIT` (new `ACCOUNTS_PAYABLE`); opening stock → `OPENING_BALANCE`.
- Owner's tools: Claude Code in VS Code is the lead; Qoder, Antigravity implement.
- Note: `npm audit fix --omit=dev` deletes devDependencies from `node_modules`; run `npm install` after it.
- `gh run watch` drops on this PC (TLS timeouts). Poll with `gh run view <id> --json status,conclusion` in a loop. DNS to github.com also drops now and then: retry.
- Folders' `@banijjik/contracts` / `validation` `dist` can be stale after switching branches: `npx turbo run build --filter=<pkg>` before local tests. Low RAM: run API tests with `--maxWorkers=1`.
- Time-dependent tests follow `05-CONVENTIONS.md` "Testing" (3.26). Run date-sensitive suites between 00:00 and 06:00 Dhaka now and then.

## 2. Open branches (checked 2026-10-24 midday)
| Card / part | Branch | Folder | Tier | State and next step |
|---|---|---|---|---|
| M.8a matrimony templates | `s/M.8a-matrimony-templates` | `banijjik-m8a` | T2 | Content checked by the lead (matches plan; snake_case keys required by the schema; five `reportReasons` added by the session, so the lead adds nothing at merge). CI 40064518850 green; Bengali wording fix pushed (CI 40065530177). Session still has to rebase, rewrite the stale handoff (it says "Verified: PENDING" and "reportReasons absent"), STATUS row, `card:check`. **Next: merge check from its done message.** |
| 3.24 order and stock posting | `s/3.24-api-order-stock-posting` | `banijjik-3.5a` | T1 | Plan `3.24.md` **Refresh 1** (advance reader needs no registration; completion writes the summary to stop the payment race; stream prefix from `orderOrderingKey`). Prompt given 2026-10-24; nothing pushed yet. **Next: T1 review on done.** |
| 3.27 enrollment periods as payment requests | `s/3.27-api-enrollment-payments` | `banijjik-3.6b-a3` | T1 | Plan `3.27.md`, ADR-139 reserved (period = request, derived period status, handler on payment events + sync in activate/jobs, OVERDUE → ACTIVE, `BEFORE_REVENUE` until 3.31). Prompt given; nothing pushed yet. **Next: T1 review on done.** |

Merged and safe to delete (local and `origin`):
- card branches: `s/3.28-credit-expiry-job`, `s/3.29-booking-sales-leftovers`, `s/3.30-refund-amount-label`, `s/3.23-order-payments`, `s/3.26-stable-kernel-tests`, `s/3.11-api-payouts`, `s/M.7-api-reports`, `s/3.6b-api-event-booking`, `s/3.22-ordered-stream-follow`, `s/3.25-posting-dates-advances`, `s/3.7-api-enrollment-v2`, `s/chore-audit-2026-10-24`, and the older ones listed in git history
- merge branches: `s/merge-3.29b`, `s/merge-3.28`, `s/merge-3.30`, `s/merge-3.23`, `s/merge-3.26`, `s/merge-3.26b`, `s/merge-3.11-a2`, older `s/merge-*`. **`s/merge-3.29` (on origin) is broken** (a commit with conflict markers); never merge it, delete it.
- docs branches: all `s/docs-*`. PR #2 (3.8) can be closed as merged.

Folders: free now: `banijjik`, `banijjik-lead`, `banijjik-1.7b`, `banijjik-m2`, `banijjik-3.11`. Busy: `banijjik-m8a` (M.8a), `banijjik-3.5a` (3.24), `banijjik-3.6b-a3` (3.27). `banijjik-docs` is the docs and merge folder. Disk E: about 1.7 GB free: no new folders.

**Agents claim "done" early.** A "done" without the full `npm run card:check` output (all PASS) is not reviewed. Verify anyway: `git status` in the folder, `origin/<branch>`, `gh run view <run> --json jobs`, `--log-failed`, behind count against `origin/main`. Before touching a session's folder, check it is idle.

**Parallel branches that each bump a count test** (permission keys, audit actions, sequence keys, template keys) merge cleanly but fail CI together: after a rebase, run `packages/contracts` tests before pushing.

Stash `stash@{4}` in `banijjik` holds the owner's uncommitted edits to `AGENTS.md` and `docs/05-CONVENTIONS.md` ("Engineering safeguards"). The owner has not said keep or drop.

## 3. Waiting on the owner
- Paste the done messages of M.8a, 3.24 and 3.27 (with `card:check`).
- Say go for the next plans (§4 item 3).
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions (SMS provider, pricing, photo policy, domain, legal review).

## 4. Next actions, in order
1. Verify reality (`git fetch`, folders, `origin/<branch>`, `gh run list`).
2. Merge check of M.8a; T1 reviews of 3.24 and 3.27 as they report done.
3. **Refresh and release** (suggested to the owner, not started): 3.5a Part B (order screens; payment status is real since 3.23) and M.7 A2 (blocks, self-erasure, data export) in parallel; then 3.11 B, 3.6b B, M.7 B; after 3.27: 3.7 B.
4. **Plan a new T1 card "event sessions occupy their resources"** (3.6b A3 left it out: a hall used by a session can still be rented). Next free number is 3.33.
5. **Plan M.6** (storefront app): read ADR-010, ADR-031, `06 §8`, `13-UX`, `routes/storefront.ts`, `contact/presentation/customer-cookies.ts`, CORS in `app.ts`. Open questions: host → organization resolution, customer cookies across the app and API hosts. M.6a T1; M.6b T2.
6. Later plans, just in time: 3.31 (enrollment revenue posting, after 3.27 and 3.24), 3.32 (enrollment cancel refunds), 3.11 C, 3.5b and 3.9 POS (after 3.5a B and 3.24), M.8b, M.9, 3.10, then `docs/handoffs/phase-3-review.md`.
7. Follow-ups:
   - Refund dialog has no client-side maximum (3.30 test uses amount 0); a small T3 card if wanted.
   - The session-cancel job makes one pass over all unsettled sessions per run (3.29 handoff); fine at current volume.
   - The admin script budget is 180 KiB. New admin routes need a budget check in their browser test.
   - Replayer safety across more than one worker process (STATUS 3.16 note).
   - Auto-confirm of an order after its advance is paid (3.23 left it out) belongs to the storefront/bot phase.
   - Supplier payments clearing `ACCOUNTS_PAYABLE` (3.24 leaves it out): a later card.
   - 3.23 review follow-ups (`docs/handoffs/3.23-api-review-R1.md`): the advance holds only at confirm; a pre-3.23 order without a summary can race its cancel with a first payment; instant sales show as UNPAID dues until 3.9.

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
- **Shell pipelines hide failures:** `git cherry-pick ... | tail` returns tail's exit code, so a conflict does not stop a `&&` chain (it pushed `s/merge-3.29` with conflict markers). Never pipe a git command whose failure must stop the chain.
- **Token cost:** keep sessions short: one task, then `/save-state`, then a new session with `/lead`.

## 6. Session log (last five)
- **2026-10-24 midday** (Opus): T1 review and merge of 3.23 and merge check of 3.26 (`cecb5a0`); another lead chat was turned off by the owner. Planned 3.27 (enrollment payments, ADR-139), refreshed 3.24, planned and ran 3.28–3.30 with Sonnet subagents (owner request), merged all three (`67848d6`). Checked M.8a content; gave 3.24, 3.27 and M.8a prompts.
- **2026-10-24 morning 2** (Opus): landed 3.11 A2 (`e103af6`, via `s/merge-3.11-a2`: force-push of the card branch is blocked by the auto-mode classifier, so rebase by cherry-pick onto a merge branch). Merge check of 3.26 A+B passed (conventions note added). T1 review of 3.23 passed (lead renamed `hoursOf` → `integerOf`; review R1 file). Both merged at `cecb5a0`, CI 40059020558 green. Another lead chat briefly ran in parallel; the owner turned it off.
- **2026-10-24 morning** (Opus): T1 reviews passed and merged 3.6b A3 (`86230ea`) and M.7 A1 (`dad5b4a`, rebased by the lead after the session finished its own rebase); 3.11 A2 review passed, rebased, count-test fix, CI pending. Plan 3.23 Amendment 2 (summary contact moves only while unpaid). M.8a still uncommitted in its folder. 3.23 and 3.26 B finished by another chat.
- **2026-10-24 early morning** (Opus): verified all sessions. T1 review and merge of 3.22 (`53dbb41`). 3.25 T1 review: the lead fixed four leftovers (BDT fallback in the advance reader, random org id in credit expiry, unguarded org context, and a real bug: the unlock limit counted the UTC day, so it failed 00:00–06:00 Dhaka) and merged (`a84e076`). New body-parser/zod advisories broke every CI: lockfile patch merged (`cf245e3`). 3.7 Part A R1 re-review passed, rebased, merged (`62883d7`). 3.26 A passed. Amended plans 3.26 (no conventions edit) and 3.23 (older orders payable). Gave M.8a and 3.23 prompts again.
- **2026-10-23 late night 5** (Opus): owner asked to finish all partial cards and plan the rest for 6–7 sessions. Planned 3.23 (orders as payment requests, ADR-137), 3.24 (order and stock posting, ADR-138; owner decision on receipt funding), 3.25 (local posting dates, held advances), 3.26 (flaky kernel tests); refreshed the ready board; gave eight prompts. Found that no order or stock posting exists at all.
