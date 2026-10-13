import { ORGANIZATION_EVENT_TYPE, PLATFORM_AUDIT_ACTION } from "@banijjik/contracts";
import type { Organization } from "../../domain/organization.entity.js";
import { changeStatus, type StatusChange } from "./organization-status-change.js";
import type { OrganizationStatusDependencies } from "./organization-status-dependencies.js";
import type { OrganizationStatusChangeInput } from "./organization-status-change-input.js";

const SUSPEND: StatusChange = {
  transition: (organization) => organization.suspended(),
  auditAction: PLATFORM_AUDIT_ACTION.TENANT_SUSPENDED,
  eventType: ORGANIZATION_EVENT_TYPE.ORGANIZATION_SUSPENDED,
};

/** Blocks every tenant route of the organization (ORG_SUSPENDED). Called by the platform API (card 1.8a). */
export class SuspendOrganizationUseCase {
  constructor(private readonly dependencies: OrganizationStatusDependencies) {}

  execute(input: OrganizationStatusChangeInput): Promise<Organization> {
    return changeStatus(this.dependencies, SUSPEND, input);
  }
}
