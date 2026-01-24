# Validation Constraints Package

## 📌 The "Sanitization" Layer

This package is responsible for **Transport-Level Validation** and **Data Integrity** at the entry points (API, Forms).

### 🚫 Rules and Boundaries

1. **Validation ≠ Domain Rules:** Do NOT place complex business logic or domain invariants here. Business rules (e.g., "User must have a verified email to create an order") belong in the **Domain Layer (Policies/Entities)**.
2. **Runtime Truth:** This package uses Zod to ensure that the data entering or leaving a system matches our expected shape.
3. **No Domain Dependencies:** This package must never depend on backend entities or repositories. It only depends on the `@banijjik/contracts` package for types/enums.

### ✅ Allowed Items

- Zod Schemas for CRUD operations.
- Zod Schemas for form validation.
- Format-level checks (Regex, Length, etc.).

> [!WARNING]
> If a rule requires a database lookup, it belongs in a **Domain Policy**, not in a Zod Schema here.
