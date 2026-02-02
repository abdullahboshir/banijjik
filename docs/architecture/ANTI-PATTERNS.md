# Anti-Patterns - DDD Monorepo

> [!CAUTION]
> এই ডকুমেন্টে বর্ণিত প্যাটার্নগুলো **কখনোই** ব্যবহার করবেন না। এগুলো আর্কিটেকচারাল ড্রিফট এবং লং-টার্ম মেইনটেনেন্স সমস্যার কারণ।

## 🚫 1. Deep Import (সবচেয়ে বড় ভুল)

### ❌ WRONG

```typescript
// Controller থেকে সরাসরি entity import
import { User } from "@/core/identity/domain/entities/user.entity";

// Application layer থেকে সরাসরি repository implementation
import { UserMongoRepository } from "@/core/identity/infrastructure/persistence/user.repository";

// Package-এর internal file থেকে import
import { UserDto } from "@banijjik/contracts/src/published/identity/user.dto";
```

### ✅ CORRECT

```typescript
// Layer index থেকে import
import { User } from "@identity/domain";

// Port/Interface import করুন, implementation নয়
import type { IUserRepository } from "@identity/domain";

// Package-এর public API ব্যবহার করুন
import { UserDto } from "@banijjik/contracts";
```

### 🧠 কেন এটা ভুল?

- **Encapsulation ভাঙে**: Internal implementation expose হয়ে যায়
- **Refactoring কঠিন**: File move করলে সব import ভেঙে যায়
- **Circular dependency**: Accidental coupling তৈরি হয়

---

## 🚫 2. Layer Boundary Violation

### ❌ WRONG

```typescript
// Domain layer থেকে infrastructure import
// domain/entities/user.entity.ts
import { UserMongoRepository } from "../../infrastructure/persistence/user.repository";

// Domain layer থেকে application layer import
// domain/policies/unique-email.policy.ts
import { CreateUserUseCase } from "../../application/use-cases/create-user.use-case";
```

### ✅ CORRECT

````typescript
### ✅ CORRECT

```typescript
// Domain-এ নিজস্ব Enum/Type Define করুন (Absolute Truth)
// domain/value-objects/user-status.vo.ts
export enum UserStatus {
  ACTIVE = "ACTIVE",
  PENDING = "PENDING"
}
````

### 🧠 কেন এটা ভুল?

- **External Dependency**: ডোমেইন লেয়ার যদি গ্লোবাল কন্ট্রাক্টের ওপর নির্ভরশীল হয়, তবে বাইরের পরিবর্তনের কারণে বিজয়ার লজিক ভেঙে যেতে পারে।
- **Absolute Truth**: ডোমেইন নিজেই নিজের টাইপ ডিফাইন করবে।

### 🧠 DDD Layer Rules

```
Domain         → Domain only (No Contracts, No Validation, No Infra)
Application    → Domain, Application, Contracts
Infrastructure → All layers
```

---

## 🚫 3. `export *` Abuse

### ❌ WRONG

```typescript
// domain/index.ts
export * from "./entities";
export * from "./value-objects";
export * from "./policies";
```

### ✅ CORRECT

```typescript
// domain/index.ts
export { User } from "./entities/user.entity";
export { Email, Password } from "./value-objects";
export { UniqueEmailPolicy } from "./policies/unique-email.policy";
export type { IUserRepository } from "./repositories/user.repository";
```

### 🧠 কেন explicit export?

- **Accidental leak prevention**: শুধু যা দরকার তাই export
- **Clear public API**: কী public তা স্পষ্ট
- **Better IDE support**: Auto-import সঠিক path দেয়

---

## 🚫 4. Shared Folder Abuse ("Shared Hell")

### ❌ WRONG

```typescript
// shared/entities/user.entity.ts ❌
// shared/business-logic/calculate-discount.ts ❌
// shared/domain/policies/pricing.policy.ts ❌
```

### ✅ CORRECT

```typescript
// shared/ শুধু technical utilities-এর জন্য
// shared/utils/date-formatter.ts ✅
// shared/middleware/error-handler.ts ✅
// shared/decorators/validate.decorator.ts ✅

