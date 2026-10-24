# Parallel sessions guide (many implementers at once)

Written by: Opus 5.5 (Claude, lead planner) · Date: 2026-10-22 · Based on commit: `main 9016a0f`

Binding for every plan written from 2026-10-22 on and for every implement session (Cursor, Claude Code, Qoder, cloud agents). `AGENTS.md` and the phase lanes file still apply; this guide replaces their parts about local verification and finishing.

## 1. Why this guide exists
Up to wave 3, most session time went to work that came after the code:
- full local test runs of 30 to 40 minutes on a machine that runs one heavy suite at a time
- reruns after every fix
- rebase conflicts in shared files (routes, contracts index, i18n catalogs)
- review rounds that found missing tests, uncommitted files or a half-done screen part

The rules below move the full verification to GitHub CI, make cards small enough to finish in one sitting, and give every session the same finish checklist.

## 2. Capacity: how many sessions can really run
Two limits decide it. More chats than either limit allows only creates waiting and conflicts.

**Machine (local folders).** Every local folder needs its own `node_modules` (about 0.9 GB) plus build output, and the disks are nearly full (2026-10-22: E: 5.5 GB free, C: 4.3 GB free). So:
- **local:** at most the four existing folders (`banijjik`, `banijjik-1.7b`, `banijjik-lead`, `banijjik-m2`) plus the light `banijjik-docs` folder for plans
- **more sessions:** only as **cloud agents** (Cursor cloud agents or Claude Code on the web), which work on a GitHub branch on their own machine and need no local disk
- a fifth local folder needs at least 3 GB freed first

**Dependencies (cards ready to start).** A card can start only when the cards it builds on are merged. Section 9 lists what is ready. When fewer cards are ready than sessions, the extra sessions wait; they do not start a card early.

## 3. Card shape
1. **One layer per session.** A card with screens is planned in two **parts**, each one session and one branch:
   - **Part A, API:** contracts, validation, the module, routes registration, grants, API tests, doc rows, ADR
   - **Part B, screens:** `apps/admin` (or `apps/platform`), i18n keys, unit and browser tests
   - Part B starts after Part A is **merged**, because its browser test needs the real API. Meanwhile that session takes another ready card.
2. **Size:** a part should touch about 25 files or fewer and one module folder. A **T1** part: about 15 production files (tests not counted), because review rounds grow with the diff (3.8 R1 had 20 findings). A bigger part is split again when it is planned (A1, A2).
3. **Names:** card `3.5a` gives branches `s/3.5a-api-orders` and `s/3.5a-ui-orders`, handoffs `docs/handoffs/3.5a-api.md` and `docs/handoffs/3.5a-ui.md`. The card keeps one STATUS row; each part writes its own line in that row's note.
4. **Plans** list the parts in a "Session parts" section near the top: which decisions and tests belong to each part.

## 4. File ownership
Every plan's Files table says which files the card **owns** (only it edits them in this wave) and which shared files it **adds lines to**.

**Shared add-only files.** Add lines at the end of the right block. Never reorder, reformat or rename anything in them:
- `packages/contracts` index files, `package.json` `exports`, `eslint/restrictions.mjs` domain exception, `scripts/new-module/new-module.test.mjs` aliases
- `packages/validation` index files and `package.json` `exports`
- `apps/api/src/routes/*` (one `register…` line or one router entry per module), `system-role-grants.ts`, `module-registry.ts`
- `packages/i18n` catalogs
- `docs/04-DECISIONS.md`, `docs/09`, `docs/14`, `docs/STATUS.md` (your own row only)

**Never in a card session:**
- refactor or move a shared file, even when it is long (for example `routes/v1.ts` or the router builders); the lead plans a chore card instead
- edit another card's module folder
- edit `AGENTS.md`, `docs/plans/**`, `docs/05-CONVENTIONS.md` or `.github/**`; propose the change in the handoff instead

**New contracts or validation exports** go through the card's own subpath (`@banijjik/contracts/<module>`, `@banijjik/validation/<module>`), never the root index (it is at its 300-line cap).

## 5. Folder setup
**Local folder** (one chat per folder, always):
```
git worktree list                    # see which folder has which branch
cd <your folder>
git status                           # must be clean; if not, stop and tell the owner
git switch -c s/<card>-<part>-<slug> main
npm install
npx turbo run build --filter="./packages/*"
```
**Cloud agent:** start it on the GitHub repository with the branch name above, created from the latest pushed `main`. It follows the same prompt (section 6).

