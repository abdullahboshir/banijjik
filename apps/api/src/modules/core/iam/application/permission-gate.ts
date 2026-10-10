import { ERROR_CODE } from "@banijjik/contracts";
import { asId, type RoleId } from "@banijjik/ids";
import type { CallerGrants, PermissionGate } from "../../../../kernel/access/index.js";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { AppError } from "../../../../kernel/http/index.js";
import { locationsGranting, type GrantMap } from "../domain/grant-map.js";
import type { PermissionCatalog } from "./permission-catalog.js";
import type { PermissionResolver } from "./permission-resolver.js";
import type { MemberAccessReader } from "./ports/member-access-reader.js";
import type { PermissionCache } from "./ports/permission-cache.js";
import type { RoleManagementRepository } from "./ports/role-management-repository.js";

export interface IamPermissionGateDependencies {
  readonly catalog: PermissionCatalog;
  readonly resolver: PermissionResolver;
  readonly cache: PermissionCache;
  readonly roles: Pick<RoleManagementRepository, "findByIds">;
  readonly members: Pick<MemberAccessReader, "findAssignments">;
}

interface CallerIdentity {
  readonly organizationId: string;
  readonly memberId: string;
  readonly accessVersion: string;
}

function readCaller(): CallerIdentity {
  const { organizationId, memberId, accessVersion } = getRequestContext();
  if (organizationId === undefined || memberId === undefined || accessVersion === undefined) {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.missing_tenant_context" });
  }
  return { organizationId, memberId, accessVersion };
}

/**
 * The kernel's PermissionGate, backed by roles and the cache. The cache key holds the member
 * version, the roles version and the catalogue hash, all read fresh for this request, so a
 * cached value can never be older than the data the request itself saw (ADR-088).
 */
export class IamPermissionGate implements PermissionGate {
  constructor(private readonly dependencies: IamPermissionGateDependencies) {}

  async locationsWith(permissionKey: string): Promise<readonly string[] | "ALL"> {
    const grantMap = await this.grantMapOfCaller();
    return locationsGranting(grantMap, permissionKey);
  }

  async describeCaller(): Promise<CallerGrants> {
    const grantMap = await this.grantMapOfCaller();
    return {
      allLocations: [...grantMap.allLocations],
      byLocation: Object.fromEntries(
        [...grantMap.byLocation].map(([locationId, keys]) => [locationId, [...keys]]),
      ),
    };
  }

  private async grantMapOfCaller(): Promise<GrantMap> {
    const { cache, catalog } = this.dependencies;
    const caller = readCaller();
    const cacheKey = `perm:${caller.organizationId}:${caller.memberId}:${caller.accessVersion}:${catalog.catalogHash}`;
    const cached = await cache.get(cacheKey);
    if (cached !== undefined) return cached;
    const resolved = await this.resolveFromDatabase(caller.memberId);
    await cache.set(cacheKey, resolved);
    return resolved;
  }

  private async resolveFromDatabase(memberId: string): Promise<GrantMap> {
    const { members, roles, resolver } = this.dependencies;
    const assignments = await members.findAssignments(memberId);
    const roleIds = [...new Set(assignments.map((assignment) => asId<RoleId>(assignment.roleId)))];
    return resolver.resolve(assignments, await roles.findByIds(roleIds));
  }
}
