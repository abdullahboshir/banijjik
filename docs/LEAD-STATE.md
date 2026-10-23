# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.


Last updated: 2026-10-23 (late night, Dhaka) by Opus 5.5 · `main` = `origin/main` = `0ccab2f` plus this note (pushed; the owner forwarded the 3.11 A1 session blocked on the unpushed plan). Since `7ddfb1f`: plan 3.11 + ADR-135 only; no branch moved.

## 1. Where the project stands
- Phase 3 merged: 3.0, 3.1a/b/c, 3.2a/b, 3.3, 3.4, 3.4b, 3.6, **3.8 Part A**, 3.8a, 3.8b, 3.8c, 3.12–3.21. Track M merged: M.1 to **M.5 (both parts)**. Details per card: `docs/STATUS.md`.
- **Merged this session by the lead:**
  - 3.8 Part A after R3. The lead fixed the last two leftovers on the branch: the no-show job's empty per-row `catch` now logs `booking.mark_no_show_failed` with the booking id, and `PaymentSummaryRepository.ensureSummary`/`setTotal` are required (they were optional and called with `?.`).
  - M.5 Part B merge check. The lead added the script-budget browser check for `/credit/packs` (171.8 KiB) and `/credit/purchases`. Purchases measured 186 KiB, so the lead made the detail sheet lazy (`credit-purchase-detail-sheet-lazy.tsx`), giving 170.6 KiB. The deviations the implementer left out (manifest menu item, purchase seeded through Mongo in the browser test) are in `docs/handoffs/M.5-ui.md`.
- **Still left in Phase 3:** Part A of 3.5a and 3.7 (in review rounds); Part B of 3.5a, 3.7 and 3.8; 3.6b; 3.5b; 3.11; 3.9 POS; 3.10; the phase review. Track M: M.6 to M.9.
- Owner's tools (2026-10-23): Claude Code in VS Code is the lead; Qoder and Antigravity implement. Cursor is off until its weekly limit resets.
- Note: `npm audit fix --omit=dev` deletes devDependencies from `node_modules`; run `npm install` after it.
- `gh run watch` sometimes exits early on this PC (TLS timeouts). Poll with `gh run view <id> --json status` in a loop instead.

## 2. Open branches (checked 2026-10-23 night)
| Card / part | Branch | Folder | Tier | State and next step |
|---|---|---|---|---|
| 3.5a Part A orders | `s/3.5a-api-orders` (`6043913`) | `banijjik-3.5a` | T1 | **R1: changes required** (`docs/handoffs/3.5a-api-review-R1.md`). Blockers: the approval token is not bound to the discount amount (instant sales share one subject); the edit consumes the token outside the transaction; an edit can empty a PLACED order or drop the pickup contact; one failing order stops the hourly jobs forever. Plus literals, actor on edit stock, list projection, ADR drift, missing tests. **No commit since R1**, 40+ commits behind main (3.8 and 3.21 changed shared code; check on rebase). Next: wait for done, then re-review. |
| 3.7 Part A enrollment | `s/3.7-api-enrollment-v2` (`779f472`) | `banijjik-1.7b` | T1 | **R1: changes required** (`docs/handoffs/3.7-api-review-R1.md`, 10 items). **No commit since R1**: ask the owner whether a session has it. Now that 3.8 merged, its rebase touches the same booking files. |
| M.7 Part A1 reports | `s/M.7-api-reports` (prompt given) | cloud | T1 | Plan `docs/plans/M.7.md` A1, ADR-134. **No branch on origin yet** (checked 2026-10-23 night). Next: T1 review on a done. |
| M.8a matrimony templates | `s/M.8a-matrimony-templates` (prompt given) | cloud | T2 | Plan `docs/plans/M.8a.md`. **No branch on origin yet.** **At merge of the second of M.7 A1 / M.8a, the lead adds `reportReasons`** (keys in M.8a decision 5) to both seeds. Next: merge check. |
| 3.6b A1 rentals / A2 event sessions | `s/3.6b-api-rental` / `s/3.6b-api-event-sessions` (prompts given 2026-10-23 night) | `banijjik` / cloud | T1 / T2 | Plan `docs/plans/3.6b.md` + "Refresh (2026-10-23)": three parts; A1 and A2 run in parallel, A3 (event bookings, T1) after both merge. Next: T1 review of A1, merge check of A2, then refresh and release A3. |
| 3.8 B1 payments / B2 dues and store credit | `s/3.8-ui-payments` / `s/3.8-ui-dues-store-credit` (prompts given 2026-10-23 night) | `banijjik-lead` / `banijjik-m2` | T2 | Plan `docs/plans/3.8.md` "Refresh 2": parallel, separate folders; each must carry a 180 KiB budget check per new route. Next: merge checks. |
| 3.11 A1 commission rules and accruals | `s/3.11-api-accruals` (prompt given 2026-10-23 late night) | cloud (no free full folder) | T1 | Plan `docs/plans/3.11.md`, ADR-135. Then A2 payouts (after A1), B screens (lead refreshes first), C order lines (after 3.5a A). Next: T1 review on a done. |

