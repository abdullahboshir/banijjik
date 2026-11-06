import type { Money } from "@banijjik/contracts/pricing";
import type { FulfillmentMethod } from "@banijjik/contracts/sales";
import type { DeliveryAddress } from "@banijjik/contracts/sales/delivery";
import type { OrganizationId } from "@banijjik/ids";
import {
  deliveryZoneCurrencyMismatch,
  deliveryZoneUnavailable,
} from "../domain/errors.js";
import type { DeliveryZoneRepository } from "./ports/delivery-zone.repository.js";
import { isDeliveryFulfillment } from "./sales-transition-shared.js";

export interface DeliveryFeeResolverPorts {
  readonly deliveryZones: DeliveryZoneRepository;
}

function zeroFee(currency: Money["currency"]): {
  readonly deliveryZoneId: null;
  readonly fee: Money;
} {
  return { deliveryZoneId: null, fee: { amount: 0, currency } };
}

/**
 * COURIER/OWN_RIDER + address prices from the active zone; a null address or PICKUP/INSTANT is
 * `{null, 0}`. The fee Money is returned in `input.currency` or the call refuses: no zone in another
 * currency is ever re-stamped (D3, `422 DELIVERY_ZONE_CURRENCY_MISMATCH`).
 */
export async function resolveDeliveryFee(
  ports: DeliveryFeeResolverPorts,
  input: {
    readonly organizationId: OrganizationId;
    readonly method: FulfillmentMethod;
    readonly address: DeliveryAddress | null;
    readonly currency: Money["currency"];
  },
): Promise<{ readonly deliveryZoneId: string | null; readonly fee: Money }> {
  if (!isDeliveryFulfillment(input.method) || input.address === null) {
    return zeroFee(input.currency);
  }
  const zone = await ports.deliveryZones.findActiveByAreaCode({
    organizationId: input.organizationId,
    areaCode: input.address.areaCode,
  });
  if (zone === undefined) throw deliveryZoneUnavailable(input.address.areaCode);
  if (zone.fee.currency !== input.currency) {
    throw deliveryZoneCurrencyMismatch(input.address.areaCode);
  }
  return { deliveryZoneId: zone.deliveryZoneId, fee: zone.fee };
}
