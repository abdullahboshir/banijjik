# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.


Last updated: 2026-10-25 (12:10 Dhaka) by Opus 5.5 · `main` = `origin/main` = this state save on top of `e40283d` (3.5b A3 plan refresh) (pushed). **The `/lead` skill reads `main:docs/LEAD-STATE.md` from the local ref: run `git fetch origin && git fetch . origin/main:main` first, or read `origin/main`.**

## 1. Where the project stands
- Phase 3: 42 numbered cards. **Merged:** 3.0–3.8 (all parts), 3.8a/b/c, 3.11 (all parts), 3.12–3.31, 3.33–3.36, 3.5b A1, **3.9 A1** (`541467f`). Planned and ready for the owner: 3.32 A/B, 3.5b A2/B, 3.9 A2 (with Amendment 1)/B, 3.10 A/B, **3.5b A3** (plan "Refresh 3", `e40283d`; B2 screen planned there too). Track M: M.0–M.5, M.6a, **M.6b** (`dcd7539`), M.7, M.8a merged; M.6c, M.8b ready; M.9 waits for the SMS provider. Details: `docs/STATUS.md`.
- **Owner request (2026-10-23):** finish every partly done card and plan everything not started; Opus plans and reviews, Sonnet codes.
- **Owner (2026-10-24): the lead runs the implementer tools itself** (launch, monitor, restart, answer questions) and may code cards with Sonnet subagents. How: §2a. Sonnet is available again (its limit reset at 00:00 Dhaka).
- **Owner (2026-10-25 08:10, asked again and confirmed): the lead fast-forwards and pushes `main` after green CI.**
- Owner decision (3.24): a stock receipt says how it was paid (CASH/BKASH/NAGAD/BANK) or `ON_CREDIT` (new `ACCOUNTS_PAYABLE`); opening stock → `OPENING_BALANCE`.
- Note: `npm audit fix --omit=dev` deletes devDependencies from `node_modules`; run `npm install` after it.
- `gh run watch` drops on this PC (TLS timeouts). Poll jobs with `gh run view <id> --json jobs`. `gh run view --log-failed` is empty while any job still runs: read one job with `gh api repos/abdullahboshir/banijjik/actions/jobs/<jobId>/logs`.
- `dist` folders go stale after switching branches or rebasing (`@banijjik/contracts`, `validation`, `i18n`, and `apps/api/dist` for browser suites): `npx turbo run build --filter=<pkg>` before local tests. A stale API build gave false 404s in the storefront suite. Low RAM: API tests with `--maxWorkers=1`.
- **The admin and storefront browser stacks start the API and the worker** (since 3.24): event handlers run in the background. A test waits for their result (reload or poll with a deadline) and never races them with a click (3.36: Activate after a payment got a correct 409 because the worker had activated first).
- Time-dependent tests follow `05-CONVENTIONS.md` "Testing" (3.26). Run date-sensitive suites between 00:00 and 06:00 Dhaka now and then.

## 2. Open branches (checked 2026-10-25 12:10)
Prompts and logs: `E:/WEB-DEVELOPMENT/PROJECTS/business-platform/lead-orchestra/` (`rules.md` shared rules; `<card>-task.md`; `*-continue*.md` restart notes). Every final message starts with `STATUS: DONE | QUESTION | BLOCKED`. Never commit or revert `.claude/settings.json` in `banijjik`.

| Card / part | Branch | Folder | Tier | State → next step |
|---|---|---|---|---|
| 3.5b A2 reverse | `s/3.5b-api-return-reverse` (`13d5a87`, on top of `93fdc3e`) | `banijjik-3.11` | T1 | Owner's tool; handoff `3.5b-api-a2.md` committed, CI 40166235651 was running at 12:05. Wait for DONE + `card:check`, then T1 review. Already seen in the diff (raise in R1): inline `import(...)` types in `order-payment-adapter.ts` and payment `index.ts`; fixed English note `"Sales return reversal payback"` (A3 E8 wants a `note` input, no fixed text); `restoreReturnTotal` throws `INTERNAL` on a currency mismatch (should be a rule error). |
| 3.32 A enrollment refunds | `s/3.32-api-enrollment-refunds` (`18fee3d`) | Codex desktop worktree `C:/Users/Abdullah Bashir/.codex/worktrees/3-32-api-enrollment-refunds/banijjik-m2` | T1 | Owner's Codex; pushed, no DONE yet. Then `card:check` in that folder and T1 review. Both 3.32 A and 3.5b A2 touch payment code: the second to merge rebases. |
| M.8b review result SMS | `s/M.8b-api-review-sms` (`d712b58`) | `banijjik-lead` | T2 | Owner's tool; pushed, no DONE yet. Then merge check. 3.5b A3 starts in this folder after M.8b and A2 merge (`owner-guide/11-3.5b-A3.md`). |

