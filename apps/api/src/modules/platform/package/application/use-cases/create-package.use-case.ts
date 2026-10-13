import {
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  type LimitMap,
} from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import { diffAuditFields } from "../../../../../kernel/audit/index.js";
import { Package, type LimitIncrements } from "../../domain/package.entity.js";
import { PackageAdminSupport } from "./package-admin-support.js";
import type { PackageDetail } from "./package-detail.js";
import { auditFieldsOf } from "./package-audit-fields.js";

export interface CreatePackageInput {
  readonly actorUserId: UserId;
  readonly packageKey: string;
  readonly name: string;
  readonly isAddOn: boolean;
  readonly moduleKeys: readonly string[];
  readonly limits: LimitMap;
  readonly limitIncrements: LimitIncrements;
}

/** Creates a package. A base package must be closed under `dependsOn` (10 section 3). */
export class CreatePackageUseCase extends PackageAdminSupport {
  async execute(input: CreatePackageInput): Promise<PackageDetail> {
    const { packages, unitOfWork, platformAudit, clock } = this.dependencies;
    const created = Package.create({
      packageKey: input.packageKey,
      name: input.name,
      isAddOn: input.isAddOn,
      moduleKeys: input.moduleKeys,
      limits: input.limits,
      limitIncrements: input.limitIncrements,
      now: clock.now(),
    });
    this.assertClosed(created);
    await unitOfWork.run(async () => {
      await packages.insert(created, input.actorUserId);
      await platformAudit.record({
        action: PLATFORM_AUDIT_ACTION.PACKAGE_CREATED,
        targetType: PLATFORM_AUDIT_TARGET_TYPE.package,
        targetId: created.packageId,
        changes: diffAuditFields({}, auditFieldsOf(created)),
      });
    });
    return this.detailOf(created);
  }
}
