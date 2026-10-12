# Implementing a card with Cursor

From card 1.9d on, the owner implements cards with **Cursor**. **Claude** (Opus) writes the plans and reviews the result. This page is the working guide for the Cursor session. `AGENTS.md` stays the binding rule file; this page only says how to apply it here.

## Roles
| Who | Does | Writes |
|---|---|---|
| Claude (planner, reviewer) | plans each card just in time; reviews the branch | `docs/plans/<card>.md`, the review section of `docs/handoffs/<card>.md`, the STATUS row after merge |
| Cursor (implementer) | implements exactly one card from its plan | code, tests, `docs/handoffs/<card>.md`, its own STATUS row ("implemented (awaiting review)") |
| Owner | starts Cursor on a card, answers product questions, asks Claude to review, pushes | decisions |

## Before you start a card
1. Read `AGENTS.md`, `docs/STATUS.md` (your card's row and the rows it depends on), `docs/plans/<card>.md`, and only the doc sections the plan lists under "Inputs read".
2. Check the plan's "Based on commit". If `main` has moved and touched files the plan names, stop and ask Claude to refresh the plan.
3. Make a worktree and a branch. Never work in the main folder.
   ```
   git -C E:\WEB-DEVELOPMENT\PROJECTS\business-platform\banijjik worktree add ..\banijjik-<card> -b s/<card>-<slug> main
   cd ..\banijjik-<card>
   npm install
   ```
4. Make sure the local services are up. If they are not, start Docker Desktop and bring up only this project's stack: `docker compose -f infra/docker-compose.yml up -d` (Mongo on 27018, Redis on 6380). Never stop or change other projects' containers.

## While you implement
- **Follow the plan's decisions exactly.** A gap, a contradiction, or a needed product choice → stop and write the question in the handoff. Do not invent design. Small mechanical choices (private helper names, file splits under the size limits) are fine; list them in the handoff.
- **Fix cards** (the review-fix cards 1.9x): for each finding, first write a test that reproduces it and run it on the unchanged code. It must fail. Keep that output for the handoff. Then fix, then show it passing.
- **Never weaken a rule to make code pass:** no `eslint-disable`, no lowered limits, no skipped tests, no `--no-verify`.
- Commit in small focused steps as you go: Conventional Commits, lowercase subject, ending with a `Co-Authored-By:` line for the AI tool that helped. Never rewrite pushed or reviewed history; never `git reset` existing commits (make a new commit). Do not delete folders with `rm -rf`; use `npx rimraf` for build output you created.
- Hot shared files (contracts and validation index files, `routes/v1.ts`, i18n catalogs, `docs/04-DECISIONS.md`): add lines only.
- Never edit a real `.env` file. Pass environment values inline.

## Environment for tests on this machine
The machine runs out of memory under parallel test load, and disk is tight. Run one heavy command at a time.
```
set MONGOMS_SYSTEM_BINARY=C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe
set MONGOMS_VERSION_CHECK=false
set TEST_REDIS_URL=redis://127.0.0.1:6380
set VITEST_MAX_WORKERS=2
set NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
set NEXT_PUBLIC_BRAND_NAME=Example
set CHROME_PATH=C:/Program Files/Google/Chrome/Application/chrome.exe
```
- Never let a test download MongoDB or a browser. If you see a download start, stop it and delete `node_modules/.cache/mongodb-memory-server`.
- While iterating, run only the test files you touch (`npx vitest run --config src/test-support/vitest.config.ts <files>` inside `apps/api`).

## Done means (run all of these and paste the real output into the handoff)
```
npm run lint
npm run format:check
npx turbo run build typecheck test --force --env-mode=loose --concurrency=1
npm run test:tools
set VITEST_MAX_WORKERS=1
npm run test:browser -w @banijjik/admin      (when the card touches the admin app or the API it uses)
npm run test:browser -w @banijjik/platform   (when the card touches the platform app or its API)
```
The browser suites start a real API and app on fixed ports. With more than one worker, two stacks collide (`EADDRINUSE` or `409`), so always run them with `VITEST_MAX_WORKERS=1`. The unit and API suites use `VITEST_MAX_WORKERS=2`.
One green run with every task successful. If a run fails, report the exact failure; do not claim a pass you did not see. Remove `.next` / `.lighthouseci` you created, and leave no server running.

## Handoff
Write `docs/handoffs/<card>.md` from `docs/handoffs/_TEMPLATE.md`:
- the commit list
- per decision (or per finding): what changed, the test that proves it, and for fix cards the failing-before output
- the verify output
- every deviation from the plan with its reason
- every existing assertion you changed, with the decision or finding that required it
- what you could not verify
- open questions

Set only your card's row in `docs/STATUS.md` to `implemented (awaiting review)`. Do not merge into `main` yourself.

## Asking for review
Tell the owner the branch is ready. The owner asks Claude to review `s/<card>-<slug>`. Claude:
- re-runs the full verify on a free machine
- reads the diff against the plan and `AGENTS.md`
- for T1 cards, tries to break the security-relevant parts
- writes the review section into the handoff

Findings come back as a list. Fix them on the same branch with new commits, update the handoff, and ask again. Only after a pass does Claude (or the owner) fast-forward `main` and set the STATUS row to `merged`.
