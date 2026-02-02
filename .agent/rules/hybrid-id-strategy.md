---
description: Hybrid ID Strategy documentation for the banijjik project
---

# 🚀 Hybrid ID Strategy

This document describes the architectural decision for managing identifiers in the `banijjik` project, balancing MongoDB-native performance with future SQL portability.

## Core Principles

1.  **Domain Layer (Entities):** Uses domain-specific UUIDs (String) for all identities and relationships.
    - Examples: `userId`, `organizationId`, `membershipId`, `roleId`, `permissionId`.
    - UUIDs are generated via `crypto.randomUUID()` in the domain layer if not provided.

2.  **Infrastructure Layer (Mongoose Models):** Uses String IDs for all domain identifiers and references.
    - MongoDB's native `_id` is retained internally for its indexing and sharding benefits.
    - Relational fields (like `userId` on `OrganizationMembership`) store the domain UUID (String), not an `ObjectId`.
    - `Virtuals` are used for populate support, mapping the String ID fields.

3.  **Mappers:** Translate between domain entities and persistence models.
    - `toDomain`: Maps `doc.[entityId]` (String from DB) -> `entity.[entityId]`.
    - `toPersistence`: Maps `entity.[entityId]` -> `doc.[entityId]`.

## Benefits

- **SQL Portability:** When migrating to PostgreSQL/Prisma, the domain UUIDs will directly serve as primary/foreign keys without data transformation.
- **MongoDB Performance:** Internal `_id` (ObjectId) is retained for MongoDB's native indexing and sharding capabilities.
- **DDD Compliance:** Domain entities are pure and database-agnostic, only knowing String IDs.

## Example: OrganizationMembership Model

```typescript
const OrganizationMembershipSchema = new Schema(
  {
    userId: { type: String, ref: "User", required: true },
    organizationId: { type: String, ref: "Organization", required: true },
    roleId: { type: String, ref: "Role", required: true },
    // ...
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual for populate support
OrganizationMembershipSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "userId",
  justOne: true,
});
```

## Relevant Files

- **Entities:** `apps/backend/src/domains/core/iam/domain/entities/*.entity.ts`
- **Models:** `apps/backend/src/domains/core/[iam|organization]/infrastructure/persistence/mongoose/models/*.model.ts`
- **Mappers:** `apps/backend/src/domains/core/[iam|organization]/infrastructure/persistence/mongoose/mappers/*.mapper.ts`
