import { createHash } from "node:crypto";
import { ERROR_CODE } from "@banijjik/contracts";
import type {
  CheckoutPrincipal,
  PublicQuoteRequest,
  PublicQuoteResponse,
} from "@banijjik/contracts/website";
import { newId } from "@banijjik/ids";
import { AppError } from "../../../../kernel/http/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { CheckoutQuote } from "../domain/checkout-types.js";
import type {
  CatalogQuoteReaderPort,
  CheckoutQuoteRepositoryPort,
  OrgStorefrontConfigReader,
  StorefrontOrganizationConfig,
} from "./checkout-ports.js";

export const QUOTE_TTL_SECONDS = 300; // 5 minutes

export function formatPrincipalKey(principal: CheckoutPrincipal): string {
  return principal.type === "CUSTOMER"
    ? `CUSTOMER:${principal.customerAccountId}`
    : `GUEST:${principal.guestSessionId}`;
}

export function computeObjectHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function assertStorefrontAvailable(config: StorefrontOrganizationConfig, locationId: string): void {
  if (config.isReadOnly) {
    throw new AppError({ code: ERROR_CODE.ORG_READ_ONLY, messageKey: "errors.org_read_only" });
  }
  if (config.isSuspended) {
    throw new AppError({ code: ERROR_CODE.ORG_SUSPENDED, messageKey: "errors.org_suspended" });
  }
  if (!config.checkoutEnabled) {
    throw new AppError({
      code: ERROR_CODE.CHECKOUT_NOT_AVAILABLE,
      messageKey: "errors.checkout_not_available",
    });
  }
  if (config.publicLocationIds.length > 0 && !config.publicLocationIds.includes(locationId)) {
    throw new AppError({
      code: ERROR_CODE.CHECKOUT_LOCATION_MISMATCH,
      messageKey: "errors.checkout_location_mismatch",
    });
  }
}

export interface QuoteCheckoutDependencies {
  readonly quotes: CheckoutQuoteRepositoryPort;
  readonly catalogQuoter: CatalogQuoteReaderPort;
  readonly orgConfig: OrgStorefrontConfigReader;
  readonly clock: Clock;
}

export class QuoteCheckoutUseCase {
  constructor(private readonly deps: QuoteCheckoutDependencies) {}

  async execute(input: {
    readonly organizationId: string;
    readonly principal: CheckoutPrincipal;
    readonly request: PublicQuoteRequest;
  }): Promise<PublicQuoteResponse> {
    const { organizationId, principal, request } = input;
    const storefrontConfig = await this.deps.orgConfig.readStorefrontConfig(organizationId);
    assertStorefrontAvailable(storefrontConfig, request.locationId);

    const priced = await this.deps.catalogQuoter.priceSelections({
      organizationId,
      locationId: request.locationId,
      selections: request.selections,
      fulfillment: request.fulfillment,
    });

    const now = this.deps.clock.now();
    const expiresAt = new Date(now.getTime() + QUOTE_TTL_SECONDS * 1000);
    const quoteId = newId();

    const inputSnapshot = {
      locationId: request.locationId,
      selections: request.selections,
      fulfillment: request.fulfillment,
    };

    const quote: CheckoutQuote = {
      quoteId,
      organizationId,
      principalKey: formatPrincipalKey(principal),
      input: inputSnapshot,
      inputHash: computeObjectHash(inputSnapshot),
      pricedSnapshot: {
        total: priced.total,
        lines: priced.lines,
        deliveryCharge: priced.deliveryCharge,
      },
      configVersion: priced.configVersion,
      expiresAt,
      consumedAt: null,
      consumedCheckoutId: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await this.deps.quotes.save(quote);

    return {
      quoteId,
      expiresAt: expiresAt.toISOString(),
      total: priced.total,
      lines: priced.lines,
      deliveryCharge: priced.deliveryCharge,
    };
  }
}
