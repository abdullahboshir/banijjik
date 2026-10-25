import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { asId, type OrganizationId } from "@banijjik/ids";
import { getRequestContext } from "../kernel/context/index.js";

/** The organization of the running request; a missing one is a wiring fault, never a user error. */
export function activeOrganizationId(): OrganizationId {
  const { organizationId } = getRequestContext();
  if (!organizationId) throw new DomainRuleError({ code: ERROR_CODE.INTERNAL });
  return asId<OrganizationId>(organizationId);
}

export function ruleError(ruleKey: string, messageKey: string): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.BUSINESS_RULE, messageKey, details: { ruleKey } });
}