(Checked 2026-10-23 late night: none of the branches above had moved on origin, and no folder had uncommitted work.)

Merged and safe to delete (local and `origin`):
- card branches: `s/3.8-api-payments`, `s/M.5-ui-credit-purchases`, `s/3.15-test-stability`, `s/3.16-dead-letter-replay-race`, `s/3.17-next-security`, `s/3.18-delivery-guardrails`, `s/3.19-job-config-version`, `s/M.5-api-credit-purchases`, `s/M.5-threshold-cleanup`, `s/3.20-local-fonts`, `s/3.21-accounting-currency`
- merge branches: `s/merge-M.5`, `s/merge-3.18-3.19`, `s/merge-3.20`, `s/merge-3.21`
- docs branches: `s/docs-state-2026-10-22h`, `-22l`, `-22m`, `s/docs-state-2026-10-23`, `-23b` to `-23g`, `s/docs-3.7-event-names`, `s/docs-3.7-review-r1`, `s/docs-3.5a-review-r1`, `s/docs-plans-3.20-3.21`, `s/docs-3.21-amendment`, `s/docs-plan-M.7`
- PR #2 (3.8) can be closed as merged.

Folders:
- Assigned 2026-10-23 night: `banijjik` → 3.6b A1, `banijjik-lead` → 3.8 B1, `banijjik-m2` → 3.8 B2 (if the owner followed the prompts). `banijjik-3.5a` has 3.5a, `banijjik-1.7b` has 3.7. E: had 4.2 GB free (2026-10-23).
- `banijjik-docs` is the docs and merge folder. The next lead session opens in `banijjik-docs`.

**Agents claim "done" early.** A "done" without the full `npm run card:check` output (all PASS) is not reviewed. Verify anyway: `git status` in the folder, `origin/<branch>`, `gh run view <run> --json jobs`, `--log-failed`. Handoffs often say "Deviations: none" when there are some; diff against the plan's file list.

Stash `stash@{4}` in `banijjik` holds the owner's uncommitted edits to `AGENTS.md` and `docs/05-CONVENTIONS.md` ("Engineering safeguards"). The owner has not said keep or drop.

## 3. Waiting on the owner
- 3.5a: the session claimed done, but origin is still `6043913` (before R1); the owner got a message for it. 3.7 R1: no commit since. Start M.7 A1 and M.8a as cloud sessions if not yet running (no branches on origin).
- Owner capacity (2026-10-23): 6–7 implement sessions at once. Three folders are free now.
- Model rule given to the owner: Sonnet 5.5 for T1/T2 implementation (the lead reviews strictly); Haiku 5.5 only for T3 mechanical cards, never for money, stock or security.
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions (SMS provider, pricing, photo policy, domain, legal review).

## 4. Next actions, in order
1. Verify reality (folders, `origin/<branch>`, `gh run list`). For every "done", run `npm run card:check` in that folder.
2. **Plans still missing (owner is waiting on them):** 3.11 is planned (`16b70e8`, A1 prompt given).
   - Refresh the 3.9 POS inputs.
   - Plan M.6 (minimal storefront; M.5 merged) in a fresh session. A new app `apps/storefront` (cloud session). Read first: ADR-010, ADR-031, `06 §8`, `13-UX`, `routes/storefront.ts`, `contact/presentation/customer-cookies.ts`, CORS in `app.ts`. Open questions: host → organization resolution (no subdomain lookup endpoint yet), customer cookies across the app and API hosts. M.6a (shell, home, search, listing page, sign-in) T1; M.6b (my biodata, connections, credits incl. the M.5 purchase flow, report/block buttons from M.7, static pages) T2. Domain: platform subdomain until doc 16 §6.6 is decided.
   - Refresh the ready board (guide §9).
