# Backend Kernel Integrity (Shared Folder)

## 🏗️ The "Strict Technical" Zone

The `apps/backend/src/shared/` folder is reserved for **Cross-Cutting Concerns** and **Technical Infrastructure**.

### 🚫 Forbidden Items (DO NOT PLACE HERE)

- **No Entity:** Entities belong to their respective Domains.
- **No UseCase:** UseCases are Bounded Context specific.
- **No Business Logic:** Logic like `calculateTax()` or `validateUser()` must stay in a Domain.
- **No Domain Events:** These reside in the Domain layer.

### ✅ Allowed Items

- **Kernel/Base Classes:** `BaseEntity`, `ValueObject` base classes.
- **Technical Utils:** `DateFormatter`, `GUIDGenerator`, `ArrayUtils`.
- **Global Constants:** `CORE_CONSTANTS` (e.g., pagination defaults).

> [!CAUTION]
> If you find yourself adding business-specific checks in the `shared` folder, you are creating a "Shared Hell." Stop and move it to a proper **Identity** or **Core** module.
