import { ERROR_CODE } from "@banijjik/contracts";
import { asId, type OrganizationId } from "@banijjik/ids";
import { getRequestContext } from "../../../../../kernel/context/index.js";
import { AppError } from "../../../../../kernel/http/index.js";

/** The organization of the current request. A missing one is a wiring bug, never a default. */
export function activeOrganizationId(): OrganizationId {
  const organizationId = getRequestContext().organizationId;
  if (organizationId === undefined) {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.internal" });
  }
  return asId<OrganizationId>(organizationId);
}