3. Re-review as sessions report done: 3.5a against R1 (blockers first), 3.7 against R1 (B1–B4 first). If at most three small items remain, the lead fixes them and merges. Merge through `s/merge-<card>` in `banijjik-docs` when a branch is behind main. Hot spots: `routes/*`, `start-worker.ts`, contracts index files, booking files (3.7, 3.6b now collide with merged 3.8), STATUS.md rows; check `git grep -n "^<<<<<<<"`.
4. Merge check of M.8a; T1 review of M.7 A1. When the second of the two merges, add `reportReasons` to both matrimony seeds.
5. After 3.5a Part A: 3.5a Part B, plan 3.5b. After 3.7 Part A: 3.7 Part B (plan 3.7 refresh item 1). After M.7 A1: refresh M.7 A2 and release A2 and B. Later: 3.9 POS, 3.10, M.8b, M.9, then `docs/handoffs/phase-3-review.md`.
6. Follow-ups:
   - The admin script budget is 180 KiB (owner, 2026-10-22). New admin routes need a budget check in their browser test (M.5 had none until the lead added it).
   - Replayer safety across more than one worker process (STATUS 3.16 note).
   - **Bug found while planning 3.11:** `commerce/booking/application/booking-posting-source.ts` uses `startsAt.toISOString().slice(0, 10)` as the journal business date (UTC, §11 item 13) and `kind: "SERVICE"` for every booking; `advancesToSettle` = `depositRequired`, not the deposit actually paid. Check whether 3.6b A1 fixes `kind`; plan a small T2 fix card for the rest.

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
- **Pushing `main`:** the owner allowed it again on 2026-10-23 night ("push koro") for green-CI merges. Confirm at the start of a new session that this still holds.
- **Never:** `--no-verify`, resetting existing commits, committing `.env` files, printing env values.
- **Token cost:** keep sessions short: one task, then `/save-state`, then a new session with `/lead`.

## 6. Session log (last five)
- **2026-10-23 late night** (Opus): nothing moved on any branch. Planned 3.11 (A1 → A2 → B, C after 3.5a; ADR-135) after four owner decisions (base after discount without tax, proportional refund adjustment, expense at accrual, higher role rule wins). Found the booking posting business-date bug. Main pushed after the A1 session asked for the plan on origin.
- **2026-10-23 night** (Opus): refreshed 3.8 Part B (B1/B2 parallel) and 3.6b (A1/A2 parallel, A3 after) and gave four prompts; 3.5a claimed done but nothing new on origin (still `6043913`), owner told. Earlier: 3.8 R3 fixes arrived; the lead fixed the last two leftovers (empty job catch, optional summary methods) and merged 3.8 Part A (`471a773`). M.5 Part B merge check: added the credit budget check, found purchases at 186 KiB, made the detail sheet lazy (170.6 KiB), merged (`cf17e3c`). Owner allowed pushing main. Owner is waiting on the unblocked work (3.8 B, 3.6b, 3.11, M.6).
- **2026-10-23 late evening** (Haiku then Opus): Haiku wrongly told the owner plans 3.20/3.21 were missing (it read the M.5 branch, not `main`); corrected. Answered 3.21's two conflicts with plan Amendment 1. Wrote plans M.7 (A1 now, A2/B later, ADR-134) and M.8a (seed data); 3.6b → ADR-133. Merge checks: 3.20 and 3.21. Pushed main `c333375`.
- **2026-10-23 evening** (Opus): answered the M.5 agent (removed the unreachable threshold branch myself, CI green). Wrote plans 3.20 (fonts, T3) and 3.21 (accounting currency, T2); gave prompts for M.5 Part B, 3.20, 3.21. Pushed main `b616bbf`.
- **2026-10-23 afternoon (2)** (Opus): owner asked why delivery is slow (review round trips, false "done" claims, shared CI breakage, big cards). Built and merged 3.18 (card:check, T1 checklist, nightly CI) and 3.19 (config in jobs). Merged M.5 Part A. Reviews: 3.5a R1 (4 blockers), 3.8 R3 (small). Pushed main `8793398`.
