import type { Clock } from "../../../kernel/time/index.js";
import type { SeededOperatorAudit } from "./application/ports/seeded-operator-audit.js";
import { EnsurePlatformAdminUseCase } from "./application/use-cases/ensure-platform-admin.use-case.js";
import { Argon2PasswordHasher } from "./infrastructure/argon2-password-hasher.js";
import { MongoPlatformOperatorRepository } from "./infrastructure/mongo-platform-operator.repository.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { MongoUserRepository } from "./infrastructure/mongo-user.repository.js";

export type { SeededOperatorAudit } from "./application/ports/seeded-operator-audit.js";

/** The seed use case for the platform admin. Seeds call this instead of reaching into the module. */
export function buildEnsurePlatformAdminUseCase(
  clock: Clock,
  seededOperatorAudit: SeededOperatorAudit,
): EnsurePlatformAdminUseCase {
  return new EnsurePlatformAdminUseCase({
    users: new MongoUserRepository(),
    operators: new MongoPlatformOperatorRepository(),
    hasher: new Argon2PasswordHasher(),
    unitOfWork: new MongoUnitOfWork(),
    seededOperatorAudit,
    clock,
  });
}
