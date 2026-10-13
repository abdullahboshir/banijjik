import {
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  SYSTEM_REASON,
} from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import { diffAuditFields } from "../../../../../kernel/audit/index.js";
import { runAsSystem } from "../../../../../kernel/context/index.js";
import { packageInUse } from "../../domain/errors.js";
import { PackageAdminSupport } from "./package-admin-support.js";
import type { PackageDetail } from "./package-detail.js";

export interface ArchivePackageInput {
  readonly actorUserId: UserId;
  readonly packageId: string;
  readonly version: number;
}

/** Takes a package out of sale. A package that a running subscription uses cannot be archived. */
export class ArchivePackageUseCase extends PackageAdminSupport {
  async execute(input: ArchivePackageInput): Promise<PackageDetail> {
    const { packages, usage, unitOfWork, platformAudit } = this.dependencies;
    const existing = await this.requirePackage(input.packageId);
    const archived = existing.archived();
    const saved = await unitOfWork.run(async () => {
      // The usage check runs inside the transaction: archive writes the package document, and so does
      // change-package (the guard counter), so a concurrent pair conflicts and the retry checks again (ADR-093).
      // Subscriptions are tenant data: this read is the one system access of the platform package module.
      const isInUse = await runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, () =>
        usage.isInUse(input.packageId),
      );
      if (isInUse) throw packageInUse();
      const result = await packages.update(archived, input.version, input.actorUserId);
      await platformAudit.record({
        action: PLATFORM_AUDIT_ACTION.PACKAGE_ARCHIVED,
        targetType: PLATFORM_AUDIT_TARGET_TYPE.package,
        targetId: result.packageId,
        changes: diffAuditFields({ status: existing.status }, { status: result.status }),
      });
      return result;
    });
    return this.detailOf(saved);
  }
}
