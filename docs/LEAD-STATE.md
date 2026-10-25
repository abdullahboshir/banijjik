# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.


Last updated: 2026-10-25 (07:45 Dhaka) by Opus 5.5 · `main` = `origin/main` = this state save on top of `09b0921` (3.31 merged) (pushed). **The `/lead` skill reads `main:docs/LEAD-STATE.md` from the local ref: run `git fetch origin && git fetch . origin/main:main` first, or read `origin/main`.**

## 1. Where the project stands
- Phase 3: 42 numbered cards. **41 fully merged**: 3.0–3.8 (all parts), 3.8a/b/c, 3.11 (all parts), 3.12–3.31, 3.33–3.35. Running: 3.5b A1, 3.36 (lead test card). Planned: 3.32 (needs a refresh after 3.31), 3.5b A2/B, 3.9 (plan `docs/plans/3.9.md`, A1 ready). Last: 3.10. Track M: M.0–M.5, M.6a, M.7, M.8a merged; M.6b running; M.6c, M.8b, M.9 left. Details: `docs/STATUS.md`.
- **Owner request (2026-10-23):** finish every partly done card and plan everything not started; the owner runs 6–7 sessions (Opus plans and reviews, Sonnet 5.5 codes).
- **Owner (2026-10-24 evening): the lead runs the implementer tools itself** (launch, monitor, restart, answer questions) and may code cards with Sonnet subagents. How: §2a.
- **Owner (2026-10-24 21:00): the Sonnet limit is used up (resets 00:00 Dhaka); the lead codes with Haiku subagents and monitors them closely** (check their folders while they run, review every DONE fully, never trust the report).
- Owner decision (3.24): a stock receipt says how it was paid (CASH/BKASH/NAGAD/BANK) or `ON_CREDIT` (new `ACCOUNTS_PAYABLE`); opening stock → `OPENING_BALANCE`.
- Owner's tools: Claude Code in VS Code is the lead. Implementers now: Qoder CLI and Codex CLI (launched by the lead) and Sonnet subagents. Antigravity is out of quota; Cursor's weekly limit resets about 2026-10-26.
- Note: `npm audit fix --omit=dev` deletes devDependencies from `node_modules`; run `npm install` after it.
- `gh run watch` drops on this PC (TLS timeouts). Poll jobs with `gh run view <id> --json jobs`: the run-level `status` can say "completed" while the `browser` job still runs. DNS to github.com also drops now and then: retry.
- Folders' `@banijjik/contracts` / `validation` `dist` can be stale after switching branches: `npx turbo run build --filter=<pkg>` before local tests. Low RAM: run API tests with `--maxWorkers=1`.
- **The admin browser stack starts only the API, not the worker:** a browser test can never wait for an event handler (written into the 3.7 and 3.11 refreshes).
- Time-dependent tests follow `05-CONVENTIONS.md` "Testing" (3.26). Run date-sensitive suites between 00:00 and 06:00 Dhaka now and then.

## 2. Open branches (checked 2026-10-25 07:45)
Prompts and new logs: `E:/WEB-DEVELOPMENT/PROJECTS/business-platform/lead-orchestra/` (`rules.md` shared rules; `<card>.md` task; `*-continue*.md` restart notes; `<card>*.log`, `<card>.last.md`). Older logs: the a941678b scratchpad `orchestra/` folder. Every final message starts with `STATUS: DONE | QUESTION | BLOCKED`.

**No implementer is running** (the banijjik-4d chat ended; its Haiku agents stopped on a usage limit). Relaunch each row fresh with `rules.md` + the named note, telling it to read the work on disk first. Never commit or revert `.claude/settings.json` in `banijjik`. Haiku stops early (context, "waiting for CI"): give every restart a continue note naming exactly what is left; take over CI waits, links and `card:check` yourself when it keeps stopping.

