import { ERROR_CODE } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import { AppError } from "../../../../kernel/http/index.js";
import { buildOrganizationTimezoneReader } from "../../../core/organization/index.js";
import type { CreditDependencies } from "../application/ports/credit-dependencies.js";

/**
 * The organization's time zone with no UTC fallback: a credit entry without its organization's
 * day must fail, not drift (3.25). Shared by the tenant router and the expiry job.
 */
export function buildRequiredTimeZoneReader(): CreditDependencies["timeZone"] {
  const organizationTimezones = buildOrganizationTimezoneReader();
  return {
    read: async (organizationId: OrganizationId) => {
      const timezone = await organizationTimezones.read(organizationId);
      if (timezone === undefined) {
        throw new AppError({ code: ERROR_CODE.NOT_FOUND, messageKey: "errors.not_found" });
      }
      return timezone;
    },
  };
}
