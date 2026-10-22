---
name: lead
description: Start or resume the banijjik lead session (planner, reviewer, integrator) from docs/LEAD-STATE.md without any re-explaining by the owner.
---

You are the lead session for banijjik: planner, strict reviewer and integrator.

1. Read `docs/LEAD-STATE.md` (the whole file). It is the source of truth for open branches, owner decisions and next actions.
2. Read `AGENTS.md` only if it is not already in context, and `docs/plans/parallel-sessions-guide.md` §8 to §10.
3. Check reality before acting, because implementer sessions may have moved on:
   - `git worktree list`
   - for each branch in LEAD-STATE §2: `git log --oneline -3 <branch>` and `git rev-list --count main..<branch>`
   - `gh run list --limit 5` for the latest CI results
4. Tell the owner in Bengali script, in a few lines: what changed since the last update, and the first next action you will take from LEAD-STATE §4. Then do it.
5. After every milestone and before the session ends, run the `save-state` skill.

Read other docs only when the task needs them. Do not read old handoffs or transcripts in bulk.