| Card / part | Branch | Folder | Tier | State → next step |
|---|---|---|---|---|
| 3.5b A1 sales returns | `s/3.5b-api-returns` (pushed `02ad402d`, clean) | `banijjik-m2` | T1 | Plan Amendments 1–2 on the branch. Done: contracts, domain amounts and settlement, `returnStock` `costFrom`, refund approval snapshot (internal only; HTTP schema strict), create/preview/list/get, accounting handler, commission per returned line, API tests (`67b4442d`), handoff, ADR-145, ADR-135 note, label fixes. **Left:** green CI on every job, STATUS row, `card:check`. Next: relaunch (`lead-orchestra/3.5b-a1-task.md` + a continue note) or finish yourself; then **full strict T1 review** (decision 5 money, decision 7 cost, the race test, the 3.11 C test rewrites). |
| M.6b storefront app | `s/M.6b-ui-storefront` (pushed `a708acb7`) | `banijjik-1.7b` | T2 (proxy + middleware as T1) | The storefront browser suite **failed to start** in CI 40132207997 ("the storefront did not become ready in time", `storefront-stack.ts:58`) and the step hung 23 min. A fix run (`lead-orchestra/M.6b-continue.md`) pushed `a708acb7`; its CI 40134860010: verify green, **browser failed** (not read yet). Next: read that failure, finish per `M.6b-continue.md`, then the strict proxy review. Amendment 1 (forward the client address chain; `docs/ops/storefront-deployment.md`: `TRUSTED_PROXY_HOPS` must count the storefront hop) is on the branch. |
| 3.36 stable enrollment browser test | `s/3.36-stable-enrollment-browser-test` (pushed `46f2edc6`, from `49920df`) | `banijjik-3.11` | T3 (lead) | The test now reloads the detail page after the payment and explains a missing badge. CI 40134514743 still failed, **and the explanation shows an app bug, not a test race**: after reload, period 1 still shows "অপরিশোধিত" (unpaid) although the payment dialog succeeded, and Activate answers "অন্য কেউ এটি বদলেছেন" (409 conflict). Pre-3.31 code (the branch is before 3.31). Next: find why a fresh page sees the period unpaid and why Activate gets 409 (3.27 decision 6 "Activate syncs the paid period itself": check which version the sync saves and whether reads run in the transaction session); fix in the app (T2 card scope), keep the test change. 3.31 (now on main) also writes the period during activation: check it is not worse. |

**Codex launches:** even with the allow rule, the `"$(cat …)"` form goes to the classifier. It passes once the owner says in the chat that the lead may run Codex with full access (owner did on 2026-10-24 18:00: "full access diyechi"). Codex (low effort) stops early: on lint ("BLOCKED"), on "waiting for CI", or with plan items written as "known gaps". Each restart needs a note that names exactly what is missing.

### 2a. Launching implementers (owner approved, 2026-10-24)
- **Qoder:** out of credits since 2026-10-24 evening.
- **Codex:** allow rule `Bash(codex exec:*)` in `banijjik/.claude/settings.json` (uncommitted; an agent once reverted it). Use exactly `codex exec -C <folder> -s danger-full-access -o <last.md> "$(cat <files…>)" < /dev/null > <log> 2>&1` (Bash, background); no extra `-c` option, no `cd … &&` prefix. `codex exec resume` fails while the thread is open in the Codex app. Default reasoning effort is low: review its work closely.
- **Antigravity CLI** cannot run commands headless on this account: IDE only.
- **Sonnet / Haiku subagents:** Agent tool, `model: "sonnet"` (or `"haiku"` while Sonnet is out), background, in a real folder with `node_modules`. Give force-with-lease permission for the card branch in the prompt (rebases of pushed commits).
- Always close stdin (`< /dev/null`). `TaskStop` does not kill Windows child processes: stop leftover `codex.exe` PIDs too. Free RAM was 1.9–2.3 GB with six agents.

