# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.


Last updated: 2026-10-23 (late evening, Dhaka) by Opus 5.5 · `main` = `origin/main` = `c333375` plus this state save (pushed). Since `b616bbf`: 3.21 plan Amendment 1, plans M.7 (3.6b → ADR-133) and M.8a, **3.20 merged** (`ac6da2f`, CI 39915151630) and **3.21 merged** (`c333375`, CI 39917046672)

## 1. Where the project stands
- Phase 3 merged: 3.0, 3.1a/b/c, 3.2a/b, 3.3, 3.4, 3.4b, 3.6, 3.8a, 3.8b, 3.8c, 3.12–3.19. Track M merged: M.1 to M.5 Part A. Details per card: `docs/STATUS.md`.
- **Merged today by the lead:**
  - 3.17: `next` 16.4.2, plus the booking browser test taking its Monday from the Dhaka date.
  - 3.18 delivery guardrails:
    - `npm run card:check` is the finish gate.
    - Guide §11 is the T1 self-review checklist; guide §10 adds the entry ticket and "lead fixes small leftovers".
    - A T1 part is about 15 production files; CI runs nightly on main at 21:30 UTC.
  - 3.19: `OrgConfigService.current()` reads `configVersion` from the organization inside jobs and handlers. Before this, every job that reads settings failed hourly in production.
  - M.5 Part A, then a lead cleanup. The purchase approval threshold is MONEY in the organization's currency, and a price in another currency asks for approval; the unreachable `{ amount, currency }` branch is removed.
- **Still left in Phase 3** after the open Part A's: Part B of 3.5a, 3.7, 3.8 and M.5; 3.6b; 3.5b; 3.11; 3.9 POS; 3.10; the phase review. Track M: M.6 to M.9.
- Owner's tools (2026-10-23): Claude Code in VS Code is the lead; Qoder and Antigravity implement. Cursor is off until its weekly limit resets.
- Note: `npm audit fix --omit=dev` deletes devDependencies from `node_modules`; run `npm install` after it.
- CI flake seen once: a browser Build failed fetching Google Fonts (`@vercel/turbopack-next/internal/font/google/font`). A rerun passed. Follow-up: self-host the fonts with `next/font/local`.

