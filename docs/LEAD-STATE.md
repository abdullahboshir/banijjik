# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.


Last updated: 2026-10-24 (18:15 Dhaka) by Opus 5.5 · `main` = `origin/main` = this state save on top of `c7faadc` (M.7 B merged) (pushed). **The `/lead` skill reads `main:docs/LEAD-STATE.md` from the local ref: run `git fetch origin && git fetch . origin/main:main` first, or read `origin/main`.**

## 1. Where the project stands
- Phase 3: 42 numbered cards. **33 fully merged**: 3.0–3.4b, 3.6, 3.8 (all parts), 3.8a/b/c, 3.12–3.23, 3.25–3.30, **3.35**. Partly done (API merged, screens left): 3.5a (B), 3.6b (B), 3.7 (B), 3.11 (B, C). Running: 3.24 (R2), 3.33 and every Part B. Not started: 3.5b, 3.9, 3.10, 3.31, 3.32, 3.34. Track M: M.0–M.5, M.7 A1 and B, M.8a merged; M.6, M.7 A2 (in review), M.8b, M.9 left. Details: `docs/STATUS.md`.
- **Owner request (2026-10-23):** finish every partly done card and plan everything not started; the owner runs 6–7 sessions (Opus plans and reviews, Sonnet 5.5 codes).
- **Owner (2026-10-24 evening): the lead runs the implementer tools itself** (launch, monitor, restart, answer questions) and may code cards with Sonnet subagents. How: §2a.
- Owner decision (3.24): a stock receipt says how it was paid (CASH/BKASH/NAGAD/BANK) or `ON_CREDIT` (new `ACCOUNTS_PAYABLE`); opening stock → `OPENING_BALANCE`.
- Owner's tools: Claude Code in VS Code is the lead. Implementers now: Qoder CLI and Codex CLI (launched by the lead) and Sonnet subagents. Antigravity is out of quota; Cursor's weekly limit resets about 2026-10-26.
- Note: `npm audit fix --omit=dev` deletes devDependencies from `node_modules`; run `npm install` after it.
- `gh run watch` drops on this PC (TLS timeouts). Poll jobs with `gh run view <id> --json jobs`: the run-level `status` can say "completed" while the `browser` job still runs. DNS to github.com also drops now and then: retry.
- Folders' `@banijjik/contracts` / `validation` `dist` can be stale after switching branches: `npx turbo run build --filter=<pkg>` before local tests. Low RAM: run API tests with `--maxWorkers=1`.
- **The admin browser stack starts only the API, not the worker:** a browser test can never wait for an event handler (written into the 3.7 and 3.11 refreshes).
- Time-dependent tests follow `05-CONVENTIONS.md` "Testing" (3.26). Run date-sensitive suites between 00:00 and 06:00 Dhaka now and then.

## 2. Open branches (checked 2026-10-24 18:15)
Prompts and new logs: `E:/WEB-DEVELOPMENT/PROJECTS/business-platform/lead-orchestra/` (`rules.md` shared rules; `<card>.md` task; `*-continue*.md` restart notes; `<card>*.log`, `<card>.last.md`). Older logs: the a941678b scratchpad `orchestra/` folder. Every final message starts with `STATUS: DONE | QUESTION | BLOCKED`.

**Sonnet session limit hit at about 17:50; it resets 20:40 Dhaka.** The Sonnet rows below were subagents of the 2026-10-24 18:15 lead chat (session a295e696). That chat resumes them with `SendMessage` after 20:40 if it is still open. A new session cannot resume them: relaunch fresh (Codex or a new Sonnet subagent) with the task + continue note + `rules.md`, telling it to read the uncommitted work first.