Merged and safe to delete (local and `origin`): `s/M.8a-matrimony-templates`, `s/3.27-api-enrollment-payments`, the 3.28–3.30 card branches, `s/3.35-stable-replay-test`, `s/M.7-ui-reports`, `s/M.7-api-erasure`, `s/3.24-api-order-stock-posting`, `s/3.7-ui-enrollment`, `s/3.33-api-session-resources`, `s/3.6b-ui-rental-event`, `s/3.11-ui-commission`, `s/3.5a-ui-orders`, `s/3.34-api-reversal-after-close`, `s/M.6a-api-storefront-reads`, `s/3.11-api-order-lines`, `s/3.31-api-enrollment-revenue`, every `s/merge-*` and `s/docs-*` branch. **`s/merge-3.29` (on origin) is broken**: delete it. PR #2 (3.8) can be closed.

Folders: `banijjik-m2`, `banijjik-1.7b`, `banijjik-3.11` hold the table's branches. **Free with `node_modules`:** `banijjik-3.5a` (on the merged 3.31 branch), `banijjik` (on the merged 3.33 branch), `banijjik-lead`, `banijjik-3.6b-a3`; switch to a new branch from main first. Free RAM was 1.6 GB with three agents: run at most three. `banijjik-docs` is the docs and merge folder; `banijjik-m8a` is free (no `node_modules`). Disk E: about 8.9 GB free after deleting `manoxen/.turbo` (owner OK): new worktrees with `npm install` are possible again.

**Agents claim "done" early.** Verify every DONE: `npm run card:check` in the folder, `origin/<branch>`, `gh run view <run> --json jobs`. A FAIL only on "rebased" when main moved by docs commits is fine.

**Parallel branches that bump count tests** (permission keys, audit actions, menu entries) fail CI together after merging: run the `packages/contracts` tests after each rebase.

Stash `stash@{5}` ("owner-edits-AGENTS-and-05-CONVENTIONS") holds the owner's edits; nobody may pop or drop it.