### 2a. Launching implementers (owner approved, 2026-10-24)
- **Qoder:** out of credits since 2026-10-24 evening.
- **Codex:** allow rule `Bash(codex exec:*)` in `banijjik/.claude/settings.json` (uncommitted; an agent once reverted it). Use exactly `codex exec -C <folder> -s danger-full-access -o <last.md> "$(cat <files…>)" < /dev/null > <log> 2>&1` (Bash, background); no extra `-c` option, no `cd … &&` prefix. It needs the owner's "full access" OK in the chat. Codex (low effort) stops early: each restart needs a note naming exactly what is missing.
- **Antigravity CLI** cannot run commands headless on this account: IDE only.
- **Sonnet / Haiku subagents:** Agent tool, `model: "sonnet"` (or `"haiku"` while Sonnet is out), background, in a real folder with `node_modules`. Give force-with-lease permission for the card branch in the prompt (rebases of pushed commits).
- Always close stdin (`< /dev/null`). `TaskStop` does not kill Windows child processes: stop leftover `codex.exe` PIDs too.

Merged and safe to delete (local and `origin`): `s/3.36-stable-enrollment-browser-test`, `s/3.5b-api-returns`, `s/M.8a-matrimony-templates`, `s/3.27-api-enrollment-payments`, the 3.28–3.30 card branches, `s/3.35-stable-replay-test`, `s/M.7-ui-reports`, `s/M.7-api-erasure`, `s/3.24-api-order-stock-posting`, `s/3.7-ui-enrollment`, `s/3.33-api-session-resources`, `s/3.6b-ui-rental-event`, `s/3.11-ui-commission`, `s/3.5a-ui-orders`, `s/3.34-api-reversal-after-close`, `s/M.6a-api-storefront-reads`, `s/3.11-api-order-lines`, `s/3.31-api-enrollment-revenue`, `s/3.9-api-pos`, `s/M.6b-ui-storefront`, every `s/merge-*` and `s/docs-*` branch. **`s/merge-3.29` (on origin) is broken**: delete it. PR #2 (3.8) can be closed.

Folders (all on merged branches; the owner guide assigns them): `banijjik-m2` → 3.32, `banijjik-3.11` → 3.5b, `banijjik-lead` → M.8b, `banijjik-3.5a` → 3.9, `banijjik-3.6b-a3` → 3.10, `banijjik-1.7b` → M.6c. `banijjik` stays the lead's main folder; `banijjik-docs` is the docs and merge folder; `banijjik-m8a` is free (no `node_modules`). Free RAM was about 1.7 GB with one agent: at most two at once. Disk E: about 8.4 GB free.

**Disk C: filled up (2026-10-25 11:00):** tool output and git hooks failed with ENOSPC. Leftover MongoMemoryServer folders `%TEMP%/mongo-mem-*` (about 200 MB each) were the cause; the owner allowed deleting them (1.6 GB free after). Check `Get-PSDrive C` when commands fail oddly; delete only `mongo-mem-*` folders while no `mongod` runs. As a fallback, run git and npm with `npm_config_cache=E:/tmp-lead/npm-cache TEMP=E:/tmp-lead/tmp TMP=E:/tmp-lead/tmp`.

**Agents claim "done" early.** Verify every DONE: `npm run card:check` in the folder, `origin/<branch>`, `gh run view <run> --json jobs`. A FAIL only on "rebased" when main moved by docs commits is fine.

**Parallel branches that bump count tests** (permission keys, audit actions, menu entries) fail CI together after merging: run the `packages/contracts` tests after each rebase.

Stash `stash@{5}` ("owner-edits-AGENTS-and-05-CONVENTIONS") holds the owner's edits; nobody may pop or drop it.

## 3. Waiting on the owner
- **3.5b decision 10 (now merged):** a refund without a return no longer lowers order-line commission; only returned units do. A ledger already lowered by a refund is raised back to its return-based target on the next return of that order (test data only before launch). Say if this should change (it would be a new card).
- **3.9 POS device limit (review F4):** the `posDevices` package limit is not enforced; the seeded numbers (STORE and CHAT 0, SHOP 1, BUNDLE 2, `ADDON_POS` adds nothing) would block a store that buys the add-on. The owner names the numbers; then a small card adds the `LimitGuard` check.
- **Other product decisions open:** 3.9 offline selling (default in the plan: online only at launch); M.6 listing pages are all `noindex` until a template switch is decided.
- Delete the empty folder `E:/tmp-unused`. Close the idle older lead chats (`banijjik-0b`, `-03`, `-54`, `-c1`, `-4d`).
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions.

