# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.


Last updated: 2026-10-25 (08:40 Dhaka) by Opus 5.5 · `main` = `origin/main` = this state save on top of `dd51581` (3.5b A1 merged) (pushed). **The `/lead` skill reads `main:docs/LEAD-STATE.md` from the local ref: run `git fetch origin && git fetch . origin/main:main` first, or read `origin/main`.**

## 1. Where the project stands
- Phase 3: 42 numbered cards. **Merged:** 3.0–3.8 (all parts), 3.8a/b/c, 3.11 (all parts), 3.12–3.31, 3.33–3.36, **3.5b A1**. Running: 3.9 A1 (Sonnet subagent). Planned: 3.32 (needs a refresh after 3.31), 3.5b A2/B (A2 needs a refresh against the merged A1 code), 3.9 A2/B. Last: 3.10. Track M: M.0–M.5, M.6a, M.7, M.8a merged; M.6b in CI (the lead is finishing it); M.6c, M.8b, M.9 left. Details: `docs/STATUS.md`.
- **Owner request (2026-10-23):** finish every partly done card and plan everything not started; Opus plans and reviews, Sonnet codes.
- **Owner (2026-10-24): the lead runs the implementer tools itself** (launch, monitor, restart, answer questions) and may code cards with Sonnet subagents. How: §2a. Sonnet is available again (its limit reset at 00:00 Dhaka).
- **Owner (2026-10-25 08:10, asked again and confirmed): the lead fast-forwards and pushes `main` after green CI.**
- Owner decision (3.24): a stock receipt says how it was paid (CASH/BKASH/NAGAD/BANK) or `ON_CREDIT` (new `ACCOUNTS_PAYABLE`); opening stock → `OPENING_BALANCE`.
- Note: `npm audit fix --omit=dev` deletes devDependencies from `node_modules`; run `npm install` after it.
- `gh run watch` drops on this PC (TLS timeouts). Poll jobs with `gh run view <id> --json jobs`. `gh run view --log-failed` is empty while any job still runs: read one job with `gh api repos/abdullahboshir/banijjik/actions/jobs/<jobId>/logs`.
- `dist` folders go stale after switching branches or rebasing (`@banijjik/contracts`, `validation`, `i18n`, and `apps/api/dist` for browser suites): `npx turbo run build --filter=<pkg>` before local tests. A stale API build gave false 404s in the storefront suite. Low RAM: API tests with `--maxWorkers=1`.
- **The admin and storefront browser stacks start the API and the worker** (since 3.24): event handlers run in the background. A test waits for their result (reload or poll with a deadline) and never races them with a click (3.36: Activate after a payment got a correct 409 because the worker had activated first).
- Time-dependent tests follow `05-CONVENTIONS.md` "Testing" (3.26). Run date-sensitive suites between 00:00 and 06:00 Dhaka now and then.

## 2. Open branches (checked 2026-10-25 08:40)
Prompts and logs: `E:/WEB-DEVELOPMENT/PROJECTS/business-platform/lead-orchestra/` (`rules.md` shared rules; `<card>-task.md`; `*-continue*.md` restart notes). Every final message starts with `STATUS: DONE | QUESTION | BLOCKED`. Never commit or revert `.claude/settings.json` in `banijjik`.

| Card / part | Branch | Folder | Tier | State → next step |
|---|---|---|---|---|
| 3.9 A1 POS API | `s/3.9-api-pos` (the agent creates it from `origin/main`) | `banijjik-3.5a` | T1 | **Sonnet subagent running** since 08:05 (prompt `rules.md` + `3.9-a1-task.md`; it may force-with-lease its own branch). If this chat has ended, the agent is gone: read the folder and `origin/s/3.9-api-pos`, then relaunch with a continue note that names what is left. On DONE: rerun `card:check`, then the **strict T1 review** (the order and its payments in one transaction, sessions and Z-report money). 3.5b A1 merged meanwhile, so contracts count tests change after its rebase (the agent was told). |
| M.6b storefront app | `s/M.6b-ui-storefront` (pushed `afbd5113`, base `fb9639f`) | `banijjik-1.7b` | T2 (proxy + middleware as T1) | The lead fixed the browser suite setup: reserved slug `shop` → `rahim-bibaho`; publish the MATRIMONY template; grant the OPTIONAL directory module in the DB; wait for the OTP SMS with a `sentAfter` time (the suite signs in the same phone twice); a GEO_BD sample value; lower-case brand colour. Local run: 6 of 8 pass; the 2 left (`answers an unknown host…`, `keeps the initial JavaScript…`) fail only on Windows, where Node cannot resolve `*.sites.localhost`. **Next:** read CI on `afbd5113` (Linux should resolve it); if they fail there too, fetch through `127.0.0.1` with a Host header. Then rebase on main, CI link and measured route sizes into `docs/handoffs/M.6b-ui.md`, the M.6 STATUS row, `card:check`, the strict proxy review (Amendment 1: forwarded client address chain, `TRUSTED_PROXY_HOPS`), merge. |