## 2. Open branches (checked 2026-10-23 afternoon)
| Card / part | Branch | Folder | Tier | State and next step |
|---|---|---|---|---|
| 3.8 Part A payments | `s/3.8-api-payments` (PR #2, `9146407`, rebased, CI green) | `banijjik-lead` | T1 | **R3: small changes** (`docs/handoffs/3.8-api-review-R3.md`). R2 is fully done. Open: the automatic no-show job settles no fee (wire the deposit port in the worker); optional booking deps and port methods must become required; `"CANCEL"`/`"NO_SHOW"`/fee-mode literals; wrong timezone error key; CI link in the handoff. Next: on a real done (`card:check`), verify and merge. If only ≤3 small items are left, the lead fixes them itself. |
| 3.5a Part A orders | `s/3.5a-api-orders` (`6043913`) | `banijjik-3.5a` | T1 | **R1: changes required** (`docs/handoffs/3.5a-api-review-R1.md`). Blockers: the approval token is not bound to the discount amount (instant sales share one subject); the edit consumes the token outside the transaction; an edit can empty a PLACED order or drop the pickup contact; one failing order stops the hourly jobs forever. Plus literals, actor on edit stock, list projection, ADR drift, missing tests. Not rebased yet. Next: wait for done, then re-review. |
| 3.7 Part A enrollment | `s/3.7-api-enrollment-v2` (`779f472`) | `banijjik-1.7b` | T1 | **R1: changes required** (`docs/handoffs/3.7-api-review-R1.md`, 10 items). **No commit since R1**: check that the owner gave it to a session. |
| M.5 Part B screens | `s/M.5-ui-credit-purchases` (`dd27790` + 4 uncommitted files in `apps/admin/src/credit/`) | `banijjik` (the M.5 session) | T2 | Plan `docs/plans/M.5.md` Part B. In progress. Next: merge check on a done with `card:check`. |
| M.7 Part A1 reports | `s/M.7-api-reports` (prompt given) | cloud | T1 | Plan `docs/plans/M.7.md` A1: reports, a blocked account's listing is hidden (handler), rate limit on the listing detail. ADR-134. Next: T1 review on a done. |
| M.8a matrimony templates | `s/M.8a-matrimony-templates` (prompt given) | cloud | T2 | Plan `docs/plans/M.8a.md`: two DRAFT seed templates + end-to-end test. **At merge of the second of M.7 A1 / M.8a, the lead adds `reportReasons`** (keys listed in M.8a decision 5) to both seeds. Next: merge check. |
| 3.6b rental/event Part A | not created | none | T1 | Plan on main, now **ADR-133** (3.5a took ADR-131). Waits until 3.8 or 3.7 Part A merges (same `booking` files). |

Merged and safe to delete (local and `origin`):
- card branches: `s/3.15-test-stability`, `s/3.16-dead-letter-replay-race`, `s/3.17-next-security`, `s/3.18-delivery-guardrails`, `s/3.19-job-config-version`, `s/M.5-api-credit-purchases`, `s/M.5-threshold-cleanup`, `s/3.20-local-fonts`, `s/3.21-accounting-currency`
- merge branches: `s/merge-M.5`, `s/merge-3.18-3.19`, `s/merge-3.20`, `s/merge-3.21`
- docs branches: `s/docs-state-2026-10-22h`, `-22l`, `-22m`, `s/docs-state-2026-10-23`, `-23b`, `-23c`, `-23d`, `-23e`, `s/docs-3.7-event-names`, `s/docs-3.7-review-r1`, `s/docs-3.5a-review-r1`, `s/docs-plans-3.20-3.21`, `s/docs-3.21-amendment`, `s/docs-plan-M.7`

Folders:
- **`banijjik-m2` is free** (3.21 merged; switch it to `main` before the next card). `banijjik` has M.5 Part B, `banijjik-lead` has 3.8, `banijjik-3.5a` has 3.5a, and `banijjik-1.7b` has 3.7. E: has 4.2 GB free (2026-10-23).
- Extra work runs as cloud sessions (M.7 A1, M.8a). When M.5 B merges, `banijjik` is free too.
- 3.21 changed `GetTrialBalanceUseCase.execute(organizationId, asOf)` and the use-case constructors (a required currency port). Check 3.8 and 3.5a against it when they rebase.
- **3.7 has had no commit since R1** (`779f472`). Ask the owner whether a session has it.
- `banijjik-docs` is the docs and merge folder. This lead session ran in `banijjik`; the next one opens in `banijjik-docs`.

**Agents claim "done" early.** On 2026-10-23 three cards were claimed done; one was. From now on, a "done" without the full `npm run card:check` output (all PASS) is not reviewed. Verify anyway: `git status` in the folder, `origin/<branch>`, `gh run view <run> --json jobs`, `--log-failed`.

Stash `stash@{4}` in `banijjik` holds the owner's uncommitted edits to `AGENTS.md` and `docs/05-CONVENTIONS.md` ("Engineering safeguards"). The owner has not said keep or drop.

## 3. Waiting on the owner
- Give the review files to the sessions: 3.5a R1, 3.8 R3, 3.7 R1 (no commit since R1). Paste the 3.21 Amendment 1 answer and the 3.20 correction (given 2026-10-23 late evening). Start M.7 A1 and M.8a as cloud sessions (Sonnet 5.5; prompts given).
- Owner capacity (2026-10-23): 6–7 implement sessions at once. The bottleneck is the three T1 Part A review rounds (3.8, 3.5a, 3.7), not session count; 3.8 merging unlocks 3.6b, 3.8 B, 3.11 and 3.9.
- Model rule given to the owner: Sonnet 5.5 for T1/T2 implementation (the lead reviews strictly); Haiku 5.5 only for T3 mechanical cards, never for money, stock or security.
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions (SMS provider, pricing, photo policy, domain, legal review).

## 4. Next actions, in order
1. Verify reality (folders, `origin/<branch>`, `gh run list`). For every "done", run `npm run card:check` in that folder.
2. Re-review as sessions report done:
   - 3.8 against R3. It is small: if at most three small items remain, the lead fixes them on the branch and merges.
   - 3.5a against R1, blockers first.
   - 3.7 against R1, B1–B4 first.
   - Merge through `s/merge-<card>` in `banijjik-docs` when a branch is behind main.
   - Merge hot spots: `routes/*`, `start-worker.ts`, contracts index files, booking files (3.8, 3.7, 3.6b), STATUS.md rows. Keep both rows; check `git grep -n "^<<<<<<<"`.
3. Merge checks of M.5 Part B and M.8a; T1 review of M.7 A1. When the second of M.7 A1 / M.8a merges, add `reportReasons` to both matrimony seeds (M.8a decision 5).
4. **Plan M.6 (minimal storefront) in a fresh session.** A new app `apps/storefront` (cloud session; E: has 4.2 GB). Read first: ADR-010, ADR-031, `06 §8`, `13-UX`, `routes/storefront.ts`, `contact/presentation/customer-cookies.ts`, CORS in `app.ts`. Open questions: host → organization resolution (no subdomain lookup endpoint yet), customer cookies across the app and API hosts. Treat M.6a (shell, home, search, listing page, sign-in) as T1 because of the cookie and host design; M.6b (my biodata, connections, credits, report/block buttons from M.7, static pages) T2. Owner decision doc 16 §6.6 (domain): platform subdomain until chosen.
5. After 3.8 Part A merges: refresh and release 3.8 Part B and 3.6b, plan 3.11, refresh the 3.9 inputs. After 3.5a Part A: 3.5a Part B, plan 3.5b. After 3.7 Part A: 3.7 Part B (plan 3.7 refresh item 1). Refresh the ready board (guide §9).
6. After M.7 A1 merges: refresh M.7 A2 (file list) and release A2 and B. Later: 3.9 POS, 3.11, 3.10, M.8b, M.9, then `docs/handoffs/phase-3-review.md`.
7. Follow-ups:
   - The admin script budget is 180 KiB (owner, 2026-10-22).
   - Replayer safety across more than one worker process (STATUS 3.16 note).

## 5. How the lead works
- **Role:** plans (just in time), strict T1 reviews, merge checks, integration (rebases, conflicts), fast-forward of `main`. Implementation is done by the owner's sessions (Cursor, Antigravity, Claude Code, Qoder), not by the lead, unless the owner asks.
- **One lead session at a time.** On 2026-10-22 two lead sessions ran together and both started merging 3.15/3.16. If another lead session messages, agree who owns which branch before touching `main` or `banijjik-docs`.
- **Language:** reply to the owner in Bengali script; code, comments and docs in English.
- **Review:** read the diff against the plan and `AGENTS.md`; try to break T1 security, money, stock and concurrency rules; require a green CI run on the branch head. Never accept an implementer's report as proof (3.8's handoff said "Deviations: None" while ADR-123 and half the tests were missing). Review findings go in `docs/handoffs/<card>-review-R<n>.md` and the owner pastes them to the session.
- **Integration habits:** Cursor branches tend to refactor `routes/v1.ts` and the router builders. Keep the 3.8c layout (`routes/core-tenant-routers.ts`, `routes/tenant-module-routers.ts`, `routes/iam-tenant-router.ts`). i18n catalog end-of-file conflicts: keep both sides joined by a comma. Keep `\\.` escaping in `eslint/restrictions.mjs`. To merge several branches or one whose base is behind, build `s/merge-<card>` in `banijjik-docs` (`git switch -c s/merge-<card> main`, `git cherry-pick <base>..<branch>`), push it, wait for green CI, fast-forward `main` to it; the implementer's branch is not rewritten. There is no `python` on this PC; edit conflicts with the Edit tool.
- **Folders:** one chat per folder. `banijjik`, `banijjik-1.7b`, `banijjik-lead`, `banijjik-m2` have their own `node_modules`. `banijjik-docs` is light: its `node_modules` is a junction to `banijjik`'s (enough for the commit hooks; not for builds). Disk is nearly full (E: about 5.5 GB, C: about 4.3 GB free), so there are no new full folders. Extra sessions run as cloud agents (they leave a local worktree under `banijjik/.claude/worktrees/`; remove it with `git worktree remove` after the merge).
- **Docs commits:** in `banijjik-docs`, `git switch -c s/docs-<slug> main`, commit, then from any folder `git fetch . s/docs-<slug>:main` (fast-forward only).
- **Local verify** (only for integration of several branches; one heavy run at a time): environment `MONGOMS_SYSTEM_BINARY="C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe" MONGOMS_VERSION_CHECK=false TEST_REDIS_URL=redis://127.0.0.1:6380 NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 NEXT_PUBLIC_BRAND_NAME=Example CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"`. Then `npm run lint`, `npm run format:check`, `VITEST_MAX_WORKERS=2 npx turbo run build typecheck test --force --env-mode=loose --concurrency=1 --continue`, and the browser suites with `VITEST_MAX_WORKERS=1 npm run test:browser` in `apps/admin` and `apps/platform`. Move `apps/api/.env` aside during the run (it exists only in `banijjik`) and put it back. Docker (`infra/docker-compose.yml`: Mongo 27018, Redis 6380) may need starting after a reboot; never touch other containers.
- **Finish gate and leftovers (owner, 2026-10-23):** a review starts only from a `card:check` output with every line PASS. When a re-review leaves at most three small items, the lead fixes them on the branch and merges instead of starting another round.
- **Pushing `main`:** on 2026-10-23 the owner said to do whatever is needed, and the lead pushed green-CI merges that day without asking each time. Confirm at the start of a new session that this still holds.
- **Never:** `--no-verify`, resetting existing commits, committing `.env` files, printing env values.
- **Token cost** (measured 2026-10-22): about 90% of a day's usage went to carrying a 900k-token session, mostly full cache rewrites after a break of over an hour or a `/model` switch. Keep sessions short: one task, then `/save-state`, then a new session with `/lead`.

