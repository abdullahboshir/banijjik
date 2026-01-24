# Backend Application DTOs

## 📌 The "Data Transfer" Layer

This folder contains Data Transfer Objects (DTOs) used within the **Application Layer**.

### 🚫 Rules and Boundaries

1. **Internal Language:** DTOs are the language of your UseCases. They should not necessarily match the external API Contracts 1:1.
2. **DTO vs Contract:**
   - **Contract (`@banijjik/contracts`):** Defines the "Published" public API.
   - **DTO:** Defines the "Internal" input/output for the UseCase.
3. **Immutability:** DTOs should be treated as immutable once created.

### ✅ Best Practices

- **Inference:** We use `z.infer<typeof Schema>` to keep DTOs in sync with validation layers, but we explicitly export them as types in this layer to define the UseCase boundary.
- **DTO to Entity:** The UseCase should map DTO data to Value Objects or Entities.

> [!IMPORTANT]
> A DTO is a "dumb" object. It should not contain any logic, methods, or business rules.
