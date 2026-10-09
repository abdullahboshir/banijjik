# @banijjik/ids

The only ID generator in the codebase (ADR-036). Every entity ID is a UUID v7 from `newId()`.
Do not use `crypto.randomUUID`, `uuid` v4, `nanoid` or any other generator.

- `newId()`: lowercase UUID v7, monotonic inside one millisecond.
- `isUuidV7()` / `asId()`: validate a string and narrow it to a branded ID (`UserId`, `OrganizationId`, ...).
- Branded types are add-only: each card declares the ID types of its own entities.