## 6. The implement prompt (owner copies it, fills the angle brackets)
```
Read AGENTS.md, docs/plans/parallel-sessions-guide.md and docs/plans/<card>.md.
IMPLEMENT card <card>, part <A (API) | B (screens)>, exactly as the plan says.
Branch: s/<card>-<api|ui>-<slug> from main. Folder: <folder or "cloud">.
Only touch the files the plan lists for this part. Stop and ask if the plan has a gap or conflicts with the code.
Commit after each step. Run only the fast local checks of the guide, section 7.
For a T1 card, walk the guide, section 11, before the handoff.
Finish with every step of the guide, section 8. Report "done" only with the full `npm run card:check` output.
```

## 7. Checks while working (fast, local)
Run these often; each takes seconds to a few minutes:
- typecheck of what you touched: `npx turbo run typecheck --filter=@banijjik/api` (or `@banijjik/admin`, a package name)
- lint of what you touched: `npx eslint <changed files>`
- formatting: `npx prettier --check <changed files>`
- your tests only:
  - API: `npm test -w @banijjik/api -- src/modules/<area>/<module>` (the test environment variables from the README)
  - admin unit: `npm test -w @banijjik/admin -- src/<folder>`
- one browser test file, only for Part B and only in a local folder: `npm run test:browser -w @banijjik/admin -- src/<folder>/<file>.browser.test.ts`

Do **not** run the whole suite locally. CI runs it on every push (section 8). The one exception is the lead's integration check of several branches together, which needs the lead's "go" (one heavy run at a time on this machine).

## 8. Finish checklist (every step, in this order)
A session is finished only when all of these hold. "Done" without a green CI run is not done.
1. Every test the plan lists for this part exists. Their names go in the handoff.
2. Every change is committed. `git status` shows nothing.
3. Rebase on the latest main: `git rebase main` (local) or onto `origin/main` (cloud). Resolve conflicts in add-only files by keeping both sides.
4. Push the branch: `git push -u origin <branch>`. Pushing card branches needs no extra permission (owner, 2026-10-22). **Never push `main`.**
5. CI runs on the push. Wait for it: `gh run watch` or `gh run list --branch <branch>`. If it fails, read `gh run view <run> --log-failed`, fix, commit, push again.
6. Write `docs/handoffs/<card>-<api|ui>.md`:
   - what was built, file by file area
   - deviations from the plan, with the reason (or "none")
   - test names
   - the green CI run link
   - known gaps (they also go in the STATUS note)
   - T1 only: the section 11 table (item → test name or file, or "n/a" with a reason)
7. Update your own STATUS row: `implemented (awaiting review), part <A|B>, CI <run link>`.
8. Commit and push the handoff and STATUS. CI must be green on this last push too.
9. Run `npm run card:check` after that CI run is green. Every line must say PASS. Paste the whole output into the "done" message. A "done" without this output is not done, and the lead does not start a review.

## 9. Ready board (2026-10-24 afternoon)
| Card / part | Ready? | Waits for | Tier | Folder |
|---|---|---|---|---|
| 3.24 order and stock posting | running | | T1 | `banijjik-3.5a` |
| 3.5a Part B order screens | now (plan Refresh 2) | | T2 | `banijjik-m2` |
| 3.6b Part B rental and event screens | now (plan Refresh 3) | | T2 | `banijjik-1.7b` |
| 3.7 Part B enrollment screens | now (plan Refresh 2) | | T2 | `banijjik-lead` |
| 3.11 Part B commission screens | now (plan Refresh B) | | T2 | `banijjik-3.11` |
| M.7 A2 blocks, erasure, data export | now (plan Refresh A2) | | T1 | `banijjik-3.6b-a3` |
| M.7 B report screens | now (plan Refresh B) | | T2 | `banijjik` |
| 3.35 stable replay-then-follow test | now | | T3 | any free folder, or a lead subagent |
| 3.33 event sessions occupy resources | the lead plans it next | | T1 | |
| 3.34 reversal after a closed request (option) | after 3.24 merges (plan ready) | 3.24 | T1 | |
| M.6 storefront | the lead plans it after 3.33 | | T1 / T2 | |
| 3.31 enrollment revenue posting, 3.32 enrollment cancel refunds | planned when 3.24 merges | 3.24 | T1 | |
| 3.5b returns, 3.9 POS, 3.11 C | planned when 3.5a B and 3.24 merge | | T1 | |
| M.8b, M.9 | planned as their inputs merge | | | |
| 3.10 reports, then the phase review | last | everything above | | |