| Card / part | Branch | Folder | Tier | Who | State → next step |
|---|---|---|---|---|---|
| 3.24 order and stock posting | `s/3.24-api-order-stock-posting` | `banijjik-3.5a` | T1 | Sonnet (stopped at limit) | R1 items all fixed (re-review passed except two items). **R2** (`docs/handoffs/3.24-api-review-R2.md`: stock business date hard-codes `Asia/Dhaka`; race test accepts a double count) being fixed: local head `93d8749b` rebased, not pushed. Next: finish R2, push (`--force-with-lease` allowed), green CI, then the lead checks the two items and merges (owner rule: no new round). |
| M.7 A2 blocks, erasure, export | `s/M.7-api-erasure` | `banijjik-3.6b-a3` | T1 | Sonnet subagent of the **other** chat `banijjik-03` (2026-10-24 evening lead) | T1 review R1 (`docs/handoffs/M.7-api-erasure-review-R1.md`, 3 small items: export of staff-only contact fields, rollback test, block duplicate race). Being fixed; `banijjik-03` reports by message. Next: check the 3 items, merge. |
| 3.7 B enrollment screens | `s/3.7-ui-enrollment` | `banijjik-lead` | T2 | Sonnet (stopped at limit) | `27da5626` "complete enrollment screens…" pushed, CI green; 2 files uncommitted; handoff not finished. Next: finish handoff, card:check, merge check. |
| 3.6b B rental and event screens | `s/3.6b-ui-rental-event` | `banijjik-1.7b` | T2 | Sonnet (stopped at limit) | Codex left it half done (`15628e16`); Sonnet run 3 has 44 files uncommitted (session sheets, selector, calendar). Next: finish (`lead-orchestra/3.6bb-continue2.md`), merge check. |
| 3.5a B order screens | `s/3.5a-ui-orders` | `banijjik-m2` | T2 | Sonnet (stopped at limit) | `5389a45a` (Amendment 1 API) local only + screen work uncommitted. Next: finish, merge check. |
| 3.11 B commission screens | `s/3.11-ui-commission` | `banijjik-3.11` | T2 | Codex (log `3.11b-codex2.log`) | Run 2 stopped on lint (oversized components); run 3 relaunched 18:10 with `3.11b-lint.md`. Merge check on DONE. |
| 3.33 event sessions occupy resources | `s/3.33-api-session-resources` | `banijjik` | T1 | Codex (log `3.33-codex.log`) | Launched 18:12 from `c7faadc`. Strict T1 review on DONE. The folder holds the owner's `.claude/settings.json` change (Codex allow rule): never commit or revert it. |

**Codex launches:** even with the allow rule, the `"$(cat …)"` form goes to the classifier. It passes once the owner says in the chat that the lead may run Codex with full access (owner did on 2026-10-24 18:00: "full access diyechi"). Codex (low effort) stops early: on lint ("BLOCKED"), on "waiting for CI", or with plan items written as "known gaps". Each restart needs a note that names exactly what is missing.

### 2a. Launching implementers (owner approved, 2026-10-24)
- **Qoder:** out of credits since 2026-10-24 evening.
- **Codex:** allow rule `Bash(codex exec:*)` in `banijjik/.claude/settings.json` (uncommitted; an agent once reverted it). Use exactly `codex exec -C <folder> -s danger-full-access -o <last.md> "$(cat <files…>)" < /dev/null > <log> 2>&1` (Bash, background); no extra `-c` option, no `cd … &&` prefix. `codex exec resume` fails while the thread is open in the Codex app. Default reasoning effort is low: review its work closely.
- **Antigravity CLI** cannot run commands headless on this account: IDE only.
- **Sonnet subagents:** Agent tool, `model: "sonnet"`, background, in a real folder with `node_modules`. Give force-with-lease permission for the card branch in the prompt (rebases of pushed commits).
- Always close stdin (`< /dev/null`). `TaskStop` does not kill Windows child processes: stop leftover `codex.exe` PIDs too. Free RAM was 1.9–2.3 GB with six agents.

Merged and safe to delete (local and `origin`): `s/M.8a-matrimony-templates`, `s/3.27-api-enrollment-payments`, the 3.28–3.30 card branches, `s/3.35-stable-replay-test`, `s/M.7-ui-reports`, every `s/merge-*` and `s/docs-*` branch. **`s/merge-3.29` (on origin) is broken**: delete it. PR #2 (3.8) can be closed.

Folders: all busy as in the table (the 3.35 worktree is removed). `banijjik-docs` is the docs and merge folder; `banijjik-m8a` is free (no `node_modules`). Disk E: about 8.9 GB free after deleting `manoxen/.turbo` (owner OK): new worktrees with `npm install` are possible again.

**Agents claim "done" early.** Verify every DONE: `npm run card:check` in the folder, `origin/<branch>`, `gh run view <run> --json jobs`. A FAIL only on "rebased" when main moved by docs commits is fine.

**Parallel branches that bump count tests** (permission keys, audit actions, menu entries) fail CI together after merging: run the `packages/contracts` tests after each rebase.

