# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.

Last updated: 2026-10-28 (afternoon) by Cursor (lead, `banijjik-m2`) · `origin/main` `636bcdb9` (4.1 A3+A3D+A3R+A3I).

## 1. Where the project stands
- **Claude plan ends 2026-10-29.** Roles from `docs/RUN-WITHOUT-CLAUDE.md`. Owner still says yes to fast-forward of `main` after green CI.
- Speed: `.cursor/rules/speed.mdc`. No root lint/typecheck/test/build. CI is not a debugger. Docs-only skip CI. Bring a pushed branch up to date with `git merge origin/main` (never rebase, never `--force`). `card:check` INFO when main moved is enough.
- Phase 3 F1–F4 closed. Phase 4 underway.
- **4.1 A1+A2+A3+A3D+A3R+A3I+F+B+C1+C2 are on `main` (`636bcdb9`).** Owner merge yes; T1 written review skipped to land. A3 CI [40668993305](https://github.com/abdullahboshir/banijjik/actions/runs/40668993305). The dirty uncommitted copy in `banijjik` / `s/4.1-a3-site-publication` is leftover; do not merge it.
- ADR-150: full tenant website (4.1–4.5) before the pilot. ADR-149: each business site has its own design.

## 2. Open branches (checked 2026-10-28 afternoon)

| Card / part | Branch | Folder | Tier | State → next step |
|---|---|---|---|---|
| 4.1 A3 leftover | `s/4.1-a3-site-publication` | `banijjik` | T1 | stale local work; discard, do not merge |
| 4.2 A1 | `s/4.2-a1-host-claims` | (origin) | T1 | on origin at `56dec8a3`; next after 4.1 |
| 4.3 A0 | `s/4.3-a0-replay-boundary` | `banijjik-m8a` | T1 | on origin; not this merge |
| 4.4 A1 plan | `s/docs-plan-4.4-a1` | `banijjik-docs` | plan | do not steal this folder |

Merged this session: `s/4.1-a3-publish` → `main` `636bcdb9`.

**Disk / local:** Docker Desktop + Redis 6380. Compose Mongo stays stopped. `gh run watch` drops (TLS); poll `gh run view <id> --json jobs`. Stale `dist` after branch switch: `npx turbo run build --filter=<pkg>`. Owner stack holds 3000/4000.

## 3. Waiting on the owner
- Turn on "Start Docker Desktop when you sign in".
- Product: 3.9 offline selling; M.6 listing `noindex`; keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public).

## 4. Next actions, in order
1. **4.2 storefront host routing** (A1 already on origin). Needs `git merge origin/main` so it sees published-site.
2. Then 4.3 / 4.4 as planned.
3. Follow-ups (not blocking): M.6a review leftovers; M.7 B needs `directory.listing.read`; 3.5b A2 return response lacks `reversal.businessDate`.

## 5. How the lead works
- **Role:** plans, T1 reviews, merge checks, fast-forward of `main`. Reply in Bengali script; code/docs in English.
- **Merge:** `git fetch origin && git merge origin/main` on the card branch. STATUS row merged on the branch, commit, push, wait green CI (docs-only uses the last code run). Then `git push origin <branch>:main`. If rejected, main moved: merge again. Never force-push.
- **card:check** must print PASS on every line (INFO about main is fine) before a review or merge.
- **Never:** `--no-verify`, resetting existing commits, committing `.env`, `git commit -a` in `banijjik` (picks up `.claude/settings.json`).
- **Docs commits:** `git switch -c s/docs-<slug> origin/main`, commit, `git push origin HEAD:main`.
- **Local verify:** `MONGOMS_SYSTEM_BINARY="C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe"` `MONGOMS_VERSION_CHECK=false` `TEST_REDIS_URL=redis://127.0.0.1:6380`. Do not run the root suite.
- **i18n / add-only conflicts:** keep both sides; catalogs join with a comma.
- Pushing `main` is allowed after green CI (owner 2026-10-23, 2026-10-25, 2026-10-28).

## 6. Session log (last five)
- **2026-10-28 afternoon** (Cursor, `banijjik-m2`): verified the other session's A3 mix was uncommitted and pre-C1. Ported A3+A3D+A3R+A3I onto `s/4.1-a3-publish` from `origin/main`, filled lint/typecheck/HTTP gaps, green CI, FF `main` `636bcdb9`.
- **2026-10-28 midday** (Cursor, `banijjik-m2`): owner asked to merge 4.1 F/B/C1/C2 without a full local suite. FF B (A1+F+B, `e45f0493`), then C2 after merging that main (A2+C1+C2+F/B, `1130cfe8`). A3 left for the other session.
- **2026-10-27 evening** (Cursor lead, `banijjik-m2`): 3.42 merged; Phase 3 F1–F4 closed.
- **2026-10-27 afternoon** (Cursor lead): T2 review R1 PASS for 3.43 B; merging onto main.
- **2026-10-27 late morning, 2** (Cursor lead): T1 review R1 PASS for 3.43 A; merging onto main.
