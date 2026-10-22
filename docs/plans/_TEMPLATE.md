# Plan: card <id> · <title>

Tier: T1 | T2 | T3 · Planned by: <model> · Date: <yyyy-mm-dd> · Based on commit: <sha>

## Session parts
One part, or Part A (API) and Part B (screens) as `docs/plans/parallel-sessions-guide.md` §3 says: which decisions, files and tests belong to each, and the branch names.

## Goal
One paragraph: what exists after this card that did not exist before.

## Inputs read
Docs/sections and existing code files this plan relies on.

## Decisions
Every design choice made here, with its reason. The implementer must not make new design choices. If one is needed, stop and ask.

## Files
Mark each row **owns** (only this card edits it in this wave) or **add-only** (a shared file; add lines at the end of the right block).

| Path | Create/Change | Owns / add-only | Purpose |
|---|---|---|---|

## Interfaces & types
Exact signatures (TypeScript) for public functions, ports, entities, DTOs, manifest entries, events.

## Data
Models, fields, indexes, migrations or seeds.

## Tests (must exist and pass)
- [ ] happy path …
- [ ] validation error …
- [ ] permission denied …
- [ ] cross-org denied …
- [ ] card-specific invariants …

## Out of scope
Things the implementer must NOT do in this card.

## Risks & checks
What could go wrong and how to verify it (commands, manual checks).

## Done when
Acceptance criteria, copied from the roadmap card plus anything specific.
