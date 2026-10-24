# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.


Last updated: 2026-10-24 (evening, Dhaka) by Opus 5.5 · `main` = `origin/main` = this state save on top of `247f4d4` (3.24 review R1) (pushed). **The `/lead` skill reads `main:docs/LEAD-STATE.md` from the local ref: run `git fetch origin && git fetch . origin/main:main` first, or read `origin/main`.**

## 1. Where the project stands
- Phase 3: 42 numbered cards. **32 fully merged**: 3.0–3.4b, 3.6, 3.8 (all parts), 3.8a/b/c, 3.12–3.23, 3.25–3.30. Partly done (API merged, screens left): 3.5a (B), 3.6b (B), 3.7 (B), 3.11 (B, C). Running: 3.24, 3.35 and every Part B. Not started: 3.5b, 3.9, 3.10, 3.31, 3.32, 3.33, 3.34. Track M: M.0–M.5, M.7 A1 and **M.8a** merged; M.6, M.7 A2/B, M.8b, M.9 left. Details: `docs/STATUS.md`.
- **Owner request (2026-10-23):** finish every partly done card and plan everything not started; the owner runs 6–7 sessions (Opus plans and reviews, Sonnet 5.5 codes).
- **Owner (2026-10-24 evening): the lead runs the implementer tools itself** (launch, monitor, restart, answer questions) and may code cards with Sonnet subagents. How: §2a.
- Owner decision (3.24): a stock receipt says how it was paid (CASH/BKASH/NAGAD/BANK) or `ON_CREDIT` (new `ACCOUNTS_PAYABLE`); opening stock → `OPENING_BALANCE`.
- Owner's tools: Claude Code in VS Code is the lead. Implementers now: Qoder CLI and Codex CLI (launched by the lead) and Sonnet subagents. Antigravity is out of quota; Cursor's weekly limit resets about 2026-10-26.
- Note: `npm audit fix --omit=dev` deletes devDependencies from `node_modules`; run `npm install` after it.
- `gh run watch` drops on this PC (TLS timeouts). Poll jobs with `gh run view <id> --json jobs`: the run-level `status` can say "completed" while the `browser` job still runs. DNS to github.com also drops now and then: retry.
- Folders' `@banijjik/contracts` / `validation` `dist` can be stale after switching branches: `npx turbo run build --filter=<pkg>` before local tests. Low RAM: run API tests with `--maxWorkers=1`.
- **The admin browser stack starts only the API, not the worker:** a browser test can never wait for an event handler (written into the 3.7 and 3.11 refreshes).
- Time-dependent tests follow `05-CONVENTIONS.md` "Testing" (3.26). Run date-sensitive suites between 00:00 and 06:00 Dhaka now and then.

## 2. Open branches (checked 2026-10-24 evening)
Every row is running unattended, launched by the lead session of 2026-10-24 evening. Prompts: `E:/WEB-DEVELOPMENT/PROJECTS/business-platform/lead-orchestra/` (`rules.md` is the shared rules block; `<card>.md` the task). Live logs and final messages (`*.log`, `*.last.md`): `C:/Users/ABDULL~1/AppData/Local/Temp/claude/e--WEB-DEVELOPMENT-PROJECTS-business-platform-banijjik/a941678b-72e7-4daf-b00a-c372e0331322/scratchpad/orchestra/`. Every final message starts with `STATUS: DONE | QUESTION | BLOCKED`.

