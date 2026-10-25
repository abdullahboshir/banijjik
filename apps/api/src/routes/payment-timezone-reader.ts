import { ERROR_CODE, DomainRuleError } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";

interface PaymentTimezoneReader {
  read(organizationId: OrganizationId): Promise<string>;
}

export function paymentTimezoneReader(timezones: {
  readonly read: (organizationId: OrganizationId) => Promise<string | undefined>;
}): PaymentTimezoneReader {
  return {
    read: async (organizationId: OrganizationId) => {
      const timezone = await timezones.read(organizationId);
      if (!timezone) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
      return timezone;
    },
  };
}
