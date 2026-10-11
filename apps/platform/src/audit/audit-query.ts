import { PLATFORM_AUDIT_TARGET_TYPE, type PlatformAuditTargetType } from "@banijjik/contracts";
import { isUuidV7 } from "@banijjik/ids";
import { choiceParam, firstOf, hrefWith, pageParam, type RawParams } from "../lists/list-query";

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_PATH = "/audit";

export const AUDIT_TARGET_TYPES: readonly PlatformAuditTargetType[] = Object.values(
  PLATFORM_AUDIT_TARGET_TYPE,
);

export interface AuditQuery {
  targetType: PlatformAuditTargetType | undefined;
  organizationId: string | undefined;
  page: number;
}

/** The filters live in the URL. An organization id that is not an id is ignored, never sent to the API. */
export function parseAuditQuery(params: RawParams): AuditQuery {
  const organizationId = firstOf(params["organizationId"])?.trim();
  return {
    targetType: choiceParam(params["targetType"], AUDIT_TARGET_TYPES),
    organizationId: organizationId && isUuidV7(organizationId) ? organizationId : undefined,
    page: pageParam(params["page"]),
  };
}

export function auditHref(query: AuditQuery): string {
  return hrefWith(AUDIT_PATH, {
    targetType: query.targetType,
    organizationId: query.organizationId,
    page: query.page > 1 ? query.page : undefined,
  });
}

/** The API path of one page of the platform audit log. */
export function auditApiPath(query: AuditQuery): string {
  return hrefWith("/platform/audit-logs", {
    page: query.page,
    limit: AUDIT_PAGE_SIZE,
    targetType: query.targetType,
    organizationId: query.organizationId,
  });
}
