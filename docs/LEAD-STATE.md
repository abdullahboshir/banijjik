# Lead state (planner and reviewer)

The one file a new lead session reads to continue the work. It holds what `docs/STATUS.md` does not: open branches and their review state, what waits on the owner, the next actions in order, and how the lead works.

**Rules for this file**
- The lead session updates it after every milestone (a merge, a review result, a new plan, an owner decision) and before the session ends. Commit it on a short docs branch and fast-forward `main` (see "Docs commits").
- At most about 150 lines. Replace old content; do not append history. The session log keeps only the last five sessions.
- No secrets, passwords or `.env` values.

Last updated: 2026-10-28 (midday) by Cursor (lead, `banijjik-m2`) · `origin/main` `1130cfe8` (4.1 A1+A2+F+B+C1+C2).

## 1. Where the project stands
- **Claude plan ends 2026-10-29.** Roles from `docs/RUN-WITHOUT-CLAUDE.md`. Owner still says yes to fast-forward of `main` after green CI (2026-10-28: merge F/B/C1/C2).
- Speed: `.cursor/rules/speed.mdc`. No root lint/typecheck/test/build. CI is not a debugger. Docs-only skip CI. Bring a pushed branch up to date with `git merge origin/main` (never rebase, never `--force`). `card:check` INFO when main moved is enough.
- Phase 3 F1–F4 closed. Phase 4 underway.
- **4.1 A1+A2+F+B+C1+C2 are on `main` (`1130cfe8`).** Owner merge yes; T1 written review skipped to land. CI: F [40641982603](https://github.com/abdullahboshir/banijjik/actions/runs/40641982603), B [40642554599](https://github.com/abdullahboshir/banijjik/actions/runs/40642554599), C1 [40644779757](https://github.com/abdullahboshir/banijjik/actions/runs/40644779757), C2 pre-merge [40644784153](https://github.com/abdullahboshir/banijjik/actions/runs/40644784153), C2+main [40646818269](https://github.com/abdullahboshir/banijjik/actions/runs/40646818269).
- **A3 is in another session** (`banijjik` / `s/4.1-a3-site-publication`, not on origin yet, dirty working tree). It **must `git merge origin/main`** so it picks up F/B/C1/C2. Do not rebase. Do not touch that folder from this lead.
- ADR-150: full tenant website (4.1–4.5) before the pilot. ADR-149: each business site has its own design.

## 2. Open branches (checked 2026-10-28 midday)

| Card / part | Branch | Folder | Tier | State → next step |
|---|---|---|---|---|
| 4.1 A3 | `s/4.1-a3-site-publication` | `banijjik` | T1 | implementing (unpushed); merge `origin/main` first, then finish publish |
| 4.1 A2 (merged) | `s/4.1-a2-site-design` | `banijjik-4.1-a1` | T1 | on main via C2; keep until A3 has merged main |
| 4.2 A1 | `s/4.2-a1-host-claims` | (origin) | T1 | on origin at `56dec8a3`; not this merge |
| 4.3 A0 | `s/4.3-a0-replay-boundary` | `banijjik-m8a` | T1 | on origin; not this merge |
| 4.4 A1 plan | `s/docs-plan-4.4-a1` | `banijjik-docs` | plan | do not steal this folder |

Merged this session; delete on origin: `s/4.1-a1-theme-contracts`, `s/4.1-f-website-images`, `s/4.1-b-renderer`, `s/4.1-c1-pages-api`, `s/4.1-c2-pages-ui`.

**Disk / local:** Docker Desktop + Redis 6380. Compose Mongo stays stopped. `gh run watch` drops (TLS); poll `gh run view <id> --json jobs`. Stale `dist` after branch switch: `npx turbo run build --filter=<pkg>`. Owner stack holds 3000/4000.

## 3. Waiting on the owner
- Turn on "Start Docker Desktop when you sign in".
- Product: 3.9 offline selling; M.6 listing `noindex`; keep or drop the stashed `AGENTS.md` / `05-CONVENTIONS.md` edits.
- Older: P1 rotate leaked secrets (repo is public).

## 4. Next actions, in order
1. **Do not touch `banijjik`.** A3 merges `origin/main` in its own session, then finishes publish (A3 → A3D → A3R → A3I).
2. After A3 lands: 4.2 storefront host routing (A1 already on origin), then 4.3 / 4.4 as planned.
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
- **2026-10-28 midday** (Cursor, `banijjik-m2`): owner asked to merge 4.1 F/B/C1/C2 without a full local suite. FF B (A1+F+B, `e45f0493`), then C2 after merging that main (A2+C1+C2+F/B, `1130cfe8`). A3 left for the other session.
- **2026-10-27 evening** (Cursor lead, `banijjik-m2`): 3.42 merged; Phase 3 F1–F4 closed.
- **2026-10-27 afternoon** (Cursor lead): T2 review R1 PASS for 3.43 B; merging onto main.
- **2026-10-27 late morning, 2** (Cursor lead): T1 review R1 PASS for 3.43 A; merging onto main.
- **2026-10-27 late morning** (Cursor lead): T2 merge-checked 3.41 and 3.40 B. Both on `main`.
