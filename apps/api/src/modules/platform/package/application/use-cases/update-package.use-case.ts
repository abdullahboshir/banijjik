import {
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  type LimitMap,
} from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import { diffAuditFields } from "../../../../../kernel/audit/index.js";
import { type LimitIncrements } from "../../domain/package.entity.js";
import { PackageAdminSupport } from "./package-admin-support.js";
import type { PackageDetail } from "./package-detail.js";
import { auditFieldsOf } from "./package-audit-fields.js";

export interface UpdatePackageInput {
  readonly actorUserId: UserId;
  readonly packageId: string;
  readonly version: number;
  readonly name?: string;
  readonly moduleKeys?: readonly string[];
  readonly limits?: LimitMap;
  readonly limitIncrements?: LimitIncrements;
}

/**
 * Edits the modules and limits of a package. Every save moves `Package.version`, so the package
 * catalogue version of the resolver picks the edit up within its 5 s refresh (ADR-091).
 */
export class UpdatePackageUseCase extends PackageAdminSupport {
  async execute(input: UpdatePackageInput): Promise<PackageDetail> {
    const { packages, unitOfWork, platformAudit } = this.dependencies;
    const existing = await this.requirePackage(input.packageId);
    const edited = existing.withChanges({
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.moduleKeys === undefined ? {} : { moduleKeys: input.moduleKeys }),
      ...(input.limits === undefined ? {} : { limits: input.limits }),
      ...(input.limitIncrements === undefined ? {} : { limitIncrements: input.limitIncrements }),
    });
    this.assertClosed(edited);
    const saved = await unitOfWork.run(async () => {
      const result = await packages.update(edited, input.version, input.actorUserId);
      await platformAudit.record({
        action: PLATFORM_AUDIT_ACTION.PACKAGE_UPDATED,
        targetType: PLATFORM_AUDIT_TARGET_TYPE.package,
        targetId: result.packageId,
        changes: diffAuditFields(auditFieldsOf(existing), auditFieldsOf(result)),
      });
      return result;
    });
    return this.detailOf(saved);
  }
}
