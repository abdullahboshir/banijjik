# Context Map & Dependency Rules

This document defines the strict boundaries and communication patterns between domains in the Banijjik Modular Monolith.

## 1. Context Relationships (Who talks to Who?)

| Downstream (Consumer) | Relationship      | Upstream (Supplier) | Reason                                                  | Communication Method             |
| :-------------------- | :---------------- | :------------------ | :------------------------------------------------------ | :------------------------------- |
| **Organization**      | Conformist        | **People**          | Organization needs User Profiles to form members.       | Domain Events / Public Service   |
| **Billing**           | Customer-Supplier | **Subscription**    | Billing generates invoices based on Subscription Plans. | Async Events / Read-Only Service |
| **Education/Gym**     | Conformist        | **Identity**        | All domains depend on Identity for Auth.                | JWT Token / Middleware           |
| **Reporting**         | Conformist        | **All Domains**     | Needs data from everywhere.                             | Read-Replica / Events            |

## 2. Dependency Rules (The Golden Rules)

### ❌ Forbidden

1.  **Direct Database Access:** `Billing` domain cannot query `People` collection directly.
2.  **Circular Dependency:** `A -> B` and `B -> A` is STRICTLY FORBIDDEN.
3.  **Deep Imports:** `import { Something } from '../../other-domain/internal-folder'` is BANNED.

### ✅ Allowed

1.  **Public API:** Import only from the `index.ts` of the domain root.
2.  **Event Bus:** Publish `UserCreatedEvent`, consume in other domains.
3.  **Shared Kernel:** Errors, Results, and IDs can be shared via `@banijjik/shared-kernel`.

## 3. Communication Patterns

### Synchronous (Direct Call)

Use only for critical read operations where consistency is required.

- _Example:_ Checking if a User exists before assigning a role.
- _Method:_ `IdentityModule.userService.exists(id)`

### Asynchronous (Event-Driven) - PREFERRED

Use for side-effects and decoupled logic.

- _Example:_ User registered -> Send Welcome Email -> Create Billing Account.
- _Method:_ `eventBus.publish(new UserRegisteredEvent({...}))`
