---
description: Steps to add a new domain capability (e.g., academic, appointment)
---

1.  **Analyze Domain Requirements:**
    - Identify if this is a Core capability or an Industry-specific capability.
    - Define the core entities and their relationships.

2.  **Create Domain Structure:**
    - Navigate to `apps/backend/src/core/`.
    - Create a new folder named by the **Capability** (e.g., `academic`).
    - Create subfolders: `domain`, `application`, `infrastructure`.

3.  **Implement Domain Layer:**
    - Define Entities and Value Objects inside `domain/`.
    - Ensure all entities include `organizationId`.

4.  **Implement Application Layer:**
    - Create Services and Use Cases.
    - Register the service in the module registry.

5.  **Implement Infrastructure Layer:**
    - Create Mongoose models and repositories.
    - Ensure proper indexing on `organizationId`.

6.  **Expose via API:**
    - Create controllers or resolvers in `apps/backend/src/api/`.
    - Add permission guards based on RBAC/ABAC.

7.  **Localization (I18n):**
    - Ensure all labels, messages, and errors are added to the translation files (`BN` and `EN`).
    - Use a consistent translation key pattern (e.g., `academic.exam.fail_message`).

8.  **Performance & Speed:**
    - Optimize DB queries (avoid N+1).
    - Use caching for frequently accessed static domain data.

9.  **Verification:**
    - Register the new capability in the `PlatformSettings` if it needs to be toggleable.
    - Test multi-tenant isolation (Shared vs Dedicated logic).
    - Verify translations work in both languages.