## 4. Next actions, in order
**Owner (2026-10-25 09:30): the owner implements the remaining cards in ChatGPT and Qoder; the lead planned all of them** (on main: `3.32.md` Refresh 1, `3.5b.md` Refresh 2, `3.9.md` A2/B detail, `M.6.md` Refresh M.6c, `M.8b.md`, `3.10.md`, `M.9.md`). Ready now: **3.32 A**, **3.5b A2**, **M.8b**, **3.9 A2**, **3.10 A**, **M.6c**. After A parts: their B parts. M.9 A waits for the owner's SMS provider choice. The lead reviews every branch (T1 strict) and merges.
**Paste-ready prompts for the owner (2026-10-25 10:50):** `E:/WEB-DEVELOPMENT/PROJECTS/business-platform/lead-orchestra/owner-guide/` (`00-README.md` in Bengali: order, folder, start condition; `01`–`10` one file per card part with the shared rules appended: 3.32 A → `banijjik-m2`, 3.5b A2 → `banijjik-3.11`, M.8b → `banijjik-lead`, 3.9 A2 → `banijjik-3.5a`, 3.10 A → `banijjik-3.6b-a3`, M.6c → `banijjik-1.7b`, then the B parts in their A folders; `11-3.5b-A3.md` → `banijjik-lead` after A2 and M.8b merge). Not written yet: 3.5b B2 (after A3 and B merge; plan in Refresh 3), M.9 A (SMS provider). When a branch arrives, run `card:check` in its folder before reviewing. Update a prompt there when a plan changes (the 3.9 A2 prompt already names Amendment 1; if the A2 review renames `receiveReturnPayback`, A3 E8 already says "use the merged name").
1. Review the owner's branches as their DONE arrives (§2: 3.5b A2 and 3.32 A T1 strict, M.8b merge check; later 3.9 A2 money parts strict, 3.10 A counting strict). Merge one by one; the second rebases.
2. After A2 merges, tell the owner A3 may start; after A3 and B merge, write `owner-guide/12-3.5b-B2.md`.
3. Then the phase 3 review.
4. A3 lead decision to confirm with the owner when convenient: an exchange's store-credit refund needs the same REFUND approval as a return (exempt callers skip it).
5. Follow-ups:
   - 3.9 A1 review F3: a till cash payment reversed (3.34 `REVERSAL`) before the close still counts in expected cash (the reversal row has no `posSessionId`). The directory submit 500 → 422 is now M.6c C2.
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
- **2026-10-25 11:50–12:10** (Opus 5.5): refreshed 3.5b A3 exchange on the 3.9 A1 pattern (plan "Refresh 3" E1–E10 + B2, `e40283d`) and wrote `owner-guide/11-3.5b-A3.md`. The owner's 3.5b A2, 3.32 A and M.8b branches arrived on origin (no DONE yet); listed them in §2.
- **2026-10-25 09:30–11:40** (Opus 5.5, two lead chats one after the other): planned every remaining card (`0cb31b1`…`8f44ce6`); wrote the owner's paste-ready prompts in `lead-orchestra/owner-guide/`. T1 review R1 of 3.9 A1 (accepted; F1/F2 into the plan as Amendment 1 for A2) and review R1 of M.6b (lead fixed an encoded-slash path traversal in the storefront proxy); stacked and merged both (`541467f`, `dcd7539`). Disk C: was full: deleted leftover `mongo-mem-*` folders with the owner's OK.
- **2026-10-25 07:50–08:40** (Opus 5.5, Sonnet implementer): 3.36 root cause: the browser stack runs the worker since 3.24, so a staff Activate after the payment raced it (correct 409); the test now reloads until ACTIVE; merged (`fb9639f`). Rebased 3.5b A1 on 3.31, T1 review R1 (lead fixes: currency compared before settling, dead branch, a 60-line split) and merged (`dd51581`). Launched 3.9 A1 (Sonnet). Took over M.6b and fixed its browser setup step by step (6 of 8 pass locally).
- **2026-10-25 03:00–07:45** (Opus, banijjik-4d, Haiku implementers): T1 review and merge of 3.31 (`09b0921`). Planned 3.5b (ADR-145, `852f473`) and 3.9 POS (ADR-146, `49920df`); answered 3.5b A1 Amendments 1–2 and M.6b Amendment 1. Took over CI waits from stalling Haiku agents. Started lead card 3.36.
- **2026-10-24 21:45 – 2026-10-25 03:00** (Opus, banijjik-4d, Haiku implementers): merged 3.5a B (`f5dfd17`), 3.34 after T1 R1 (`2850cd6`), M.6a after T1 R1 (`f9311d8`) and 3.11 C (`dd143a5`). Planned M.6 in three parts (ADR-144), refreshed 3.11 C and 3.31.