### 2a. Launching implementers (owner approved, 2026-10-24)
- **Qoder:** out of credits since 2026-10-24 evening.
- **Codex:** allow rule `Bash(codex exec:*)` in `banijjik/.claude/settings.json` (uncommitted; an agent once reverted it). Use exactly `codex exec -C <folder> -s danger-full-access -o <last.md> "$(cat <files…>)" < /dev/null > <log> 2>&1` (Bash, background); no extra `-c` option, no `cd … &&` prefix. It needs the owner's "full access" OK in the chat. Codex (low effort) stops early: each restart needs a note naming exactly what is missing.
- **Antigravity CLI** cannot run commands headless on this account: IDE only.
- **Sonnet / Haiku subagents:** Agent tool, `model: "sonnet"` (or `"haiku"` while Sonnet is out), background, in a real folder with `node_modules`. Give force-with-lease permission for the card branch in the prompt (rebases of pushed commits).
- Always close stdin (`< /dev/null`). `TaskStop` does not kill Windows child processes: stop leftover `codex.exe` PIDs too.

Merged and safe to delete (local and `origin`): `s/3.36-stable-enrollment-browser-test`, `s/3.5b-api-returns`, `s/M.8a-matrimony-templates`, `s/3.27-api-enrollment-payments`, the 3.28–3.30 card branches, `s/3.35-stable-replay-test`, `s/M.7-ui-reports`, `s/M.7-api-erasure`, `s/3.24-api-order-stock-posting`, `s/3.7-ui-enrollment`, `s/3.33-api-session-resources`, `s/3.6b-ui-rental-event`, `s/3.11-ui-commission`, `s/3.5a-ui-orders`, `s/3.34-api-reversal-after-close`, `s/M.6a-api-storefront-reads`, `s/3.11-api-order-lines`, `s/3.31-api-enrollment-revenue`, every `s/merge-*` and `s/docs-*` branch. **`s/merge-3.29` (on origin) is broken**: delete it. PR #2 (3.8) can be closed.

Folders: `banijjik-3.5a` holds 3.9 A1, `banijjik-1.7b` holds M.6b. **Free with `node_modules`:** `banijjik-m2` (merged 3.5b A1 branch), `banijjik-3.11` (merged 3.36 branch), `banijjik` (merged 3.33 branch), `banijjik-lead`, `banijjik-3.6b-a3`; switch to a new branch from main first. Free RAM was about 1.7 GB with one agent: run at most two or three. `banijjik-docs` is the docs and merge folder; `banijjik-m8a` is free (no `node_modules`). Disk E: about 8.9 GB free.

**Agents claim "done" early.** Verify every DONE: `npm run card:check` in the folder, `origin/<branch>`, `gh run view <run> --json jobs`. A FAIL only on "rebased" when main moved by docs commits is fine.

**Parallel branches that bump count tests** (permission keys, audit actions, menu entries) fail CI together after merging: run the `packages/contracts` tests after each rebase.

Stash `stash@{5}` ("owner-edits-AGENTS-and-05-CONVENTIONS") holds the owner's edits; nobody may pop or drop it.

## 3. Waiting on the owner
- **3.5b decision 10 (now merged):** a refund without a return no longer lowers order-line commission; only returned units do. A ledger already lowered by a refund is raised back to its return-based target on the next return of that order (test data only before launch). Say if this should change (it would be a new card).
- **Other product decisions open:** 3.9 offline selling (default in the plan: online only at launch); M.6 listing pages are all `noindex` until a template switch is decided.
- Delete the empty folder `E:/tmp-unused`. Close the idle older lead chats (`banijjik-0b`, `-03`, `-54`, `-c1`, `-4d`).
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions.

