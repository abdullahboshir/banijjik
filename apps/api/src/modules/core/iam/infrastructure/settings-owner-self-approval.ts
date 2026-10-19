import { IAM_OWNER_SELF_APPROVAL_SETTING_KEY } from "@banijjik/contracts/iam";
import type { OrganizationId } from "@banijjik/ids";
import type { SettingsResolver } from "../../settings/index.js";
import type { OwnerSelfApprovalReader } from "../application/use-cases/grant-approval.use-case.js";

/** Reads `iam.approval.ownerSelfApproval` (default true from the manifest). */
export class SettingsOwnerSelfApprovalReader implements OwnerSelfApprovalReader {
  constructor(private readonly resolver: SettingsResolver) {}

  async isAllowed(organizationId: OrganizationId): Promise<boolean> {
    const resolved = await this.resolver.resolve(organizationId, {
      keys: [IAM_OWNER_SELF_APPROVAL_SETTING_KEY],
    });
    const value = resolved.get(IAM_OWNER_SELF_APPROVAL_SETTING_KEY)?.value;
    return value !== false;
  }
}
