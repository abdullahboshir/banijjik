import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type {
  AuditLogPage,
  AuditLogQuery,
  AuditLogRepository,
} from "../application/ports/audit-log-repository.js";
import { toAuditLog } from "./audit-log.mapper.js";
import { AUDIT_LOG_MODEL_NAME, type AuditLogDocument } from "./audit-log.schema.js";

const LIST_SORT = { occurredAt: -1, auditLogId: -1 } as const;

function occurredAtRange(query: AuditLogQuery): { occurredAt?: { $gte?: Date; $lte?: Date } } {
  if (query.from === undefined && query.to === undefined) return {};
  return {
    occurredAt: {
      ...(query.from === undefined ? {} : { $gte: query.from }),
      ...(query.to === undefined ? {} : { $lte: query.to }),
    },
  };
}

function toFilter(query: AuditLogQuery): Record<string, unknown> {
  return {
    ...(query.entityType === undefined ? {} : { entityType: query.entityType }),
    ...(query.entityId === undefined ? {} : { entityId: query.entityId }),
    ...(query.actorUserId === undefined ? {} : { actorUserId: query.actorUserId }),
    ...occurredAtRange(query),
  };
}

/** Audit entries are tenant data: the tenant plugin adds the organization filter to every query (ADR-087). */
export class MongoAuditLogRepository implements AuditLogRepository {
  async list(query: AuditLogQuery): Promise<AuditLogPage> {
    // One extra row tells whether another page exists, without counting the collection.
    const documents = await models({})
      .get<AuditLogDocument>(AUDIT_LOG_MODEL_NAME)
      .find(toFilter(query), null, sessionOption(getActiveSession()))
      .sort(LIST_SORT)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit + 1)
      .lean<AuditLogDocument[]>();
    return {
      items: documents.slice(0, query.limit).map(toAuditLog),
      hasNext: documents.length > query.limit,
    };
  }
}