## 4. Next actions, in order
1. **M.6b:** finish per the §2 row, then the strict proxy review and merge.
2. **3.9 A1:** watch the agent; on DONE verify and do the strict T1 review.
3. **Refresh 3.5b A2** against the merged A1 code (reverse, exchange; `docs/plans/3.5b.md` §A2) and release it; **refresh and release 3.32** (its plan predates 3.31's amendments); after M.6b → M.6c.
4. Then 3.9 A2/B, 3.5b B, M.8b, M.9, 3.10 and the phase 3 review.
5. Follow-ups:
   - **New bug (small card):** the directory's `SubmitMyListingUseCase` lets a ZodError escape when a required custom field is missing: the storefront answers 500 instead of 422 (seen in the M.6b suite with `permanent_address` missing).
   - `sync-indexes.test.ts` (spawns processes) timed out on `main` CI 40151387531, the second time after CI 40131011005 (a rerun passed). Give it more time or a small card.
   - 3.5b A1 review follow-ups (`docs/handoffs/3.5b-api-review-R1.md`): `as unknown as` in every accounting event handler; payment's `PaymentApprovalSnapshot.approverUserId` holds a member id.
   - M.6a review follow-ups (`docs/handoffs/M.6a-api-review-R1.md`: stale stats race, option keys with `.`/`$`, ungated directory storefront routes, erasure event for stats).
   - 3.5a B: `placeOrder` makes a new idempotency key per call, so a retry after a lost response shows a conflict instead of the replayed success.
   - `order.controller.ts` `list` uses `as unknown as` for its query (pre-existing). Refund dialog has no client-side maximum (3.30).
   - Replayer safety across several worker processes (STATUS 3.16). Supplier payments clearing `ACCOUNTS_PAYABLE` (after 3.24).
   - 3.33 STATUS note: bookings and sessions do not see enrollment `ResourceExclusiveHold` rows; time-off creation does not check existing bookings or sessions; **the time-off POST endpoint answers 500 (audit outside a transaction)**: worth a small card soon.
   - Two patterns for client text in admin screens (`screen-text.tsx` label props vs a nested `I18nProvider`): pick one in `05-CONVENTIONS.md`.
   - Flaky: `ordered-event-worker.test.ts` › "runs a replayed event again with fresh attempts…" (CI 40100273547); admin `auth-flow.browser.test.ts` › "shows how long to wait…" (CI 40089936122). 3.23 review follow-ups (`docs/handoffs/3.23-api-review-R1.md`).
   - M.7 B: the report detail needs `directory.listing.read` as well; no browser test for hide/block outcomes.

## 5. How the lead works
- **Role:** plans (just in time), strict T1 reviews, merge checks, integration, fast-forward of `main`, and (owner, 2026-10-24) launching, monitoring and restarting the implementer tools (§2a).
- **One lead session at a time.** If another lead session messages, agree who owns which branch before touching `main` or `banijjik-docs`.
- **Language:** reply to the owner in Bengali script; code, comments and docs in English.
- **Review:** read the diff against the plan and `AGENTS.md`; try to break T1 security, money, stock and concurrency rules; require a green CI run on the branch head. Never accept an implementer's report as proof. Review findings go in `docs/handoffs/<card>-review-R<n>.md` and the owner pastes them to the session.
- **Integration habits:** Cursor branches tend to refactor `routes/v1.ts` and the router builders. Keep the 3.8c layout (`routes/core-tenant-routers.ts`, `routes/tenant-module-routers.ts`, `routes/iam-tenant-router.ts`). i18n catalog end-of-file conflicts: keep both sides joined by a comma. Keep `\\.` escaping in `eslint/restrictions.mjs`. To merge several branches or one whose base is behind, build `s/merge-<card>` in `banijjik-docs` (`git switch -c s/merge-<card> main`, `git cherry-pick <base>..<branch>`), push it, wait for green CI, fast-forward `main` to it. Merge branches can be stacked (`s/merge-B` from `s/merge-A`) so both CI runs go at once; fast-forward `main` in order. A branch already on top of main is fast-forwarded directly (`git push origin <branch>:main`); mark its STATUS row merged on the branch first. There is no `python` on this PC; edit conflicts with the Edit tool. Commit subjects must not be sentence-case and headers stay ≤ 100 characters (commitlint).
- **Folders:** one agent per folder. `banijjik`, `banijjik-1.7b`, `banijjik-lead`, `banijjik-m2`, `banijjik-3.11`, `banijjik-3.5a` and `banijjik-3.6b-a3` have `node_modules`. `banijjik-docs` is light (its `node_modules` is a junction to `banijjik`'s: hooks and prettier only). Subagent worktrees live under `banijjik/.claude/worktrees/`; remove them with `git worktree remove` after the merge.
- **Docs commits:** in `banijjik-docs`, `git switch -c s/docs-<slug> main`, commit, then from any folder `git fetch . s/docs-<slug>:main` (fast-forward only).
- **Local verify:** environment `MONGOMS_SYSTEM_BINARY="C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe" MONGOMS_VERSION_CHECK=false TEST_REDIS_URL=redis://127.0.0.1:6380 NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 NEXT_PUBLIC_BRAND_NAME=Example CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"`. Single API test files: `npx vitest run --config src/test-support/vitest.config.ts <files>` in `apps/api` (without the config the test databases are missing). Full: `npm run lint`, `npm run format:check`, `VITEST_MAX_WORKERS=2 npx turbo run build typecheck test --force --env-mode=loose --concurrency=1 --continue`, and the browser suites with `VITEST_MAX_WORKERS=1 npm run test:browser` in `apps/admin`, `apps/platform` and `apps/storefront`. A browser stack keeps server output in memory only: to see an API error, print `child.stdout` in `startServer` for one local run (do not commit it). Move `apps/api/.env` aside during the run (it exists only in `banijjik`) and put it back. Docker (`infra/docker-compose.yml`: Mongo 27018, Redis 6380) may need starting after a reboot; never touch other containers.
- **Finish gate and leftovers (owner, 2026-10-23):** a review starts only from a `card:check` output with every line PASS. When a re-review leaves at most three small items, the lead fixes them on the branch and merges instead of starting another round.
- **Pushing `main`:** allowed for green-CI merges (owner 2026-10-23, 2026-10-24, and again 2026-10-25 08:10). Confirm at the start of a new session that this still holds.
- **Never:** `--no-verify`, resetting existing commits, committing `.env` files, printing env values.
- **Shell pipelines hide failures:** `git cherry-pick ... | tail` returns tail's exit code, so a conflict does not stop a `&&` chain. Never pipe a git command whose failure must stop the chain; the same for `;` before a push.
- **Token cost:** keep sessions short: one task, then `/save-state`, then a new session with `/lead`.

## 6. Session log (last five)
- **2026-10-25 07:50–08:40** (Opus 5.5, Sonnet implementer): 3.36 root cause: the browser stack runs the worker since 3.24, so a staff Activate after the payment raced it (correct 409); the test now reloads until ACTIVE; merged (`fb9639f`). Rebased 3.5b A1 on 3.31, T1 review R1 (lead fixes: currency compared before settling, dead branch, a 60-line split) and merged (`dd51581`). Launched 3.9 A1 (Sonnet). Took over M.6b and fixed its browser setup step by step (6 of 8 pass locally).
- **2026-10-25 03:00–07:45** (Opus, banijjik-4d, Haiku implementers): T1 review and merge of 3.31 (`09b0921`). Planned 3.5b (ADR-145, `852f473`) and 3.9 POS (ADR-146, `49920df`); answered 3.5b A1 Amendments 1–2 and M.6b Amendment 1. Took over CI waits from stalling Haiku agents. Started lead card 3.36.
- **2026-10-24 21:45 – 2026-10-25 03:00** (Opus, banijjik-4d, Haiku implementers): merged 3.5a B (`f5dfd17`), 3.34 after T1 R1 (`2850cd6`), M.6a after T1 R1 (`f9311d8`) and 3.11 C (`dd143a5`). Planned M.6 in three parts (ADR-144), refreshed 3.11 C and 3.31.
- **2026-10-24 20:53–21:45** (Opus, banijjik-4d): T1 review R1 of 3.33 and merge checks of 3.6b B and 3.11 B; stacked the three and merged (`ccceb52`, `357dbe2`, `8e0f636`). Relaunched 3.34 and the 3.5a B finish as Haiku subagents.
- **2026-10-24 19:50** (Opus): resumed Sonnet at 19:10; merged 3.7 B (`5541586`) and 3.24 after R2 (`65415ef`); refreshed and launched 3.34.
