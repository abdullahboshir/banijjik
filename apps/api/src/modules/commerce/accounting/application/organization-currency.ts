import { ERROR_CODE, type CurrencyCode } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import { AppError } from "../../../../kernel/http/index.js";

export interface OrganizationCurrencyPort {
  read(organizationId: OrganizationId): Promise<CurrencyCode | undefined>;
}

/** Every organization has a currency from signup, so a missing one is a data error, never a default. */
export async function requireOrganizationCurrency(
  currencies: OrganizationCurrencyPort,
  organizationId: OrganizationId,
): Promise<CurrencyCode> {
  const currency = await currencies.read(organizationId);
  if (currency === undefined) throw new AppError({ code: ERROR_CODE.INTERNAL });
  return currency;
}