## 6. Session log (last five)
- **2026-10-23 late evening** (Haiku then Opus): Haiku wrongly told the owner plans 3.20/3.21 were missing (it read the M.5 branch, not `main`); corrected. Answered 3.21's two conflicts with plan Amendment 1. The 3.20 session had the 3.21 prompt; gave a correction. Owner wants more parallel lanes: wrote plans M.7 (A1 now, A2/B later, ADR-134) and M.8a (seed data); 3.6b → ADR-133. Then merge checks: 3.20 (branch carried copies of main's docs commits; cherry-picked its two) and 3.21 (lead fixed an `as unknown as` test cast with a `Pick`). Pushed main `c333375`.
- **2026-10-23 evening** (Opus): answered the M.5 agent (docs were already done; removed the unreachable threshold branch myself, CI green). Listed the cards startable now; wrote plans 3.20 (fonts, T3, Haiku) and 3.21 (accounting currency, T2, Sonnet); gave prompts for M.5 Part B, 3.20, 3.21. Pushed main `b616bbf`.
- **2026-10-23 afternoon (2)** (Opus): owner asked why delivery is slow (answer: review round trips, false "done" claims, shared CI breakage, big cards; CI itself is ~10 min). Built and merged 3.18 (card:check, T1 checklist, nightly CI) and 3.19 (config in jobs, found in 3.5a). Verified and merged M.5 Part A. Reviews: 3.5a R1 (4 blockers, approval amount unbound), 3.8 R3 (small; auto no-show keeps no fee). Pushed main `8793398`.
- **2026-10-23 afternoon** (Opus): owner said the lead does the bump: 3.17 (`next` 16.4.2, `ip-address` 10.7.4, booking test Monday from the Dhaka date), CI 39901508552 green, local main `8bf386e` (push not yet allowed). Verified three "done" claims: 3.8 not done (typecheck red, fix uncommitted), M.5 not done (no commits), 3.5a done and ready for T1 review.
- **2026-10-22 late night (4)** (Opus): checked all branches (3.7 CI green, 3.8 R2 and M.5 R1 fixes not committed, 3.5a not pushed). Strict T1 review of 3.7 Part A: changes required, R1 with 10 items, on main `ed8299b`. Guided the M.5 fixing agent (caught two invented reports), verified its R1 fixes at `2e835e3` (3 small items left). Found the shared CI blockers: a critical Next.js audit advisory and a booking browser test failing after local midnight.