# Frontend Architecture & Type Discipline

## 📌 Consumption of Contracts

The frontend follows a "Contract-First" approach.

### 🚫 Rules and Boundaries

1. **No Type Redefinition:** Never redefine a `UserStatus` or `UserRole` enum locally. Always import from `@banijjik/contracts`.
2. **Frontend Types vs Contracts:**
   - **Contracts (`@banijjik/contracts`):** Used for API communication (Requests/Responses).
   - **Local Types:** Used for UI state, form management, and component props.
3. **Boundary Discipline:** If the backend changes a contract, the frontend build should fail, forcing a synchronization.

### ✅ Best Practices

- Use **Mappers** to convert heavy API response objects into simplified UI models if a component becomes too complex.
- Keep `src/types` reserved for UI-specific types only.

> [!TIP]
> Architecture drift starts when you "locally" fix a type that belongs in a shared package. If you need a change, update the `@banijjik/contracts` package first.
