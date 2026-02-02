---
trigger: always_on
description: Strict Domain-Driven Design (DDD) Architecture Rules
---

# 🛡️ Platinum Standard DDD Rules (NON-NEGOTIABLE)

These rules are absolute. Any deviation is considered a critical architectural failure.

## 1. The Sanctity of the Domain Layer 🏰

The **Domain Layer** (entities, value objects, policies, events, repositories interfaces) is the pure core of the application.

- **RULE 1.1:** The Domain Layer MUST NOT depend on the outside world.
  - ❌ NO imports from `@banijjik/contracts`
  - ❌ NO imports from `infrastructure` layer
  - ❌ NO imports from `application` layer
  - ❌ NO imports from `node_modules` (except utility libs like `uuid`, `zod` for internal validation, or pure helpers).
- **RULE 1.2:** The Domain MUST define its own types and enums.
  - If `UserStatus` exists in the API Contract, the Domain MUST have its own identical `UserStatus` enum.
  - **Reason:** The Domain must be able to exist even if the entire API layer is replaced with gRPC or GraphQL.

## 2. Dependency Rule (The Onion architecture) 🧅

Dependencies point **INWARDS**.

- **Infrastructure** depends on **Application** & **Domain**.
- **Application** depends on **Domain**.
- **Domain** depends on **NOTHING**.
- **PRESENTATION**

## 3. The Role of Contracts & Validation 📜

`packages/contracts` and `packages/validation` are for **External Communication** only.

### 3.1 Validation Rules 🛑

- **WHERE:** ONLY in **Controllers** (HTTP Layer).
- **HOW:** `MySchema.parse(req.body)`.
- **NEVER:** Do not use Zod schemas inside Domain Entities or Services. Domain validation should happen via Value Objects or Policies.

### 3.2 Contract Interfaces Rules 📋

- **WHERE:**
  - **Controllers:** As return types (`Promise<UserResponse>`).
  - **Use Cases:** As input arguments (`execute(request: CreateUserRequest)`).
- **NEVER:** Domain Entities must NOT implement Contract Interfaces.

## 4. Enum Policy (The Twin Rule) 👯

- **API Enum (@contracts):** Used by Frontend and Controllers.
- **Domain Enum (Local):** Used by Entities and partial business logic.
- **Mapping:** You MUST map between them in the Infrastructure layer.
  - `ProfileType (Contract)` <--> `ProfileType (Domain)`
  - _Reason:_ If the API changes "MEMBER" to "SUBSCRIBER", the Domain "MEMBER" remains untouched.

## 6. Zero-Threshold Enum & Value Object Rule 🎯

To ensure zero hardcoding and perfect type safety:

1.  **Requirement Check:** Before using any enum, type, or specific object value in the **Domain**, look for it in `packages/contracts`.
2.  **Contract-First:** If the value/enum does not exist in `contracts`, you MUST add it there first.
3.  **VO implementation:** Import the contract enum into a dedicated **Value Object (VO)** registry (following Rule 4).
4.  **Domain Usage:** Use ONLY the Domain VO registry.
5.  **Prohibition:** ❌ NEVER use string literals or hardcoded values for domain logic.

## 5. Explicit Mappers 🗺️

- **Rule:** Data never crosses layers without translation.
- **Direction:**
  - `Request DTO` -> `Domain Entity/VO` (at Controller/UseCase boundary)
  - `Domain Entity` -> `Response DTO` (at Controller boundary)
- **Location:** `infrastructure/persistence/mappers` or `application/mappers`.