The lead updates this board after each merge.

## 10. Review and merge (lead)
- **CI green on the branch head** is the entry ticket. The lead does not rerun the full suite for a single card.
- **Part A of a T1 card:** strict Opus review of the risky files only (domain rules, use cases that touch money, stock, credits or concurrency, tenancy and permission wiring, migrations), plus the plan's test list.
- **Part B and T2/T3 cards:** merge check: diff against the plan, the handoff's deviations, route sizes from the CI build log.
- **Merging:** the lead rebases the branch on main, waits for green CI on the rebased head, fast-forwards main and pushes main (with the owner's permission).
- **Several branches at once:** merged one by one in the order they pass; each later branch is rebased and must be green again.
- Findings go back to the same session as a numbered list. The session fixes them, pushes, and reports the new CI run.
- **Entry ticket for a review:** the session's "done" message carries a `npm run card:check` output with every line PASS. The lead reruns `npm run card:check` in that folder (or checks the same facts for a cloud branch) before reading the diff.
- **Small leftovers, no new round (owner, 2026-10-23):** when a re-review leaves at most three small items (each about an hour or less, no design choice), the lead fixes them on the branch, waits for green CI and merges. Only blockers and design gaps go back to the session.

## 11. T1 self-review checklist (implementer, before the handoff)
These are the findings that came back in the 3.7, 3.8 and M.5 reviews. Walk every line and put the table in the handoff (item → test name or file, or "n/a" with a reason). The lead reviews against the same list.

**Money, credit and ledgers**
1. Every balance change writes its ledger entry, and the result of every balance call is checked. A failed adjust stops the use case.
2. Limits (refund, allocation, stock, credits) are read and checked inside the same transaction as the write, with the session. A double action (reverse twice, refund twice) is stopped by a unique index, not only by a read.
3. Currency is compared, never assumed. A setting or threshold in another currency fails safe (asks for approval or refuses). No `"BDT"` literal.
4. A percentage is clamped to 0–100, and 0 means none.
5. Reversals undo everything the original wrote (every journal, store credit, refunds).

**Concurrency and retries**
6. Updates use `version`. A stale version returns 409. A repository never turns an unknown error into `false` or `null`.
7. A money-, credit- or stock-creating POST replays: the same `Idempotency-Key` (and the natural key, such as a transaction reference) returns the first response, not an error and not a second record.

**Scheduled jobs**
8. One bad row never stops the loop: catch per row, log with the row id, continue. A row that staff changed meanwhile (409) is skipped.
9. Rows are read and processed one keyset batch at a time, never collected into one array.
10. A job never depends on running at one exact minute. It catches up: "on or after the due time", and a rerun does nothing twice.
11. Every state has a way out. Check each state: what moves a record out of it, and is that path tested (no member frozen forever, no future start that never activates).
12. Settings read inside a job really resolve outside a request (see STATUS: the scheduled-job settings gap).

**Dates and clocks**
13. A business date is the organization's local date, never the UTC date. Payments, jobs and reports between 00:00 and 06:00 Dhaka time are the usual bug.
14. Tests that depend on the date use a fixed clock (`vi.useFakeTimers()` + `vi.setSystemTime(...)`) or compute dates in the organization's timezone, and one test covers a time between 00:00 and 06:00 Dhaka time.

**Security and tenancy**
15. User input that reaches `$regex` is escaped and anchored. No unbounded case-insensitive search.
16. No secret, token or part of one is stored, logged or returned.
17. Rules ask for permission keys, never role keys.
18. Location-owned data is registered with LOCATION tenancy and has a cross-location test. Every route param is read and checked.

**Code and records**
19. No `as unknown as` or other casts in production code (job wiring included). Narrow a use case's dependencies with `Pick<...>` so a test can pass only what it uses; a cast partial fake in a unit test is the last resort.
20. No optional dependency that silently changes behaviour when it is missing. Make it required.
21. Event names, posting keys, error codes and audit actions come from contracts. None is built at runtime.
22. Schemas carry the audit fields and `version`, with indexes that start with `organizationId`. Validation schemas carry no message literals.
23. Other modules are imported only through their `index.ts`, and an `index.ts` exports no infrastructure class.
24. Each plan test exists under its name, and its body checks what the name promises. The ADR, doc notes and handoff match the code.
