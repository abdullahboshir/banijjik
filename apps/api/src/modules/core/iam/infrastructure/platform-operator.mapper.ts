import { asId } from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import { PlatformOperator } from "../domain/platform-operator.entity.js";
import type { PlatformOperatorDocument } from "./platform-operator.schema.js";

export function toPlatformOperatorDocument(
  operator: PlatformOperator,
  actorUserId?: string,
): PlatformOperatorDocument {
  return {
    platformOperatorId: operator.platformOperatorId,
    userId: operator.userId,
    platformRoles: [...operator.platformRoles],
    status: operator.status,
    version: operator.version,
    createdAt: operator.createdAt,
    updatedAt: operator.updatedAt,
    createdByUserId: actorUserId ?? null,
    updatedByUserId: actorUserId ?? null,
  };
}

export function toPlatformOperator(document: PlatformOperatorDocument): PlatformOperator {
  const stored = stripMongoInternals(document);
  return PlatformOperator.restore({
    platformOperatorId: stored.platformOperatorId,
    userId: asId(stored.userId),
    platformRoles: stored.platformRoles,
    status: stored.status,
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  });
}