## 3. Waiting on the owner
- Delete the empty folder `E:/tmp-unused` (an agent created it by mistake; the safety check refused the agent's delete).
- **Product decisions open:** 3.9 offline selling (default in the plan: online only at launch); 3.5b decision 10 changes merged commission behaviour (commission drops only for returned lines; a refund without a return keeps it) — the owner was told, no answer yet; M.6 listing pages are all `noindex` until a template switch is decided.
- The older lead chats (`banijjik-0b`, `banijjik-03`, `banijjik-54`, `banijjik-c1`, `banijjik-4d`) are idle and can be closed.
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions.

## 4. Next actions, in order
1. **3.36 first:** the enrollment activate-after-payment bug (§2 row) blocks every branch's browser job now and then (≥ 6 failures; rerun passes). Fix it in the app before more merges.
2. Finish the §2 rows (relaunch with notes, or finish CI/links/`card:check` yourself), then strict T1 review of 3.5b A1 and the M.6b proxy review. Stack branches so CI runs at once; **never push docs to `main` while a stacked branch's CI runs**.
3. Release **3.9 A1** (T1, plan ready, a free folder) when RAM allows; **refresh and release 3.32** (3.31 is merged: its plan predates 3.31's amendments); after 3.5b A1 → 3.5b A2; after M.6b → M.6c.
4. Then 3.9 A2/B, 3.5b B, M.8b, M.9, 3.10 and the phase 3 review.
5. Follow-ups:
   - 3.31 review note: two process-spawning API tests (`main.test.ts` worker start, `sync-indexes.test.ts`) timed out once in CI 40131011005; watch them.
   - M.6a review follow-ups (`docs/handoffs/M.6a-api-review-R1.md`: stale stats race, option keys with `.`/`$`, ungated directory storefront routes, erasure event for stats).
   - 3.5a B: `placeOrder` makes a new idempotency key per call, so a retry after a lost response shows a conflict instead of the replayed success (no duplicate: place is a state change).
   - `order.controller.ts` `list` uses `as unknown as` for its query (pre-existing, seen in 3.11 C).
   - Refund dialog has no client-side maximum (3.30); a small T3 card if wanted.
   - Replayer safety across several worker processes (STATUS 3.16).
   - Supplier payments clearing `ACCOUNTS_PAYABLE` (after 3.24).
   - 3.33 STATUS note: bookings and sessions do not see enrollment `ResourceExclusiveHold` rows; time-off creation does not check existing bookings or sessions; **the time-off POST endpoint answers 500 (audit outside a transaction)**: a bug, worth a small card soon.
   - Two patterns for client text in admin screens: label props via `screen-text.tsx` (3.6b B) and a nested `I18nProvider` per route layout (3.11 B, `commission-client-text.tsx`). Pick one in `05-CONVENTIONS.md`.
   - Flaky API test `ordered-event-worker.test.ts` › "runs a replayed event again with fresh attempts…" (15.9 s, failed once on 3.11 B, CI 40100273547).
   - 3.23 review follow-ups (`docs/handoffs/3.23-api-review-R1.md`).
   - Flaky admin browser test `auth-flow.browser.test.ts` › "shows how long to wait, read from the Retry-After header of the API" (30 s timeout, CI 40089936122).
   - M.7 B: the report detail needs `directory.listing.read` as well; grant both in moderating roles. No browser test for hide/block outcomes.

## 5. How the lead works
- **Role:** plans (just in time), strict T1 reviews, merge checks, integration, fast-forward of `main`, and (owner, 2026-10-24) launching, monitoring and restarting the implementer tools (§2a).
- **One lead session at a time.** If another lead session messages, agree who owns which branch before touching `main` or `banijjik-docs`.
- **Language:** reply to the owner in Bengali script; code, comments and docs in English.
- **Review:** read the diff against the plan and `AGENTS.md`; try to break T1 security, money, stock and concurrency rules; require a green CI run on the branch head. Never accept an implementer's report as proof. Review findings go in `docs/handoffs/<card>-review-R<n>.md` and the owner pastes them to the session.
- **Integration habits:** Cursor branches tend to refactor `routes/v1.ts` and the router builders. Keep the 3.8c layout (`routes/core-tenant-routers.ts`, `routes/tenant-module-routers.ts`, `routes/iam-tenant-router.ts`). i18n catalog end-of-file conflicts: keep both sides joined by a comma. Keep `\\.` escaping in `eslint/restrictions.mjs`. To merge several branches or one whose base is behind, build `s/merge-<card>` in `banijjik-docs` (`git switch -c s/merge-<card> main`, `git cherry-pick <base>..<branch>`), push it, wait for green CI, fast-forward `main` to it. Merge branches can be stacked (`s/merge-B` from `s/merge-A`) so both CI runs go at once; fast-forward `main` in order. A branch already on top of main is fast-forwarded directly (`git push origin <branch>:main`); mark its STATUS row merged on the branch first. There is no `python` on this PC; edit conflicts with the Edit tool. Commit subjects must not be sentence-case (commitlint).
- **Folders:** one agent per folder. `banijjik`, `banijjik-1.7b`, `banijjik-lead`, `banijjik-m2`, `banijjik-3.11`, `banijjik-3.5a` and `banijjik-3.6b-a3` have `node_modules`. `banijjik-docs` is light (its `node_modules` is a junction to `banijjik`'s: hooks and prettier only). Subagent worktrees live under `banijjik/.claude/worktrees/`; remove them with `git worktree remove` after the merge.
- **Docs commits:** in `banijjik-docs`, `git switch -c s/docs-<slug> main`, commit, then from any folder `git fetch . s/docs-<slug>:main` (fast-forward only).
- **Local verify:** environment `MONGOMS_SYSTEM_BINARY="C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe" MONGOMS_VERSION_CHECK=false TEST_REDIS_URL=redis://127.0.0.1:6380 NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 NEXT_PUBLIC_BRAND_NAME=Example CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"`. Single API test files: `npx vitest run --config src/test-support/vitest.config.ts <files>` in `apps/api` (without the config the test databases are missing). Full: `npm run lint`, `npm run format:check`, `VITEST_MAX_WORKERS=2 npx turbo run build typecheck test --force --env-mode=loose --concurrency=1 --continue`, and the browser suites with `VITEST_MAX_WORKERS=1 npm run test:browser` in `apps/admin` and `apps/platform`. Move `apps/api/.env` aside during the run (it exists only in `banijjik`) and put it back. Docker (`infra/docker-compose.yml`: Mongo 27018, Redis 6380) may need starting after a reboot; never touch other containers.
- **Finish gate and leftovers (owner, 2026-10-23):** a review starts only from a `card:check` output with every line PASS. When a re-review leaves at most three small items, the lead fixes them on the branch and merges instead of starting another round.
- **Pushing `main`:** the owner allowed it for green-CI merges (2026-10-23 night) and confirmed it again on 2026-10-24 afternoon ("verify kore push koro") and 18:00 ("full access diyechi … ja ja kora lage koro"). Confirm at the start of a new session that this still holds.
- **Never:** `--no-verify`, resetting existing commits, committing `.env` files, printing env values.
- **Shell pipelines hide failures:** `git cherry-pick ... | tail` returns tail's exit code, so a conflict does not stop a `&&` chain (it pushed `s/merge-3.29` with conflict markers). Never pipe a git command whose failure must stop the chain.
- **Token cost:** keep sessions short: one task, then `/save-state`, then a new session with `/lead`.

## 6. Session log (last five)
- **2026-10-25 03:00–07:45** (Opus, banijjik-4d, Haiku implementers): T1 review and merge of 3.31 (`09b0921`, no code change; Amendments 1–2 from the implementer's questions). Planned 3.5b (ADR-145, `852f473`) and 3.9 POS (ADR-146, `49920df`); answered 3.5b A1 Amendments 1–2 and M.6b Amendment 1 (client address forwarding). Took over CI waits from stalling Haiku agents. Started lead card 3.36 (enrollment browser flake → turned out to be an app bug, see §2).
- **2026-10-24 21:45 – 2026-10-25 03:00** (Opus, banijjik-4d, Haiku implementers): merged 3.5a B (`f5dfd17`), 3.34 after T1 R1 (lead fixed: refund re-check inside the reversal, one currency per bad-debt journal; `2850cd6`), M.6a after T1 R1 (`f9311d8`) and 3.11 C (`dd143a5`). Planned M.6 in three parts (ADR-144), refreshed 3.11 C (`26f9981`) and 3.31 (`5f31963`); answered 3.31's two plan gaps as Amendments 1–2. Stopped one weakened test in M.6a and an `as unknown as` cast in 3.11 C while they ran.
- **2026-10-24 20:53–21:45** (Opus, banijjik-4d; banijjik-0b handed over by message): T1 review R1 of 3.33 (lead fixed: legacy session rows without `resourceHolds` crashed cancel; import order; magic number) and merge checks of 3.6b B and 3.11 B; stacked the three and merged (`ccceb52`, `357dbe2`, `8e0f636`). Sonnet out of credit: relaunched 3.34 and the 3.5a B finish as Haiku subagents. Read the M.6 inputs (notes in §4).
- **2026-10-24 19:50** (Opus): resumed Sonnet at 19:10; merged 3.7 B (`5541586`) and 3.24 after R2 (`65415ef`); refreshed and launched 3.34.
- **2026-10-24 18:15–18:45** (Opus, took over while `banijjik-03` still ran its children; agreed by message that this chat owns main and LEAD-STATE): merged 3.35 (`b080b0f`), M.7 B (`c7faadc`) and M.7 A2 after T1 review R1 (`96f1954`); 3.24 re-review → R2 (`8adeda3`, 2 items). Codex had left 3.7 B and 3.6b B half done: relaunched them, 3.5a B and 3.24 R2 as Sonnet (all stopped at the Sonnet limit, resets 20:40). Codex ran 3.11 B three times (lint never fixed) and 3.33 three times (code done, tests unusable): both wait for Sonnet.
