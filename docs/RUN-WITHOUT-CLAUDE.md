# Running banijjik without a Claude lead

Written by: Opus 5.5 (Claude, lead) · Date: 2026-10-26 · Based on commit: `main 5a3bb2b7`

From 2026-10-29 the owner has no Claude plan. Planning, reviewing and merging move to the owner and the tools the owner keeps: Cursor, ChatGPT (with Codex), Qoder and Antigravity. This file is the operating manual for that. It changes **who** does the lead's work, not the rules: `AGENTS.md`, `docs/05-CONVENTIONS.md`, `docs/plans/parallel-sessions-guide.md` and the ADRs stay binding for every tool.

Read order for any tool, every session: `AGENTS.md` → this file (the section for your role) → `docs/LEAD-STATE.md` → `docs/STATUS.md` → your card's plan.

## 1. Roles
| Role | What it does | Tool (default; the owner may swap) | Never |
|---|---|---|---|
| **Lead** | keeps `docs/LEAD-STATE.md` and `docs/STATUS.md`, picks the next cards, writes the owner prompts, runs merges for the owner | ChatGPT Codex or Cursor agent (needs repo and `git` access), strongest model | writes application code for a card it will also review |
| **Planner** | writes `docs/plans/<card>.md` | strongest reasoning model available (ChatGPT top model through Codex, or Cursor's top model) | writes application code, makes a product decision alone |
| **Plan checker** (T1 only) | reads a new T1 plan against the code and docs before anyone implements it | a different tool than the planner | rewrites the plan's decisions; it lists gaps |
| **Implementer** | codes one part of one card on its own branch | Cursor, Qoder, Antigravity, Codex | invents design, edits files outside the plan, pushes `main` |
| **Reviewer** | reviews a finished branch | a **different** tool than the implementer; T1: strongest model | accepts the implementer's report as proof |
| **Owner** | product decisions, secrets, paid accounts, the final merge "yes", pushing `main` | the owner | skips a merge gate (§6) |

Two rules replace the Opus-only rules of `AGENTS.md` "Session types" while no Claude plan exists:
1. The tool that wrote a plan or the code never approves it. Planner ≠ plan checker; implementer ≠ reviewer.
2. Where `AGENTS.md` says "Opus", use the strongest model you have, and for T1 add the plan check (§4.3).

## 2. The state files
- `docs/LEAD-STATE.md`: open branches and their next step, what waits on the owner, next actions in order, working rules. At most about 150 lines; rewrite, never append. Only the lead role edits it.
- `docs/STATUS.md`: one row per card. An implementer edits only its own card row; the lead marks rows merged.
- `docs/04-DECISIONS.md`: every owner decision and architecture choice becomes an ADR. A tool adds it as "Accepted (proposed)"; the owner's yes makes it "Accepted".
- Plans: `docs/plans/<card>.md`. Changes after implementation started are appended as "Amendment <part>-<n>" sections, never silent edits.
- Handoffs and reviews: `docs/handoffs/<card>-<api|ui>.md`, `docs/handoffs/<card>-<api|ui>-review-R<n>.md`.
- Paste-ready owner prompts (outside the repo): `E:/WEB-DEVELOPMENT/PROJECTS/business-platform/lead-orchestra/owner-guide/` (one file per card part, with `lead-orchestra/rules.md` appended at the end).

## 3. Work queue (2026-10-26; the lead keeps it current in LEAD-STATE §4)
Order follows the launch track (ADR-099 as amended by ADR-150): pilot with salons, gyms and coaching centres, each with its full website; the bot after the pilot. "Plan" says whether `docs/plans/<card>.md` exists.

| # | Card | Tier | Plan | Starts when |
|---|---|---|---|---|
| 1 | 3.40 A walk-in services (API) | T1 | yes | branch done, review next |
| 2 | 3.40 B walk-in services (screens) | T2 | yes (decisions 12–14) | 3.40 A merged |
| 3 | 3.41 day scenarios with report numbers | T2 | **no** | 3.40 A merged; blocks Phase 4 |
| 4 | 3.43 API correctness leftovers (till cash reversal, cashier contacts, `approverMemberId`, typed payloads, `placeOrder` key) | T1 (proposed: till cash and idempotency) | **no** | now |
| 5 | 3.42 POS till leftovers (held carts, till returns, price override) | T2 | **no** | after 3.43 if they share files |
| 6 | Phase 3 close: re-check the review findings F1–F4 | review | n/a | 3.40–3.43 merged |
| 7 | M.9 B owner's matrimony site live (domain, SMS live, backups, pilot) | checklist | yes (`M.9.md`) | owner's accounts ready (P5, P6) |
| 8 | 4.1 theme engine (tokens, sections with variants, page JSON, lock levels; each site its own design copy, ADR-149) | T1 (proposed: every later website card builds on it) | **no** | Phase 3 closed |
| 9 | 4.2 storefront app (subdomain and custom domain → organization, server rendering, SEO, cache) | T1 (proposed: tenant resolution from the host) | **no** | 4.1 Part A merged |
| 10 | 4.3 shop and booking flow (all kinds; server-side re-pricing; booking, enrollment and order tracking; takes over 4.6) | T1 | **no** | 4.2 |
| 11 | 4.4 platform template builder (per industry; design one business's site; same-look warning) | T2 | **no** | 4.1 |
| 12 | 4.5 tenant website editor (choose template, edit within limits, preview, publish, rollback) | T2 | **no** | 4.1, 4.4 |
| 13 | 5.1 integration framework (credentials, webhooks, retries, token health) | T1 | **no** | Phase 3 closed; may run beside Phase 4 |
| 14 | 5.13 notifications (SMS reminders, dues, guardians) | T2 | **no** | 5.1 merged |
| 15 | 6.1 signup and onboarding wizard | T2 | **no** | 4.5 |
| 16 | 6.2 SaaS billing | T1 | **no** | 6.1 |
| 17 | 6.3 hardening, 6.4 performance, 6.5 ops | T1 / T2 | **no** | before 6.6 |
| 18 | 6.6 pilot launch | owner | n/a | everything above |
| later | Phase 5 rest (courier, channels, inbox, bot), Phase 7, Phase 8 | | | after the pilot |

**Owner decision (2026-10-26, ADR-150):** the full tenant website (Phase 4) is built before the pilot; 4.6 is folded into 4.3 (proposed). Phase 4 design inputs: `docs/06-AUTOMATION-AND-ACCOUNTS.md` §8, ADR-029, ADR-031, ADR-114, ADR-149, ADR-150, card 3.12 (branding) and the M.6 storefront that already exists in `apps/storefront`. Plan 4.1 before any other Phase 4 card: its token and section model is what 4.2–4.5 consume.

Phase 5 bot cards (5.6–5.9) are the riskiest work left. Before planning them, the planner reads `docs/08-UNIVERSAL-BOT.md` and ADR-035 in full; 5.6 (the eval harness with the D5 golden conversations) comes before any bot code.

## 4. Planning (Planner role)
### 4.1 When
Just in time: plan only the next two or three cards, from the code as it is on `main` now. A plan whose "Based on commit" is older than the code it touches is refreshed (a "Refresh" section) before anyone implements it.

### 4.2 What a plan must contain
Use `docs/plans/_TEMPLATE.md`. A plan is not ready until:
- it names the docs sections and code files it read, and its "Based on commit"
- every design choice is a written decision with a reason; nothing is left for the implementer to choose
- product questions are asked to the owner and the answers are written in as decisions (with the date)
- it is split into parts of at most about 25 files (T1: about 15 production files), Part A API before Part B screens (`parallel-sessions-guide.md` §3)
- the Files table marks every file **owns** or **add-only**
- exact TypeScript signatures for new ports, entities, DTOs, events and manifest entries
- data: models, fields, indexes (first field `organizationId`), migrations
- a test list with names: happy path, validation error, permission denied, cross-org denied, cross-location where relevant, and for T1 each applicable item of `parallel-sessions-guide.md` §11
- "Out of scope" and "Done when"
- new enums, permission keys, events and error codes listed for `packages/contracts` first

### 4.3 Plan check (T1 only)
A second tool reads the plan and the code it names and answers: Does each decision match `AGENTS.md`, the ADRs and the existing code? Is any design choice left to the implementer? Is any rule of §7 at risk? Is any test missing? The planner fixes the gaps; then the plan is ready.

### 4.4 Planner prompt
```
Role: PLANNER for banijjik. Read AGENTS.md, docs/RUN-WITHOUT-CLAUDE.md §4 and §7, docs/LEAD-STATE.md, docs/STATUS.md,
the card <id> entry in docs/03-ROADMAP.md, the docs sections it names, and the existing code it will touch (current main).
Write docs/plans/<id>.md from docs/plans/_TEMPLATE.md, meeting every point of §4.2. No application code.
Ask me every product question before you write the decision; do not guess. Name new ADRs "Accepted (proposed)".
Commit on branch s/docs-plan-<id> from main and tell me the commit.
```

## 5. Implementing (Implementer role)
Use the card's file in `lead-orchestra/owner-guide/` when it exists; otherwise this prompt, with `lead-orchestra/rules.md` pasted after it:
```
Role: IMPLEMENTER for banijjik. Folder <folder>, branch s/<card>-<api|ui>-<slug> from origin/main.
Read AGENTS.md, docs/plans/parallel-sessions-guide.md §1–§8 and §11, and docs/plans/<card>.md with every Refresh and Amendment.
Implement part <A|B> exactly as the plan says. Touch only the files the plan lists. If the plan has a gap or conflicts with the code, stop and ask.
Before the first push run locally: every test this part's plan names, the changed test files, lint and typecheck of the touched workspaces, and for screens the app's browser suite. Do not stub or skip a plan test to save CI time.
CI is not a debugger: after a red job, read the failed test name. Known flake → one `gh run rerun --failed` (no new commit). Real failure in a file you touched → run it locally, fix, one push. A file you did not touch → stop and ask.
Finish with every step of guide §8. Your last message starts with STATUS: DONE | QUESTION | BLOCKED; DONE carries the full npm run card:check output and the green CI link.
```
Folders: one tool per folder, at most three cards at once on this PC. Existing worktrees are listed in LEAD-STATE §2; a new one: `git worktree add ../banijjik-<card> -b <branch> origin/main`, then `npm ci` and `npx turbo run build --filter="./packages/*"`.

When a tool answers QUESTION, the lead (or the planner) answers it by adding an Amendment to the plan, commits it to `main`, and the owner pastes "Read Amendment <n> in docs/plans/<card>.md and continue" to the same tool. When a tool stops early, restart it with a note that names exactly what is missing.

## 6. Review and merge
### 6.1 Entry ticket
A review starts only when, in the card's folder:
- `npm run card:check` prints PASS on every line (INFO about main having moved is fine)
- `gh run list --branch <branch>` shows a green run on the last code commit
- the handoff exists and lists deviations and test names

### 6.2 Reviewer prompt
```
Role: REVIEWER for banijjik, card <id> part <A|B>, tier <T1|T2|T3>. You did not write this code.
Read AGENTS.md, docs/RUN-WITHOUT-CLAUDE.md §6–§7, docs/plans/<id>.md (with Refresh and Amendment sections) and the handoff.
Read the whole diff: git diff origin/main...origin/<branch>. Do not trust the handoff; check the code.
T1: walk docs/plans/parallel-sessions-guide.md §11 and RUN-WITHOUT-CLAUDE §7 item by item and try to break each rule with a concrete scenario.
T2/T3: check the diff against the plan's Files, Decisions and Tests, the handoff's deviations, and the DoD in AGENTS.md.
Write docs/handoffs/<id>-<api|ui>-review-R<n>.md: numbered findings, each with file:line, severity (blocker / must-fix / minor),
the failing scenario and the fix. End with PASS, PASS WITH FIXES or FAIL. Say plainly when you find nothing.
```
Findings go back to the implementer's session as the review file. Round 2 reviews only the fixes and anything they touch. When a round leaves at most three small items (about an hour each, no design choice), the reviewer fixes them on the branch instead of starting another round.

### 6.3 Merge (lead role does the steps, owner says yes)
1. In the card folder: `git fetch origin && git merge origin/main` (never rebase or force-push pushed commits). Conflicts in add-only files (i18n catalogs, contracts index, routes): keep both sides; catalogs join with a comma.
2. If permission keys, audit actions or menu entries changed on two branches, run the `packages/contracts` tests now.
3. Mark the card row merged in `docs/STATUS.md` on the branch, commit, push, and wait for green CI on that head (a docs-only commit needs no new run when the code commit before it is green).
4. Fast-forward `main`: `git push origin <branch>:main`. If it is rejected, `main` moved: go back to step 1. Never push a head without green CI.
5. Update `docs/LEAD-STATE.md` (§8 save-state prompt). Delete the merged branch (`git push origin --delete <branch>`) and remove its worktree when no other card uses the folder.

### 6.4 Phase review
At the end of a phase, the strongest model reads all handoffs and reviews of the phase and checks: cross-card consistency (names, contracts, ports), the roadmap's "Phase done" criteria, doc versus code drift, open gaps in STATUS.md. Output: `docs/handoffs/phase-<n>-review.md` with PASS / PASS WITH FIXES / FAIL. The next phase starts only after PASS (or after the listed fixes merge).

## 7. Review checklist (every T1 review; the relevant lines for T2)
**Tenancy and security**
- Every tenant model uses the tenant plugin; business code gets models through `models(ctx)`; `organizationId` never comes from the body or query.
- Location-owned data has LOCATION tenancy, a cross-location test, and location limits counted through `runInOrganizationContext`, never a request-scoped repository.
- Permissions and entitlements are checked in the API (permission keys, never role keys). Hidden UI is not protection.
- `runAsSystem` only with an enum reason and never inside module repositories, use cases or controllers.
- No secret, token or part of one stored in plain text, logged or returned. User input in `$regex` is escaped and anchored.

**Money, stock and ledgers**
- Integer minor units plus currency; currency compared, never assumed; no `"BDT"` literal.
- Ledgers append-only; a reversal undoes every journal, store credit and refund the original wrote.
- Multi-document writes in `withTransaction()`; limits read and checked inside the same transaction; double actions stopped by a unique index.
- Money, credit or stock endpoints require `Idempotency-Key`, and a replay returns the first response.
- Updates use `version`; a stale version returns 409.
- Business dates are the organization's local date; a test covers 00:00–06:00 Dhaka.

**Architecture**
- No `industry` reads outside `modules/platform/industry` and the resolver; no hardcoded nouns; config from `resolveOrgConfig`.
- Routes, menu, settings and bot tools come from the module manifest; the "module off" tests pass.
- Other modules imported only through their `index.ts`; domain imports only contracts and ids.
- New enums, events, permission keys and error codes in `packages/contracts`; request schemas in `packages/validation`; no message literals.
- IDs from `newId()`, fields named `<entity>Id`, no Mongo `_id` outside infrastructure; customer numbers from the per-org sequence.
- External effects (SMS, courier, webhooks, AI) through the outbox.
- Lists paginated (limit ≤ 100) with an index starting with `organizationId`; no N+1; `lean()` with projection.

**Code and tests**
- No `as unknown as`, `any`, empty `catch`, `console.*`, TODO, mock data or commented-out code.
- Functions ≤ 60 lines, complexity ≤ 10, depth ≤ 3; no eslint-disable; no `--no-verify`.
- Every planned test exists under its name and its body checks what the name promises.
- UI: real API, BN and EN keys, mobile layout (cards, 44 px touch targets, no horizontal scroll).

## 8. Lead prompts (replace the Claude `/lead` and `/save-state` skills)
**Start a lead session:**
```
Role: LEAD for banijjik. Read AGENTS.md, .cursor/rules/speed.mdc, docs/RUN-WITHOUT-CLAUDE.md and docs/LEAD-STATE.md (on main).
CI is not a debugger: never guess-and-push. Screen cards need that app's browser suite locally before the first push.
Check reality: git worktree list; for each open branch in LEAD-STATE §2: git log --oneline -3 <branch> and git rev-list --count main..<branch>;
gh run list --limit 5. Tell me in Bengali, in a few lines, what changed and the first next action from LEAD-STATE §4, then do it.
You may review, plan and prepare merges. Push main only when I say yes for that merge.
```
**Save the state (before ending, after every merge):**
```
Update docs/LEAD-STATE.md so a new session can continue from it alone: rewrite (do not append) the "Last updated" line (date, tool, main commit),
§2 open branches with folder, tier, state and exact next step, §3 waiting on the owner, §4 next actions in order, §6 session log (keep five).
At most about 150 lines, no secrets. Commit on s/docs-state-<date> from main (with any STATUS.md row changes), and fast-forward main
with git push origin s/docs-state-<date>:main after I say yes.
```

## 9. This PC and CI (traps that cost hours before)
- Docker Desktop runs Redis on port 6380 (`banijjik-redis-1`); the local MongoDB service holds 27018. Turn on "Start Docker Desktop when you sign in".
- Test environment, set in the command, never in files: `MONGOMS_SYSTEM_BINARY="C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe" MONGOMS_VERSION_CHECK=false TEST_REDIS_URL=redis://127.0.0.1:6380 NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 NEXT_PUBLIC_BRAND_NAME=Example CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"`.
- One API test file: `npx vitest run --config src/test-support/vitest.config.ts <file>` inside `apps/api`, with `--maxWorkers=1`.
- After switching branches, `dist` folders are stale: `npx turbo run build --filter=<package>` for `@banijjik/contracts`, `validation`, `i18n`, and build `apps/api` before a browser suite (a stale API build gives false 404s).
- Browser suites start the API and the worker: a test waits for event handlers (reload or poll with a deadline), never races them.
- Two browser stacks cannot run at once while the dev stack in `banijjik` holds ports 3000 and 4000; then CI judges the browser suite.
- **CI is not a debugger.** After a red job, read the failed **test name**. Guess-and-push (lead, 3.42: six CI rounds) is a violation of guide §7–§8. Speed does not allow incomplete or untested code.
- **Zero-idle subagent pipeline (Antigravity / multi-agent sessions, owner 2026-10-29):**
  - Run subagents with `Model: "flash"` (Gemini Flash). Keep roles strictly separated: an Implementer subagent never reviews its own code; spawn a fresh Reviewer subagent.
  - **Overlap T1/T2 review and docs prep with CI:** As soon as the locally-verified code commit is pushed (`git push -u origin s/<card>-<part>-<slug>`) and CI starts on GitHub, immediately launch the independent Reviewer subagent on `git diff "origin/main...s/<card>-<part>-<slug>"` and prepare `docs/handoffs/<card>-review-R1.md`, `docs/handoffs/<card>.md`, `docs/STATUS.md`, and `docs/LEAD-STATE.md` **while CI is running**. The moment CI turns green, commit the `docs/` files (`paths-ignore: ["docs/**"]` skips a second CI wait) and fast-forward `main`.
  - **Parallel lanes in separate worktrees:** When two cards/parts have no dependency between them, run them concurrently in separate git worktrees and push both so their GitHub CI runs execute simultaneously instead of back-to-back.
  - **Zero compromise on completeness:** Never stub, skip a planned test, weaken an assertion, omit tenant/permission/validation checks, or push untested code to "save time". Every file and test in the frozen plan must pass locally before the first push.
- **Windows / PowerShell command hygiene:**
  - Use `npm.cmd`, `npx.cmd`, and `& "C:\Program Files\GitHub CLI\gh.exe"` in PowerShell so `.ps1` execution policy never fails a tool call.
  - Always quote git revision ranges containing `..` (e.g. `"origin/main..HEAD"`, `"origin/main...HEAD"`) so PowerShell does not parse `..` as a range operator.
  - In Storefront/Node tests on Windows that send virtual-host `Host` headers (`*.localhost`) over loopback, use `node:http` to `127.0.0.1` (`fetchStorefront` helper) because Node global `fetch` (undici) overrides custom `Host` headers.
  - Ensure `productionEnvironment` in `apps/api/src/test-support/spawned-process.ts` includes any newly required production env vars so `sync-indexes.test.ts` never fails in CI.
- `gh run watch` drops on this PC: poll `gh run view <id> --json jobs`. Failed job log: `gh api --allow-escape-sequences repos/abdullahboshir/banijjik/actions/jobs/<jobId>/logs`. Git Bash needs `export PATH="$PATH:/c/Program Files/GitHub CLI"`.
- A push that changes only `docs/` runs no CI. A flaky failure (known: `sync-indexes`, `main.test`, `ordered-event-worker`, admin `auth-flow`) or a GitHub 20m runner timeout during `Build` after `Lint`, `Typecheck` and `Test` all passed gets one `gh run rerun <id> --failed`; a second failure is a real bug.
- Commit headers are not sentence-case and stay within 100 characters (commitlint). The pre-commit hook runs lint and format; fix, never bypass.
- In the `banijjik` folder never `git commit -a`: the uncommitted `.claude/settings.json` must stay out. Name the paths.
- `npm audit fix --omit=dev` removes devDependencies; run `npm install` after it.
- Stash `owner-edits-AGENTS-and-05-CONVENTIONS` belongs to the owner: never pop or drop it.
- A pipeline hides failures: never pipe a `git` command whose failure must stop the next step.
- Time-dependent tests follow `05-CONVENTIONS.md` "Testing"; run date-sensitive suites between 00:00 and 06:00 Dhaka now and then.