| Card / part | Branch | Folder | Tier | Who | State at handover → next step |
|---|---|---|---|---|---|
| 3.24 order and stock posting | `s/3.24-api-order-stock-posting` | `banijjik-3.5a` | T1 | Qoder (log `3.24-r1-qoder.log`) | Review R1 (`docs/handoffs/3.24-api-review-R1.md`, 9 items) being fixed; **Stopped: Qoder credit limit** after pushing `cd5bb397` (clean tree). Unknown how many R1 items are done and whether the handoff was updated. **Next: check the branch against R1; relaunch the rest with Codex or Sonnet, then re-review only the R1 items.** Allowed to `--force-with-lease` its own branch. |
| M.7 A2 blocks, erasure, export | `s/M.7-api-erasure` | `banijjik-3.6b-a3` | T1 | Sonnet subagent (finishing Antigravity's 5 commits) | 6 commits pushed (`0b00a319`). **Next: strict T1 review** on DONE. |
| 3.5a B order screens | `s/3.5a-ui-orders` | `banijjik-m2` | T2 | Qoder (log `3.5ab.log`) | Plan Refresh 2 + **Amendment 1** (order read returns `manualDiscount`/`orderDiscount`, `b47fafd`). **Stopped: Qoder credit limit** (log ends "credit usage limit"). 1 commit `5389a45a` (API Amendment 1) not pushed, 4 files uncommitted. **Next: relaunch with Codex or Sonnet** using `continue-note.md` + `3.5ab.md` + `rules.md`. |
| 3.11 B commission screens | `s/3.11-ui-commission` | `banijjik-3.11` | T2 | Qoder (log `3.11b-qoder.log`) | **Stopped: Qoder credit limit.** 11 files uncommitted, no commit. **Next: relaunch with Codex or Sonnet** using `continue-note.md` + `3.11b.md` + `rules.md`. |
| 3.6b B rental and event screens | `s/3.6b-ui-rental-event` | `banijjik-1.7b` | T2 | Codex CLI (log `3.6bb.log`) | `02a59d85` pushed after a lint restart. Merge check on DONE. |
| 3.7 B enrollment screens | `s/3.7-ui-enrollment` | `banijjik-lead` | T2 | Codex CLI (log `3.7bb.log`) | `1d6a37d2` pushed after a lint restart. Merge check on DONE. |
| M.7 B report screens | `s/M.7-ui-reports` | `banijjik` | T2 | Sonnet subagent | `aa045975` pushed. Merge check on DONE. |
| 3.35 stable replay test | `s/3.35-stable-replay-test` | worktree `banijjik/.claude/worktrees/agent-afeb7464684b47d3c` | T3 | Sonnet subagent | Running. Merge check; remove the worktree after the merge. |

**The Sonnet subagents and the CLI processes are children of the 2026-10-24 evening lead chat.** Keep that VS Code tab open (idle) until they finish; closing it stops them. A new lead session does not get their notifications: check each row with `git -C <folder> status`, `git log origin/main..HEAD`, `origin/<branch>`, `gh run list --branch <branch>` and the `*.last.md` files. A row that stopped (no process, no new commit for a long time, a `STATUS: BLOCKED/QUESTION` file) is relaunched as §2a says, with `continue-note.md` + the task + `rules.md`.

### 2a. Launching implementers (owner approved, 2026-10-24)
- **Qoder:** out of credits since 2026-10-24 evening (3.24 may stop too). `qodercli -p -w <folder> --permission-mode auto "<task + rules>" < /dev/null > <log> 2>&1` (Bash, background).
- **Codex:** the owner added the allow rule `Bash(codex exec:*)`. Use exactly `codex exec -C <folder> -s danger-full-access -o <last.md> "$(cat <task.md> <rules.md>)" < /dev/null > <log> 2>&1`; an extra `-c` option or a `cd … &&` prefix falls back to the classifier and is denied. `codex exec resume` fails while the thread is open in the Codex app. Default reasoning effort is low: review its work closely.
- **Antigravity CLI** cannot run commands headless on this account (allow rules in `~/.gemini/antigravity-cli/settings.json` are ignored for unsandboxed commands): IDE only.
- **Sonnet subagents:** Agent tool, `model: "sonnet"`, background; a real folder with `node_modules`, or `isolation: "worktree"` (resolves the parent's `node_modules`; no `npm install`).
- Always close stdin (`< /dev/null`). `TaskStop` does not kill Windows child processes: stop leftover `codex.exe` / `node qodercli` PIDs too. RAM was about 1.2 GB free with eight agents: add none until some finish.

Merged and safe to delete (local and `origin`): `s/M.8a-matrimony-templates`, `s/3.27-api-enrollment-payments`, the 3.28–3.30 card branches, every `s/merge-*` and `s/docs-*` branch. **`s/merge-3.29` (on origin) is broken**: delete it. PR #2 (3.8) can be closed.

Folders: all busy as in the table. `banijjik-docs` is the docs and merge folder; `banijjik-m8a` is free (no `node_modules`). Disk E: about 8.9 GB free after deleting `manoxen/.turbo` (owner OK): new worktrees with `npm install` are possible again.

**Agents claim "done" early.** Verify every DONE: `npm run card:check` in the folder, `origin/<branch>`, `gh run view <run> --json jobs`. A FAIL only on "rebased" when main moved by docs commits is fine.

**Parallel branches that bump count tests** (permission keys, audit actions, menu entries) fail CI together after merging: run the `packages/contracts` tests after each rebase.

Stash `stash@{5}` ("owner-edits-AGENTS-and-05-CONVENTIONS") holds the owner's edits; nobody may pop or drop it.

## 3. Waiting on the owner
- Keep the 2026-10-24 evening lead tab open until its agents finish.
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions.

## 4. Next actions, in order
1. Verify every §2 row (git, CI, `*.last.md`). Relaunch stopped rows; answer `STATUS: QUESTION` rows (ask the owner only for product decisions).
2. Reviews as rows finish: T1 re-review of 3.24 (R1 items only), T1 review of M.7 A2; merge checks for 3.5a B, 3.6b B, 3.7 B, 3.11 B, M.7 B and 3.35. Merge one by one through `s/merge-<card>` branches.
3. **Ready to release when a folder and RAM free up:** 3.33 (T1, `docs/plans/3.33.md`, ADR-141; Sonnet or Codex, lead T1 review) and 3.34 (T1, after 3.24 merges).
4. **Plan M.6** (storefront app): ADR-010, ADR-031, `06 §8`, `13-UX`, `routes/storefront.ts`, `contact/presentation/customer-cookies.ts`, CORS in `app.ts`. Open: host → organization, customer cookies across hosts. M.6a T1, M.6b T2. The M.7 A2 erase and export endpoints need M.6 pages.
5. After 3.24 merges: plan 3.31 and 3.32. After 3.5a B and 3.24: 3.11 C, 3.5b, 3.9 POS. Then M.8b, M.9, 3.10 and the phase 3 review.
6. Follow-ups:
   - Refund dialog has no client-side maximum (3.30); a small T3 card if wanted.
   - Replayer safety across several worker processes (STATUS 3.16).
   - Supplier payments clearing `ACCOUNTS_PAYABLE` (after 3.24).
   - 3.33 STATUS note: bookings and sessions do not see enrollment `ResourceExclusiveHold` rows; time-off creation does not check existing bookings.
   - 3.23 review follow-ups (`docs/handoffs/3.23-api-review-R1.md`).

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
- **Pushing `main`:** the owner allowed it for green-CI merges (2026-10-23 night) and confirmed it again on 2026-10-24 afternoon ("verify kore push koro"). Confirm at the start of a new session that this still holds.
- **Never:** `--no-verify`, resetting existing commits, committing `.env` files, printing env values.
- **Shell pipelines hide failures:** `git cherry-pick ... | tail` returns tail's exit code, so a conflict does not stop a `&&` chain (it pushed `s/merge-3.29` with conflict markers). Never pipe a git command whose failure must stop the chain.
- **Token cost:** keep sessions short: one task, then `/save-state`, then a new session with `/lead`.

## 6. Session log (last five)
- **2026-10-24 evening** (Opus): owner asked the lead to run the tools itself. Mapped every tool to its card from its logs; launched Qoder (3.5a B, 3.11 B, 3.24 fixes), Codex CLI (3.6b B, 3.7 B, after the owner's allow rule) and Sonnet (M.7 A2 finish, M.7 B, 3.35). Plan 3.5a Amendment 1 (`b47fafd`); 3.24 T1 review R1, changes requested (`247f4d4`). Freed 7.3 GB of disk. Handed over to a new session.
- **2026-10-24 late afternoon** (Opus): verified the seven sessions (none done; 3.24 CI red, still working; 3.6b B and M.7 B not started). Planned 3.33 event sessions occupy their resources (T1, ADR-141, `8eaadea`).
- **2026-10-24 afternoon** (Opus): merge check of M.8a passed and merged (`d06e36a`); T1 review R1 of 3.27 passed, the lead fixed the stale period version after a sync, merged (`5ebe469`). Refreshed and released the screen parts 3.5a B, 3.6b B, 3.7 B, 3.11 B, plus M.7 A2 (T1) and M.7 B; new ready board (`8e729ae`). Owner decided the reversal-after-close question (standard plus option): planned 3.34 (ADR-140) and 3.35 (flaky replay test).
- **2026-10-24 midday** (Opus): T1 review and merge of 3.23 and merge check of 3.26 (`cecb5a0`); another lead chat was turned off by the owner. Planned 3.27 (enrollment payments, ADR-139), refreshed 3.24, planned and ran 3.28–3.30 with Sonnet subagents (owner request), merged all three (`67848d6`). Checked M.8a content; gave 3.24, 3.27 and M.8a prompts.
- **2026-10-24 morning 2** (Opus): landed 3.11 A2 (`e103af6`, via `s/merge-3.11-a2`: force-push of the card branch is blocked by the auto-mode classifier, so rebase by cherry-pick onto a merge branch). Merge check of 3.26 A+B passed (conventions note added). T1 review of 3.23 passed (lead renamed `hoursOf` → `integerOf`; review R1 file). Both merged at `cecb5a0`, CI 40059020558 green.