Stash `stash@{5}` ("owner-edits-AGENTS-and-05-CONVENTIONS") holds the owner's edits; nobody may pop or drop it.

## 3. Waiting on the owner
- Keep both lead tabs open until their agents finish: `banijjik-03` (M.7 A2 finisher) and the 18:15 chat (Sonnet rows; resumes after 20:40).
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions.

## 4. Next actions, in order
1. Verify every §2 row (git, CI, `*.last.md`). After 20:40 resume or relaunch the four Sonnet rows; relaunch Codex rows that stop early with an exact note; answer `STATUS: QUESTION` rows (ask the owner only for product decisions).
2. As rows finish: check the 3.24 R2 items and the M.7 A2 R1 items and merge; merge checks for 3.7 B, 3.6b B, 3.5a B, 3.11 B; strict T1 review of 3.33. Merge one by one through `s/merge-<card>` branches (cherry-pick only the non-merge commits).
3. **Ready to release when a folder frees up:** 3.34 (T1, plan ready, after 3.24 merges).
4. **Plan M.6** (storefront app): ADR-010, ADR-031, `06 §8`, `13-UX`, `routes/storefront.ts`, `contact/presentation/customer-cookies.ts`, CORS in `app.ts`. Open: host → organization, customer cookies across hosts. M.6a T1, M.6b T2. The M.7 A2 erase and export endpoints need M.6 pages.
5. After 3.24 merges: plan 3.31 and 3.32. After 3.5a B and 3.24: 3.11 C, 3.5b, 3.9 POS. Then M.8b, M.9, 3.10 and the phase 3 review.
6. Follow-ups:
   - Refund dialog has no client-side maximum (3.30); a small T3 card if wanted.
   - Replayer safety across several worker processes (STATUS 3.16).
   - Supplier payments clearing `ACCOUNTS_PAYABLE` (after 3.24).
   - 3.33 STATUS note: bookings and sessions do not see enrollment `ResourceExclusiveHold` rows; time-off creation does not check existing bookings.
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
- **2026-10-24 18:15** (Opus, took over while `banijjik-03` still ran its children; agreed by message that this chat owns main and LEAD-STATE): merged 3.35 (`b080b0f`) and M.7 B (`c7faadc`); T1 review R1 of M.7 A2 (`b9841bf`, 3 items); 3.24 re-review → R2 (`8adeda3`, 2 items). Codex had left 3.7 B and 3.6b B half done: relaunched them, 3.5a B and 3.24 R2 as Sonnet (all stopped at the Sonnet limit, resets 20:40). Launched Codex on 3.11 B (lint rerun) and 3.33.
- **2026-10-24 evening** (Opus): owner asked the lead to run the tools itself. Mapped every tool to its card from its logs; launched Qoder (3.5a B, 3.11 B, 3.24 fixes), Codex CLI (3.6b B, 3.7 B, after the owner's allow rule) and Sonnet (M.7 A2 finish, M.7 B, 3.35). Plan 3.5a Amendment 1 (`b47fafd`); 3.24 T1 review R1, changes requested (`247f4d4`). Freed 7.3 GB of disk. Handed over to a new session.
- **2026-10-24 late afternoon** (Opus): verified the seven sessions (none done; 3.24 CI red, still working; 3.6b B and M.7 B not started). Planned 3.33 event sessions occupy their resources (T1, ADR-141, `8eaadea`).
- **2026-10-24 afternoon** (Opus): merge check of M.8a passed and merged (`d06e36a`); T1 review R1 of 3.27 passed, the lead fixed the stale period version after a sync, merged (`5ebe469`). Refreshed and released the screen parts 3.5a B, 3.6b B, 3.7 B, 3.11 B, plus M.7 A2 (T1) and M.7 B; new ready board (`8e729ae`). Owner decided the reversal-after-close question (standard plus option): planned 3.34 (ADR-140) and 3.35 (flaky replay test).
- **2026-10-24 midday** (Opus): T1 review and merge of 3.23 and merge check of 3.26 (`cecb5a0`); another lead chat was turned off by the owner. Planned 3.27 (enrollment payments, ADR-139), refreshed 3.24, planned and ran 3.28–3.30 with Sonnet subagents (owner request), merged all three (`67848d6`). Checked M.8a content; gave 3.24, 3.27 and M.8a prompts.
