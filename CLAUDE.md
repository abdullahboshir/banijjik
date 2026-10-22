@AGENTS.md

## Claude Code specifics
- Start each session with a plan: use plan mode for any card that touches more than ~5 files.
- Do not spawn subagents unless the owner asks. Read the specific files the card needs instead of broad exploration.
- Reply to the owner in Bengali script (not Banglish). Code, comments and docs stay in English.
- Lead session (plan, review, merge): the state lives in `docs/LEAD-STATE.md`. Start with the `/lead` skill and save with `/save-state` before ending (both are user-level skills in `~/.claude/skills`, so they work on any branch); implementer sessions do not edit that file.
