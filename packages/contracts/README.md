# @banijjik/contracts

Single source of truth for enums, statuses, permission keys, module keys, error codes and event names.
Add a new one here first, then use it elsewhere (`docs/05-CONVENTIONS.md`, "Contracts").

- `defineEnum(["A", "B"])` builds the `{ A: "A", B: "B" }` constant. Derive the type with `(typeof X)[keyof typeof X]`.
- This package imports nothing, so the domain layer may depend on it.
