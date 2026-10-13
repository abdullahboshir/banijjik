import type { UserId } from "@banijjik/ids";
import type { UserStatus } from "@banijjik/contracts";
import type { PlatformOperator } from "../../domain/platform-operator.entity.js";

export interface PlatformOperatorListQuery {
  readonly status?: UserStatus;
  readonly page: number;
  readonly limit: number;
}

export interface PlatformOperatorPage {
  readonly items: readonly PlatformOperator[];
  readonly hasNext: boolean;
}

export interface PlatformOperatorRepository {
  findByUserId(userId: UserId): Promise<PlatformOperator | undefined>;
  findById(platformOperatorId: string): Promise<PlatformOperator | undefined>;
  list(query: PlatformOperatorListQuery): Promise<PlatformOperatorPage>;
  /** `$inc referenceVersion` on one row inside the active transaction; the updated row, or undefined. */
  touch(platformOperatorId: string): Promise<PlatformOperator | undefined>;
  insert(operator: PlatformOperator, actorUserId?: UserId): Promise<void>;
  /** Saves roles or status if `expectedVersion` is current (version + 1), else a 409 CONFLICT. */
  save(
    operator: PlatformOperator,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<PlatformOperator>;
}
