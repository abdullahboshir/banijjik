# @banijjik/config

Shared TypeScript presets. Nothing here is built or published.

- `tsconfig.base.json`: strict compiler options every package shares.
- `tsconfig.library.json`: extends the base for buildable packages (`composite`). Each package sets its own `rootDir`, `outDir` and `include`.
