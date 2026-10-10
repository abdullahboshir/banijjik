import {
  ORGANIZATION_EVENT_TYPE,
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  type OrganizationEventType,
  type PlatformAuditAction,
} from "@banijjik/contracts";
import type { OrganizationId, UserId } from "@banijjik/ids";
import type { PlatformAuditRecorder } from "../../../../../kernel/audit/index.js";
import type { ConfigVersionBumper } from "../../../../../kernel/tenancy/index.js";
import { recordNotFound } from "../../domain/errors.js";
import type { Organization } from "../../domain/organization.entity.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { OrganizationContextRunner } from "../ports/organization-context-runner.js";
import type { OrganizationStatusRepository } from "../ports/organization-status-repository.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface OrganizationStatusChangeInput {
  readonly organizationId: OrganizationId;
  /** The operator's user, recorded as the author of the change. */
  readonly actorUserId: UserId;
  readonly reason: string;
}

export interface OrganizationStatusDependencies {
  readonly organizations: OrganizationStatusRepository;
  /** `configVersion` moves with the status, so the next request resolves the organization afresh. */
  readonly configVersion: ConfigVersionBumper;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly platformAudit: PlatformAuditRecorder;
  /** The event row carries the organization, so the change runs inside its context (ADR-087). */
  readonly contextRunner: OrganizationContextRunner;
}

interface StatusChange {
  readonly transition: (organization: Organization) => Organization;
  readonly auditAction: PlatformAuditAction;
  readonly eventType: OrganizationEventType;
}

const SUSPEND: StatusChange = {
  transition: (organization) => organization.suspended(),
  auditAction: PLATFORM_AUDIT_ACTION.TENANT_SUSPENDED,
  eventType: ORGANIZATION_EVENT_TYPE.ORGANIZATION_SUSPENDED,
};

const REACTIVATE: StatusChange = {
  transition: (organization) => organization.reactivated(),
  auditAction: PLATFORM_AUDIT_ACTION.TENANT_REACTIVATED,
  eventType: ORGANIZATION_EVENT_TYPE.ORGANIZATION_REACTIVATED,
};

/**
 * Moves an organization to its next status. The status, the `configVersion` bump, the platform
 * audit entry and the event are one transaction: an injected failure leaves none of them. A
 * transition the status does not allow is a 409; a stale read is a 409 too (`updateVersioned`).
 */
async function changeStatus(
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

/** Blocks every tenant route of the organization (ORG_SUSPENDED). Called by the platform API (card 1.8a). */
export class SuspendOrganizationUseCase {
  constructor(private readonly dependencies: OrganizationStatusDependencies) {}

  execute(input: OrganizationStatusChangeInput): Promise<Organization> {
    return changeStatus(this.dependencies, SUSPEND, input);
  }
}

/** Lifts a suspension. Called by the platform API (card 1.8a). */
export class ReactivateOrganizationUseCase {
  constructor(private readonly dependencies: OrganizationStatusDependencies) {}

  execute(input: OrganizationStatusChangeInput): Promise<Organization> {
    return changeStatus(this.dependencies, REACTIVATE, input);
  }
}
