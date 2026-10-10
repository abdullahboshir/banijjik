import { models } from "../../../../kernel/db/index.js";
import type {
  PlatformAuditLogPage,
  PlatformAuditLogQuery,
  PlatformAuditLogRepository,
} from "../application/ports/platform-audit-log-repository.js";
import { toPlatformAuditLog } from "./platform-audit-log.mapper.js";
import {
  PLATFORM_AUDIT_LOG_MODEL_NAME,
  type PlatformAuditLogDocument,
} from "./platform-audit-log.schema.js";

const LIST_SORT = { occurredAt: -1, platformAuditLogId: -1 } as const;

function occurredAtRange(query: PlatformAuditLogQuery): {
  occurredAt?: { $gte?: Date; $lte?: Date };
} {
  if (query.from === undefined && query.to === undefined) return {};
  return {
    occurredAt: {
      ...(query.from === undefined ? {} : { $gte: query.from }),
      ...(query.to === undefined ? {} : { $lte: query.to }),
    },
  };
}

function toFilter(query: PlatformAuditLogQuery): Record<string, unknown> {
  return {
    ...(query.targetType === undefined ? {} : { targetType: query.targetType }),
    ...(query.organizationId === undefined ? {} : { organizationId: query.organizationId }),
    ...(query.actorPlatformOperatorId === undefined
      ? {}
      : { actorPlatformOperatorId: query.actorPlatformOperatorId }),
    ...occurredAtRange(query),
  };
}

/** The platform audit log belongs to the platform, not to a tenant: the model has tenancy NONE. */
export class MongoPlatformAuditLogRepository implements PlatformAuditLogRepository {
  async list(query: PlatformAuditLogQuery): Promise<PlatformAuditLogPage> {
    // One extra row tells whether another page exists, without counting the collection.
    const documents = await models({})
      .get<PlatformAuditLogDocument>(PLATFORM_AUDIT_LOG_MODEL_NAME)
      .find(toFilter(query))
      .sort(LIST_SORT)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit + 1)
      .lean<PlatformAuditLogDocument[]>();
    return {
      items: documents.slice(0, query.limit).map(toPlatformAuditLog),
      hasNext: documents.length > query.limit,
    };
  }
}
