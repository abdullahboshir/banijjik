# IAM (Identity & Access Management) Strategy

## 1. Global Role Constants

```typescript
export enum SystemRole {
  SUPER_ADMIN = "SUPER_ADMIN", // Platform Owner
  OWNER = "OWNER", // Business Owner
  ADMIN = "ADMIN", // Business Manager
  STAFF = "STAFF", // Employee
  VIEWER = "VIEWER", // Guest/External
}
```

## 2. Authorization Logic

- **RBAC:** "Has the user been assigned the 'VIEW_INVOICE' permission via their role?"
- **ABAC (Attribute-Based):** "Can the user edit this invoice if they are the one who created it?"
- **Context:** All checks must be within the `organization_id` context.

## 3. Smart Handling

- Permissions should be cached (Redis/Memory) to ensure the system is "fast".
- JWT payloads should contain `organization_id` to prevent repeated DB lookups for tenant identification.
- Support for multiple memberships: A single user identity can belong to multiple organizations with different roles.
