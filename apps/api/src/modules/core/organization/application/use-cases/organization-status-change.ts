import {
  PLATFORM_AUDIT_TARGET_TYPE,
  type OrganizationEventType,
  type PlatformAuditAction,
} from "@banijjik/contracts";
import { recordNotFound } from "../../domain/errors.js";
import type { Organization } from "../../domain/organization.entity.js";
import type { OrganizationStatusDependencies } from "./organization-status-dependencies.js";
import type { OrganizationStatusChangeInput } from "./organization-status-change-input.js";

export interface StatusChange {
  readonly transition: (organization: Organization) => Organization;
  readonly auditAction: PlatformAuditAction;
  readonly eventType: OrganizationEventType;
}

/**
 * Moves an organization to its next status. The status, the `configVersion` bump, the platform
 * audit entry and the event are one transaction: an injected failure leaves none of them. A
 * transition the status does not allow is a 409; a stale read is a 409 too (`updateVersioned`).
 */
export async function changeStatus(
  dependencies: OrganizationStatusDependencies,
  change: StatusChange,
  input: OrganizationStatusChangeInput,
): Promise<Organization> {
  const { organizations, configVersion, unitOfWork, events, platformAudit } = dependencies;
  const existing = await organizations.findById(input.organizationId);
  if (existing === undefined) throw recordNotFound();
  const changed = change.transition(existing);
  return dependencies.contextRunner.run(input.organizationId, () =>
    unitOfWork.run(async () => {
      const saved = await organizations.updateStatus(changed, existing.version, input.actorUserId);
      await configVersion.bump(input.organizationId);
      await platformAudit.record({
        action: change.auditAction,
        targetType: PLATFORM_AUDIT_TARGET_TYPE.organization,
        targetId: input.organizationId,
        organizationId: input.organizationId,
        changes: { status: { from: existing.status, to: saved.status } },
        reason: input.reason,
      });
      await events.publish(change.eventType, { organizationId: input.organizationId });
      return saved;
    }),
  );
}
