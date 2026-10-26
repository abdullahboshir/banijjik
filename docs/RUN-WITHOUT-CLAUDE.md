# Running the project without a Claude lead

For the owner and for any AI tool (Cursor, ChatGPT/Codex, Qoder, Antigravity). Written 2026-10-26, when the owner's Claude plan ended. The rules in `AGENTS.md` still apply to every tool; this file only says how the work flows without a lead session.

## 1. Roles (one tool per role per card)
| Role | Who | Does |
|---|---|---|
| Planner | strongest model you have (ChatGPT, Cursor top model) | writes `docs/plans/<card>.md` from `docs/plans/_TEMPLATE.md`; no application code |
| Implementer | any tool | follows the plan exactly, in its own folder and branch |
| Reviewer | a **different** tool than the implementer | reviews the diff against the plan, `AGENTS.md` and this file's checklist |
| Merger | the owner | merges only when every gate in §4 is green |

Rule of thumb: the tool that wrote the code never reviews it. T1 cards (money, stock, tenancy, auth, ledgers) always get a reviewer using the strongest model available.

## 2. State
Keep `docs/LEAD-STATE.md` (open branches, owner decisions, next actions) and `docs/STATUS.md` current. After every merge the owner, or a tool asked by the owner, updates both in one docs commit. Old content is replaced, not appended.

## 3. The loop for one card
1. **Pick** the next card from `docs/03-ROADMAP.md` whose plan exists in `docs/plans/` and whose dependencies are merged. One card per session. No plan yet: run the Planner prompt (§5) first.
2. **Folder:** one folder and branch per tool: `git worktree add ../banijjik-<card> -b s/<card>-<slug> origin/main`, then `npm ci`. Two tools never share a folder. At most 3 cards at once (16 GB RAM).
3. **Implement** with the Implementer prompt (§5). The tool follows `docs/plans/parallel-sessions-guide.md` §6 to §8 and ends with `npm run card:check`.
4. **Review** with the Reviewer prompt (§5), in another tool. Findings go to `docs/handoffs/<card>-review-R1.md`; the owner pastes them back to the implementer. Small leftovers (three items, an hour each) the reviewer may fix directly.
5. **Merge** (§4), then update state (§2) and delete the branch and worktree.

## 4. Merge gates (all must hold; never skip one)
- `npm run card:check` in the card folder: every line PASS.
- CI green on the branch head: `gh run list --branch <branch>`, then `gh run view <id> --json jobs`. A docs-only push runs no CI; `card:check` reads the last code commit's run.
- The plan's test list exists (names in the handoff) and the handoff lists deviations.
- Review done (T1: strongest model, with the §6 checklist; T2/T3: the merge check in `parallel-sessions-guide.md` §10).
- Branch is up to date with `origin/main`: `git merge origin/main` (never rewrite pushed history, never force-push). Rerun the `packages/contracts` tests after the merge (parallel branches bump count tests).
- Then fast-forward main: `git push origin <branch>:main` only when CI is green on that exact head. The owner does this, nobody else.

Never: `--no-verify`, pushing red CI to `main`, `git commit -a` in `banijjik` (the uncommitted `.claude/settings.json` must stay out), committing `.env`, `git stash pop/drop` (stash `owner-edits-AGENTS-and-05-CONVENTIONS` is the owner's).

## 5. Prompts (copy, fill the angle brackets)
**Planner:** "Read `AGENTS.md`, `docs/STATUS.md`, the card `<id>` row in `docs/03-ROADMAP.md`, the docs sections it names, and the current code it touches. Write `docs/plans/<id>.md` from `docs/plans/_TEMPLATE.md`: files to create or change, decisions with reasons, the full test list, edge cases, and what is out of scope. No application code. If the card is ambiguous or needs a product decision, stop and ask me."

**Implementer:** "Folder `<folder>`, branch `<branch>`. Read `AGENTS.md`, `docs/plans/parallel-sessions-guide.md` §1 to §8 and `docs/plans/<id>.md` (with its Refresh and Amendment sections). Follow the plan exactly; do not invent design. If the plan has a gap or conflicts with the code, stop and ask. Run the changed tests, lint and typecheck locally before the first push (browser suite for screens), then finish as guide §8 says. Your final message starts with `STATUS: DONE | QUESTION | BLOCKED`; DONE carries the full `card:check` output and the green CI link."

**Reviewer:** "Review branch `<branch>` of card `<id>` against `docs/plans/<id>.md`, `AGENTS.md` and `docs/05-CONVENTIONS.md`. Read the whole diff (`git diff origin/main...<branch>`), not the handoff. List findings as numbered items with file and line, severity, and a concrete failing scenario. Try to break: tenant isolation, permissions, money and stock arithmetic, idempotency, concurrency, missing tests. Say plainly if you find nothing."

## 6. T1 review checklist
- Tenant filter on every query; `organizationId` never from the body; cross-org and cross-location denied, with tests.
- Permission and entitlement enforced in the API, not only the UI.
- Money in integer minor units; no float math; ledgers append-only, mistakes fixed by reversing entries.
- Multi-document writes inside `withTransaction()`; money or stock endpoints require `Idempotency-Key`; replay returns the first result.
- External effects (SMS, courier, webhooks) go through the outbox, never inline.
- New enum, event, permission or error code is in `packages/contracts` first; request schemas in `packages/validation`.
- No `industry` reads in feature code; no hardcoded nouns; user-facing text through i18n keys (BN and EN).
- Every list is paginated (limit ≤ 100) with an index starting with `organizationId`.
- Tests: happy path, validation error, permission denied, cross-org denied.

## 7. Local environment (this PC)
- Docker Desktop runs Redis on port 6380; enable "Start Docker Desktop when you sign in".
- Test env, set in the command only: `MONGOMS_SYSTEM_BINARY="C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe" MONGOMS_VERSION_CHECK=false TEST_REDIS_URL=redis://127.0.0.1:6380 NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 NEXT_PUBLIC_BRAND_NAME=Example CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"`.
- One API test file: `npx vitest run --config src/test-support/vitest.config.ts <file>` inside `apps/api` (`--maxWorkers=1`).
- After switching branches rebuild stale packages: `npx turbo run build --filter=@banijjik/contracts` (also `validation`, `i18n`, and `apps/api` before browser suites).
- Full gate: `npm run lint`, `npm run format:check`, `VITEST_MAX_WORKERS=2 npx turbo run build typecheck test --force --env-mode=loose --concurrency=1 --continue`.
- `gh run watch` drops on this PC: poll with `gh run view <id> --json jobs`. Failed job log: `gh api --allow-escape-sequences repos/abdullahboshir/banijjik/actions/jobs/<jobId>/logs`.
- Commit subjects are not sentence-case and headers stay within 100 characters (commitlint).

## 8. Where things are
Plans `docs/plans/`, handoffs `docs/handoffs/`, ready-made owner prompts `E:/WEB-DEVELOPMENT/PROJECTS/business-platform/lead-orchestra/owner-guide/` (outside the repo; shared rules in `lead-orchestra/rules.md`), phase reviews `docs/handoffs/phase-<n>-review.md`. Phase 4 starts only after 3.40 and 3.41 merge. ADR-149 (each business website has its own design) binds the Phase 4 plans.
