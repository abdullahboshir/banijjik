---
name: save-state
description: Update docs/LEAD-STATE.md with the current banijjik lead state and commit it to main, so the next session can resume from that file alone.
---

Update `docs/LEAD-STATE.md` so a new session with no memory of this one can continue from it alone.

1. Rewrite, do not append:
   - "Last updated" line: today's date, model, current `main` commit and whether it is pushed
   - §2 open branches: every branch still open, with its folder, tier, state and exact next step; drop merged ones
   - §3 waiting on the owner, §4 next actions in order
   - §5 only if a working rule changed
   - §6 session log: add this session in one or two lines at the top; keep only the last five
2. Keep the file at about 150 lines or fewer. No secrets or `.env` values.
3. Commit through a docs branch, as LEAD-STATE §5 "Docs commits" says. If `docs/STATUS.md` rows changed in this session, they go in the same commit.
4. Fast-forward `main`. Push `main` only if the owner has allowed it.
5. Tell the owner in one line, in Bengali script, that the state is saved and that a new session starts with `/lead`.
