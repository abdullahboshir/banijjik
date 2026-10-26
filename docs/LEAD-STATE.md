# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.


Last updated: 2026-10-26 (morning) by Sonnet 5.5 (lead `banijjik-fa`, sole lead from now on) · `main` = `origin/main` = this state commit on top of `c2bde283` (pushed).

## 1. Where the project stands
- Phase 3: 42 numbered cards. **Merged:** 3.0–3.8 (all parts), 3.8a/b/c, 3.11 (all parts), 3.12–3.37, **3.5b all parts** (B2 `37ca04f`), 3.9 A1/A2, 3.32 A + B, **3.10 A** (`87a8218`). Track M: **M.6 done (M.6c `3a3fb61`)**. Open: 3.10 B, 3.9 B (peer chat's agents, §2). Not started: M.9 A1 (`banijjik-m8a` free), then 3.10 B (peer agent may take it after 3.10 A), M.9 A2. Haiku session limit hit 2026-10-26 ~01:00 Dhaka (resets later that day); Sonnet weekly limit until 2026-10-29.
- **Windows reinstalled on 2026-10-25 (C: formatted; E: and F: kept).** Backup at `F:/_PC-BACKUP-2026-10-25` (`RESTORE-README.txt`): restored `~/.claude` (sessions, skills, settings), `.gitconfig`, `.ssh`. Reinstalled with winget: GitHub CLI (logged in; Git Bash needs `export PATH="$PATH:/c/Program Files/GitHub CLI"`), MongoDB 8.2 (same `MONGOMS_SYSTEM_BINARY` path), Chrome. **Docker does not run: virtualization is off (BIOS VT-x/SVM + `wsl --install --no-distribution`, owner to do)**, so Redis 6380 and the browser suites run only on CI. C: now has ~140 GB free (the old C: disk notes in §2 no longer apply); E: ~8 GB. RAM 16 GB: about three cards at once in total. Not restored yet: `stashes/*.patch`, `.codex`, user env vars (see the backup). Track M: M.0–M.5, M.6a, M.6b, M.7, M.8a, **M.8b** (`5d50264`) merged; M.6c ready; **M.9 planned (Refresh A, ADR-147): owner chose adaReach and BulkSMSBD, set from the platform panel (default) and from business settings (own account wins), one active provider, no failover; A1 (API, T1) ready, A2 screens after A1.**
- **Sonnet weekly limit hit (2026-10-25 ~12:30); it resets 2026-10-29 00:00 Dhaka.** Until then Sonnet subagents fail: use Haiku subagents or let the owner's tools code; the lead (Opus) finishes small leftovers itself.
- **Owner (2026-10-25 12:55): one lead session keeps all background agents.** If several lead chats are open, the newest `/lead` session asks the others (SendMessage) to hand over and to stay off `main`, `banijjik-docs` and card branches. Details: `docs/STATUS.md`.
- **Owner request (2026-10-23):** finish every partly done card and plan everything not started; Opus plans and reviews, Sonnet codes.
- **Owner (2026-10-24): the lead runs the implementer tools itself** (launch, monitor, restart, answer questions) and may code cards with Sonnet subagents. How: §2a. Sonnet is available again (its limit reset at 00:00 Dhaka).
- **Owner (2026-10-25 08:10, asked again and confirmed): the lead fast-forwards and pushes `main` after green CI.**
- Owner decision (3.24): a stock receipt says how it was paid (CASH/BKASH/NAGAD/BANK) or `ON_CREDIT` (new `ACCOUNTS_PAYABLE`); opening stock → `OPENING_BALANCE`.
- Note: `npm audit fix --omit=dev` deletes devDependencies from `node_modules`; run `npm install` after it.
- `gh run watch` drops on this PC (TLS timeouts). Poll jobs with `gh run view <id> --json jobs`. `gh run view --log-failed` is empty while any job still runs: read one job with `gh api repos/abdullahboshir/banijjik/actions/jobs/<jobId>/logs`.
- `dist` folders go stale after switching branches or rebasing (`@banijjik/contracts`, `validation`, `i18n`, and `apps/api/dist` for browser suites): `npx turbo run build --filter=<pkg>` before local tests. A stale API build gave false 404s in the storefront suite. Low RAM: API tests with `--maxWorkers=1`.
- **The admin and storefront browser stacks start the API and the worker** (since 3.24): event handlers run in the background. A test waits for their result (reload or poll with a deadline) and never races them with a click (3.36: Activate after a payment got a correct 409 because the worker had activated first).
- Time-dependent tests follow `05-CONVENTIONS.md` "Testing" (3.26). Run date-sensitive suites between 00:00 and 06:00 Dhaka now and then.

## 2. Open branches (checked 2026-10-26 morning; owner asleep, agents continue)
**Ownership (agreed 2026-10-26 by message): `banijjik-fa` alone does review, merge, `main` and `banijjik-docs`. `b9`, `9e`, `00` are idle and stay off; `67` keeps only its two Haiku agents (card branches only). Add a row for M.9 A1: owner runs it in ChatGPT (`banijjik-m8a`, `s/M.9-api-sms-gateways`, T1): strict review on DONE, check the BulkSMSBD `type` value against M.9 Part B item 13.**
Prompts and logs: `E:/WEB-DEVELOPMENT/PROJECTS/business-platform/lead-orchestra/` (`rules.md` shared rules; `<card>-task.md`; `*-continue*.md` restart notes). Every final message starts with `STATUS: DONE | QUESTION | BLOCKED`. Never commit or revert `.claude/settings.json` in `banijjik`.

| Card / part | Branch | Folder | Tier | State → next step |
|---|---|---|---|---|
| 3.10 B home and reports page | prompt `10-3.10-B.md` | `banijjik-3.6b-a3` | T2 | Peer chat `banijjik-67` agent (3.10 A merged `87a8218`, review R1 + R2). Next: merge check on DONE. |
| 3.9 B POS screens | owner-guide 09 | `banijjik-3.5a` | T2 | Haiku agents of the peer lead chat `banijjik-67` (owner asked it). It pushes card branches only and sends `banijjik-fa` each DONE branch; `banijjik-b9` reviews and merges. Do not start agents in these folders. |

### 2a. Launching implementers (owner approved, 2026-10-24)
- **Qoder:** out of credits since 2026-10-24 evening.
- **Codex:** allow rule `Bash(codex exec:*)` in `banijjik/.claude/settings.json` (uncommitted; an agent once reverted it). Use exactly `codex exec -C <folder> -s danger-full-access -o <last.md> "$(cat <files…>)" < /dev/null > <log> 2>&1` (Bash, background); no extra `-c` option, no `cd … &&` prefix. It needs the owner's "full access" OK in the chat. Codex (low effort) stops early: each restart needs a note naming exactly what is missing.
- **Antigravity CLI** cannot run commands headless on this account: IDE only.
- **Sonnet / Haiku subagents:** Agent tool, `model: "sonnet"` (or `"haiku"` while Sonnet is out), background, in a real folder with `node_modules`. Give force-with-lease permission for the card branch in the prompt (rebases of pushed commits).
- Always close stdin (`< /dev/null`). `TaskStop` does not kill Windows child processes: stop leftover `codex.exe` PIDs too.

Merged and safe to delete (local and `origin`): `s/3.36-stable-enrollment-browser-test`, `s/3.5b-api-returns`, `s/M.8a-matrimony-templates`, `s/3.27-api-enrollment-payments`, the 3.28–3.30 card branches, `s/3.35-stable-replay-test`, `s/M.7-ui-reports`, `s/M.7-api-erasure`, `s/3.24-api-order-stock-posting`, `s/3.7-ui-enrollment`, `s/3.33-api-session-resources`, `s/3.6b-ui-rental-event`, `s/3.11-ui-commission`, `s/3.5a-ui-orders`, `s/3.34-api-reversal-after-close`, `s/M.6a-api-storefront-reads`, `s/3.11-api-order-lines`, `s/3.31-api-enrollment-revenue`, `s/3.9-api-pos`, `s/M.6b-ui-storefront`, `s/3.5b-api-return-reverse`, `s/3.32-api-enrollment-refunds`, `s/3.32-lead-fix` (local, `banijjik-m2`), `s/M.8b-api-review-sms`, `s/3.9-api-pos-extras`, `s/3.32-ui-enrollment-refunds`, every `s/merge-*` and `s/docs-*` branch. **`s/merge-3.29` (on origin) is broken**: delete it. PR #2 (3.8) can be closed.

Folders (all on merged branches; the owner guide assigns them): `banijjik-m2` → 3.32, `banijjik-3.11` → 3.5b, `banijjik-lead` → M.8b, `banijjik-3.5a` → 3.9, `banijjik-3.6b-a3` → 3.10, `banijjik-1.7b` → M.6c; 3.5b A3 → `banijjik-lead`. The Codex worktree `C:/Users/Abdullah Bashir/.codex/worktrees/3-32-api-enrollment-refunds` holds the merged 3.32 branch: remove it (`git worktree remove`) once the owner says yes. `banijjik` stays the lead's main folder; `banijjik-docs` is the docs and merge folder; `banijjik-m8a` is free (no `node_modules`). Disk E: about 8 GB free.

**Disk C: (old PC, before the reinstall):** the `mongo-mem-*` cleanup rule still holds: delete only `%TEMP%/mongo-mem-*` folders while no `mongod` runs, if C: ever fills again.

**Agents claim "done" early.** Verify every DONE: `npm run card:check` in the folder, `origin/<branch>`, `gh run view <run> --json jobs`. A FAIL only on "rebased" when main moved by docs commits is fine.

**Parallel branches that bump count tests** (permission keys, audit actions, menu entries) fail CI together after merging: run the `packages/contracts` tests after each rebase.

Stash `stash@{5}` ("owner-edits-AGENTS-and-05-CONVENTIONS") holds the owner's edits; nobody may pop or drop it.

## 3. Waiting on the owner
- **Turn on virtualization** (BIOS, then admin `wsl --install --no-distribution`, reboot) so Docker, Redis and the local browser suites work again.
- Which cards the owner's tools are running now (owner guide README suggests 3.9 B + 3.10 A first, then 3.5b B, M.9 A1; at most two from the owner's side).
- **3.5b decision 10 (now merged):** a refund without a return no longer lowers order-line commission; only returned units do. A ledger already lowered by a refund is raised back to its return-based target on the next return of that order (test data only before launch). Say if this should change (it would be a new card).
- **3.9 POS device limit (review F4):** the `posDevices` package limit is not enforced; the seeded numbers (STORE and CHAT 0, SHOP 1, BUNDLE 2, `ADDON_POS` adds nothing) would block a store that buys the add-on. The owner names the numbers; then a small card adds the `LimitGuard` check.
- **Other product decisions open:** 3.9 offline selling (default in the plan: online only at launch); M.6 listing pages are all `noindex` until a template switch is decided.
- Delete the empty folder `E:/tmp-unused`. Close the idle older lead chats (`banijjik-0b`, `-03`, `-54`, `-c1`, `-4d`).
- Keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public), phone usability check (deferred), doc 16 §6 matrimony decisions.

