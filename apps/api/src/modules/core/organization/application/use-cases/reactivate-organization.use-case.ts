import { ORGANIZATION_EVENT_TYPE, PLATFORM_AUDIT_ACTION } from "@banijjik/contracts";
import type { Organization } from "../../domain/organization.entity.js";
import { changeStatus, type StatusChange } from "./organization-status-change.js";
import type { OrganizationStatusDependencies } from "./organization-status-dependencies.js";
import type { OrganizationStatusChangeInput } from "./organization-status-change-input.js";

const REACTIVATE: StatusChange = {
  transition: (organization) => organization.reactivated(),
  auditAction: PLATFORM_AUDIT_ACTION.TENANT_REACTIVATED,
  eventType: ORGANIZATION_EVENT_TYPE.ORGANIZATION_REACTIVATED,
};

/** Lifts a suspension. Called by the platform API (card 1.8a). */
export class ReactivateOrganizationUseCase {
  constructor(private readonly dependencies: OrganizationStatusDependencies) {}

  execute(input: OrganizationStatusChangeInput): Promise<Organization> {
    return changeStatus(this.dependencies, REACTIVATE, input);
  }
}
