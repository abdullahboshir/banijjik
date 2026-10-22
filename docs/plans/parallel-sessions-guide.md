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
2. **Size:** a part should touch about 25 files or fewer and one module folder. A bigger part is split again when it is planned.
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
Finish with every step of the guide, section 8, and report the CI run link and result.
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
7. Update your own STATUS row: `implemented (awaiting review), part <A|B>, CI <run link>`.
8. Commit and push the handoff and STATUS. CI must be green on this last push too.

## 9. Ready board (2026-10-22)
| Card / part | Ready? | Waits for | Tier |
|---|---|---|---|
| **3.14** CI for every card branch | **now, first** | | T2 |
| 3.6 booking core | running (`banijjik-lead`) | R1 fixes | T1 |
| 3.8b bookkeeping | running (`banijjik`) | | T1 |
| M.3 moderation screens | running (`banijjik-1.7b`) | | T2 |
| M.4 credits | running (`banijjik-m2`) | review fixes B1, B2 | T1 |
| **3.5a** orders, part A (API) | **now** | | T1 |
| 3.5a orders, part B (screens) | after 3.5a-A merges | 3.5a-A | T2 |
| 3.8 payments, part A | after 3.6 merges; the lead refreshes the plan first | 3.6 | T1 |
| 3.7 enrollment, part A | after 3.6 merges; the lead refreshes the plan first | 3.6 | T1 |
| 3.6b rental and event bookings | after 3.6 merges (plan then) | 3.6 | T1 |
| M.5 credit purchases, part A | after M.4 merges | M.4 | T1 |
| 3.8 and 3.7 part B, M.5 part B | after their part A merges | | T2 |
| 3.5b returns, 3.9 POS, 3.11 commission, M.6 | planned when their inputs merge | 3.5a, 3.8, M.5 | |

The lead updates this board after each merge.

## 10. Review and merge (lead)
- **CI green on the branch head** is the entry ticket. The lead does not rerun the full suite for a single card.
- **Part A of a T1 card:** strict Opus review of the risky files only (domain rules, use cases that touch money, stock, credits or concurrency, tenancy and permission wiring, migrations), plus the plan's test list.
- **Part B and T2/T3 cards:** merge check: diff against the plan, the handoff's deviations, route sizes from the CI build log.
- **Merging:** the lead rebases the branch on main, waits for green CI on the rebased head, fast-forwards main and pushes main (with the owner's permission).
- **Several branches at once:** merged one by one in the order they pass; each later branch is rebased and must be green again.
- Findings go back to the same session as a numbered list. The session fixes them, pushes, and reports the new CI run.
