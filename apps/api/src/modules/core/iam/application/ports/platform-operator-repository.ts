import type { UserId } from "@banijjik/ids";
import type { PlatformOperator } from "../../domain/platform-operator.entity.js";

export interface PlatformOperatorRepository {
  findByUserId(userId: UserId): Promise<PlatformOperator | undefined>;
  insert(operator: PlatformOperator): Promise<void>;
}