## 4. Next actions, in order
**Owner (2026-10-25 09:30): the owner implements the remaining cards in ChatGPT and Qoder; the lead planned all of them** (on main: `3.32.md` Refresh 1, `3.5b.md` Refresh 2, `3.9.md` A2/B detail, `M.6.md` Refresh M.6c, `M.8b.md`, `3.10.md`, `M.9.md`). Owner (2026-10-25 evening): the lead's Haiku agents finish the partly done cards (3.5b A3, M.6c); the owner's tools (Qoder/ChatGPT) take the rest from the owner guide: **3.9 B** (`banijjik-3.5a`), **3.10 A** (`banijjik-3.6b-a3`), **3.5b B** (`banijjik-3.11`), **M.9 A1** (`banijjik-m8a`, one `npm ci` first). The README table and prompts 05/08/09/10/12 were updated for the reinstalled PC (no Docker, gh path). The lead reviews every branch (T1 strict) and merges.
**Paste-ready prompts for the owner (2026-10-25 10:50):** `E:/WEB-DEVELOPMENT/PROJECTS/business-platform/lead-orchestra/owner-guide/` (`00-README.md` in Bengali: order, folder, start condition; `01`–`10` one file per card part with the shared rules appended: 3.32 A → `banijjik-m2`, 3.5b A2 → `banijjik-3.11`, M.8b → `banijjik-lead`, 3.9 A2 → `banijjik-3.5a`, 3.10 A → `banijjik-3.6b-a3`, M.6c → `banijjik-1.7b`, then the B parts in their A folders; `11-3.5b-A3.md` → `banijjik-lead`; `12-M.9-A1.md` → `banijjik-m8a`; rows 1–3 are marked merged). Not written yet: 3.5b B2 (after A3 and B merge; plan in Refresh 3), M.9 A2 (after A1 merges). When a branch arrives, run `card:check` in its folder before reviewing. Update a prompt there when a plan changes (the 3.9 A2 prompt already names Amendment 1; if the A2 review renames `receiveReturnPayback`, A3 E8 already says "use the merged name").
1. Review branches as their DONE arrives (3.5b A3 T1 strict; 3.10 A counting strict; M.9 A1 T1 strict; B parts and M.6c merge check). Merge one by one; the second rebases.
2. After 3.5b A3 and B merge, write `owner-guide/13-3.5b-B2.md`; after M.9 A1 merges, write `owner-guide/14-M.9-A2.md` (plan decisions 17–19).
3. Then the phase 3 review.
4. A3 lead decision to confirm with the owner when convenient: an exchange's store-credit refund needs the same REFUND approval as a return (exempt callers skip it).
5. Follow-ups:
   - 3.5b A2 R2: the return response does not show `reversal.businessDate`. The CI test `main.test.ts` › "starts the API on ROLE=api…" timed out once (CI 40169380874), like `sync-indexes.test.ts`: both spawn processes.
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
- **2026-10-26 morning** (Sonnet 5.5, `banijjik-fa`): `/lead` checks; agreed with b9, 9e, 00, 67 that fa is the sole lead; added the Bangla SMS check as M.9 Part B item 13 (`c2bde283`). No merges; 3.9 B (CI 40268691537) and 3.10 B (CI 40269535363) wait for DONE from 67.
- **2026-10-25 late evening** (Sonnet 5.5, lead in `banijjik`): `/lead` check only. Fixed the M.6c lint failure (`26684d19`). Found the 3.5b A3 Haiku agent still active in `banijjik-lead`; left it alone. No merges.
- **2026-10-26 early morning** (Opus 5.5, `banijjik-b9`): merged 3.5b B (peer agent; merge check) and M.6c (R2: lead removed a debug write; CI infra flake rerun green); wrote `owner-guide/13-3.5b-B2.md` (peer agent took it); 3.10 A review R1 sent back (real-Mongo exactly-once tests, unused enum); fixed the 3.10 plan wording (ADR-148, 400).
- **2026-10-25 night** (Opus 5.5, `banijjik-b9`): T1 review R1 of 3.5b A3 (lead README fix; answers on the store-credit read, 404 cross-location, discount approval) and merged it (`8fc1803`); lead card 3.37 (payment browser test booked "now + 24 h" and failed near Dhaka midnight on every branch) merged; M.6c merge check R1 sent back (browser tests, budgets, photo upload). Shared the folders with the peer lead chat `banijjik-67`.
- **2026-10-25 evening** (Opus 5.5, lead in `banijjik`, after the Windows reinstall): restored `~/.claude`, `.gitconfig`, `.ssh` from the F: backup; installed gh, MongoDB 8.2, Chrome (Docker blocked: virtualization off). Merged 3.9 A2 (`de2d960`, review R1 was already done) and 3.32 B (merge check, `348b090`). Launched Haiku agents on 3.5b A3 and M.6c (Sonnet weekly limit); answered the A3 questions (§2). Updated the owner guide for the owner's tools.