// Domain logic সবসময় domain folder-এ
// core/pricing/domain/policies/discount.policy.ts ✅
```

### 🧠 Shared Folder Rules

- ✅ **Technical utilities** (logger, validator, decorators)
- ❌ **Business logic** (entities, policies, use cases)
- ❌ **Domain-specific code**

---

## 🚫 5. Cross-Domain Direct Import

### ❌ WRONG

```typescript
// identity domain থেকে organization domain-এর internal import
// core/identity/application/use-cases/create-user.use-case.ts
import { Organization } from "@/core/organization/domain/entities/organization.entity";
```

### ✅ CORRECT

```typescript
// Published contract ব্যবহার করুন
import { OrganizationDto } from "@banijjik/contracts";

// অথবা port/interface define করুন
export interface IOrganizationService {
  findById(organizationId: string): Promise<OrganizationDto>;
}
```

### 🧠 DDD Context Boundary Rule

> **Bounded Contexts communicate via Published Language (contracts), not internal implementation.**

---

## 🚫 6. Relative Path Hell

### ❌ WRONG

```typescript
import { User } from "../../../domain/entities/user.entity";
import { CreateUserDto } from "../../../../application/dto/user.dto";
```

### ✅ CORRECT

```typescript
import { User } from "@identity/domain";
import type { CreateUserDto } from "@identity/application";
```

### 🧠 Path Alias Benefits

- **Refactor-safe**: File move করলেও import ঠিক থাকে
- **Readable**: কোন layer থেকে import হচ্ছে তা স্পষ্ট
- **Tooling support**: ESLint boundaries check করতে পারে

---

## 🚫 7. Package Misuse

### ❌ WRONG

```typescript
// packages/contracts-এ runtime logic ❌
export function calculateTax(amount: number) { ... }

// libs/ folder cross-app share করা ❌
import { Logger } from '@banijjik/libs/logger';
```

### ✅ CORRECT

```typescript
// packages/contracts শুধু types + enums
export interface TaxDto {
  amount: number;
  rate: number;
}

// libs/ শুধু backend-এর জন্য
import { Logger } from "@/shared/utils/logger";
```

### 🧠 Monorepo Structure Rules

```
packages/  → Cross-app consumable (types, validation schemas)
libs/      → Backend-only technical utilities
apps/      → Application code
```

---

## 🚫 8. God Classes / God Files

### ❌ WRONG

```typescript
// user.service.ts (2000+ lines)
export class UserService {
  createUser() { ... }
  updateUser() { ... }
  deleteUser() { ... }
  sendWelcomeEmail() { ... }
  generateReport() { ... }
  calculateLoyaltyPoints() { ... }
  // ... 50 more methods
}
```

### ✅ CORRECT

```typescript
// use-cases/create-user.use-case.ts
export class CreateUserUseCase { ... }

// use-cases/update-user.use-case.ts
export class UpdateUserUseCase { ... }

// handlers/send-welcome-email.handler.ts
export class SendWelcomeEmailHandler { ... }
```

### 🧠 Single Responsibility Principle

> **One class = One reason to change**

---

## 🏁 Golden Rules (মুখস্থ করুন)

| Rule                             | Description                 |
| -------------------------------- | --------------------------- |
| ✅ **Import from index.ts only** | Deep imports forbidden      |
| ✅ **Use path aliases**          | No relative path hell       |
| ✅ **Respect layer boundaries**  | Domain never imports infra  |
| ✅ **Explicit exports**          | No `export *`               |
| ✅ **Shared = technical only**   | No business logic in shared |
| ✅ **Contracts = types only**    | No runtime logic            |
| ✅ **One responsibility**        | Small, focused classes      |

---

## 🔥 Enforcement

এই নিয়মগুলো **tooling দিয়ে enforce** করা হয়েছে:

- **ESLint boundaries**: Layer violation = compile error
- **import/no-internal-modules**: Deep import = lint error
- **package.json exports**: Internal files hidden
- **Path aliases**: Correct imports easy, wrong imports hard

> [!IMPORTANT]
> **এই প্রজেক্টে ভুল করা কঠিন, সঠিক করা সহজ।** এটাই Professional Architecture।
