---
description: Standard workflow for implementing a new feature in an existing domain
---

1.  **Context Check:**
    - Read `apps/backend/src/core/<domain>/`.
    - Identify existing models and services to avoid duplication.

2.  **Update Domain Logic:**
    - If the feature requires new business rules, update the `domain/` layer first.

3.  **Update Application Layer:**
    - Add new methods to the service in `application/`.
    - Ensure proper validation using `packages/validation`.

4.  **Update Infrastructure Layer:**
    - Modify database models or repositories if necessary.

5.  **Expose Endpoint:**
    - Update the API controller.
    - Apply appropriate permission checks (e.g., `ModuleGuard`).

6.  **Frontend Update:**
    - Navigate to `apps/frontend/`.
    - Update components or pages to reflect the new feature.
    - Ensure the UI remains fast and responsive.

7.  **Verification:**
    - Run tests if available.
    - Manually verify the feature in the browser.
