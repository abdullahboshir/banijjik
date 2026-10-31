import { ERROR_CODE } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/pricing";
import type {
  CheckoutDetailRequestItem,
  CheckoutDetailResponse,
  CheckoutPrincipal,
  StorefrontRequestDetailResponse,
  StorefrontRequestItem,
  StorefrontRequestListQuery,
  StorefrontRequestListResponse,
} from "@banijjik/contracts/website";
import { AppError } from "../../../../kernel/http/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { CheckoutRequestLinkRecord } from "../domain/checkout-types.js";
import type {
  CheckoutAccessRepositoryPort,
  CheckoutRepositoryPort,
  CheckoutRequestLinkRepositoryPort,
} from "./checkout-ports.js";

export interface RequestStatusSnapshot {
  readonly requestId: string;
  readonly requestType: "ORDER" | "BOOKING" | "ENROLLMENT";
  readonly publicNumber: string | null;
  readonly status: string;
  readonly paymentRequired: Money;
  readonly holdExpiresAt: Date | null;
  readonly createdAt: Date;
  readonly items?: readonly StorefrontOrderItem[];
  readonly schedule?: unknown;
  readonly plan?: unknown;
  readonly fulfillment?: StorefrontOrderFulfillment;
}

export interface StorefrontOrderItem {
  readonly name: string;
  readonly quantity: number;
  readonly unitPrice: Money;
}

export interface StorefrontOrderFulfillment {
  readonly method: "INSTANT" | "PICKUP" | "COURIER" | "OWN_RIDER";
}

export interface RequestStatusReaderPort {
  readStatus(input: {
    readonly organizationId: string;
    readonly requestType: "ORDER" | "BOOKING" | "ENROLLMENT";
    readonly requestId: string;
  }): Promise<RequestStatusSnapshot | null>;
}

export interface ReadOwnRequestsDependencies {
  readonly access: CheckoutAccessRepositoryPort;
  readonly checkouts: CheckoutRepositoryPort;
  readonly requestLinks: CheckoutRequestLinkRepositoryPort;
  readonly requestStatusReader: RequestStatusReaderPort;
  readonly clock: Clock;
}

function resolveHoldExpiresAt(liveHold?: Date | null, linkHold?: Date | null): string | null {
  if (liveHold) return liveHold.toISOString();
  if (linkHold) return linkHold.toISOString();
  return null;
}

function buildDetailPayload(
  link: CheckoutRequestLinkRecord,
  live: RequestStatusSnapshot | null,
  organizationId: string,
): StorefrontRequestDetailResponse {
  if (!live) {
    return {
      requestType: link.requestType,
      requestId: link.requestId,
      checkoutId: link.checkoutId,
      organizationId,
      publicNumber: link.publicNumber,
      status: link.status,
      paymentRequired: link.paymentRequired,
      holdExpiresAt: link.holdExpiresAt ? link.holdExpiresAt.toISOString() : null,
      createdAt: link.createdAt.toISOString(),
    };
  }

  const result: StorefrontRequestDetailResponse = {
    requestType: link.requestType,
    requestId: link.requestId,
    checkoutId: link.checkoutId,
    organizationId,
    publicNumber: live.publicNumber ?? link.publicNumber,
    status: live.status,
    paymentRequired: live.paymentRequired,
    holdExpiresAt: resolveHoldExpiresAt(live.holdExpiresAt, link.holdExpiresAt),
    createdAt: link.createdAt.toISOString(),
  };

  return {
    ...result,
    ...(live.items === undefined ? {} : { items: live.items }),
    ...(live.schedule === undefined ? {} : { schedule: live.schedule }),
    ...(live.plan === undefined ? {} : { plan: live.plan }),
    ...(live.fulfillment === undefined ? {} : { fulfillment: live.fulfillment }),
  };
}

export class ReadOwnRequestsUseCase {
  constructor(private readonly deps: ReadOwnRequestsDependencies) {}

  async getCheckoutDetail(input: {
    readonly organizationId: string;
    readonly principal: CheckoutPrincipal;
    readonly checkoutId: string;
  }): Promise<CheckoutDetailResponse> {
    const accessRecord = await this.assertAccess(
      input.organizationId,
      input.checkoutId,
      input.principal,
    );

    const checkout = await this.deps.checkouts.findById(input.organizationId, input.checkoutId);
    if (!checkout) {
      throw new AppError({ code: ERROR_CODE.NOT_FOUND, messageKey: "errors.checkout_not_found" });
    }

    const links = await this.deps.requestLinks.listByCheckoutId(
      input.organizationId,
      input.checkoutId,
    );
    const requests = await Promise.all(
      links.map(async (link) => {
        const live = await this.deps.requestStatusReader.readStatus({
          organizationId: input.organizationId,
          requestType: link.requestType,
          requestId: link.requestId,
        });
        return this.mapDetailItem(link, live);
      }),
    );

    const status = requests.length > 0 && requests[0] ? requests[0].status : "SUBMITTED";

    return {
      checkoutId: checkout.checkoutId,
      organizationId: checkout.organizationId,
      locationId: checkout.locationId,
      status,
      requests,
      contactSnapshot: checkout.contactSnapshot,
      acceptedTotals: checkout.acceptedTotals.total,
      total: checkout.acceptedTotals.total,
      deliveryCharge: checkout.acceptedTotals.deliveryCharge,
      createdAt: checkout.createdAt.toISOString(),
      ownerType: accessRecord.owner.type,
      canClaim: accessRecord.owner.type === "GUEST",
    };
  }

  async listRequests(input: {
    readonly organizationId: string;
    readonly principal: CheckoutPrincipal;
    readonly query: StorefrontRequestListQuery;
  }): Promise<StorefrontRequestListResponse> {
    const principalId =
      input.principal.type === "CUSTOMER"
        ? input.principal.customerAccountId
        : input.principal.guestSessionId;

    const page = Math.max(1, input.query.page ?? 1);
    const limit = Math.min(100, Math.max(1, input.query.limit ?? 20));
    const result = await this.deps.requestLinks.listByOwner({
      organizationId: input.organizationId,
      ownerType: input.principal.type,
      identifier: principalId,
      ...(input.query.requestType ? { requestType: input.query.requestType } : {}),
      page,
      limit,
    });

    const items = await Promise.all(
      result.links.map(async (link) => {
        const live = await this.deps.requestStatusReader.readStatus({
          organizationId: input.organizationId,
          requestType: link.requestType,
          requestId: link.requestId,
        });
        return this.mapRequestItem(link, live);
      }),
    );

    return { items, total: result.total, page, limit };
  }

  async getRequestDetail(input: {
    readonly organizationId: string;
    readonly principal: CheckoutPrincipal;
    readonly requestType: "ORDER" | "BOOKING" | "ENROLLMENT";
    readonly requestId: string;
  }): Promise<StorefrontRequestDetailResponse> {
    const link = await this.deps.requestLinks.findByRequest(
      input.organizationId,
      input.requestType,
      input.requestId,
    );
    if (!link) {
      throw new AppError({ code: ERROR_CODE.NOT_FOUND, messageKey: "errors.request_not_found" });
    }

    await this.assertAccess(input.organizationId, link.checkoutId, input.principal);

    const live = await this.deps.requestStatusReader.readStatus({
      organizationId: input.organizationId,
      requestType: link.requestType,
      requestId: link.requestId,
    });

    return buildDetailPayload(link, live, input.organizationId);
  }

  private async assertAccess(
    organizationId: string,
    checkoutId: string,
    principal: CheckoutPrincipal,
  ) {
    const accessRecord = await this.deps.access.findByCheckoutId(organizationId, checkoutId);
    if (!accessRecord) {
      throw new AppError({ code: ERROR_CODE.NOT_FOUND, messageKey: "errors.checkout_not_found" });
    }
    if (accessRecord.revokedAt !== null) {
      throw new AppError({ code: ERROR_CODE.FORBIDDEN, messageKey: "errors.forbidden" });
    }

    const principalId =
      principal.type === "CUSTOMER" ? principal.customerAccountId : principal.guestSessionId;

    if (
      accessRecord.owner.type !== principal.type ||
      accessRecord.owner.identifier !== principalId
    ) {
      throw new AppError({ code: ERROR_CODE.FORBIDDEN, messageKey: "errors.forbidden" });
    }

    return accessRecord;
  }

  private mapDetailItem(
    link: CheckoutRequestLinkRecord,
    live: RequestStatusSnapshot | null,
  ): CheckoutDetailRequestItem {
    const paymentRequired = live?.paymentRequired ?? link.paymentRequired;
    return {
      requestId: link.requestId,
      requestType: link.requestType,
      publicNumber: live?.publicNumber ?? link.publicNumber,
      status: live?.status ?? link.status,
      paymentRequired,
      payableAmount: paymentRequired,
      holdExpiresAt: resolveHoldExpiresAt(live?.holdExpiresAt, link.holdExpiresAt),
    };
  }

  private mapRequestItem(
    link: CheckoutRequestLinkRecord,
    live: RequestStatusSnapshot | null,
  ): StorefrontRequestItem {
    return {
      requestType: link.requestType,
      requestId: link.requestId,
      checkoutId: link.checkoutId,
      publicNumber: live?.publicNumber ?? link.publicNumber,
      status: live?.status ?? link.status,
      paymentRequired: live?.paymentRequired ?? link.paymentRequired,
      holdExpiresAt: resolveHoldExpiresAt(live?.holdExpiresAt, link.holdExpiresAt),
      createdAt: link.createdAt.toISOString(),
      ...(live?.items ? { details: { items: live.items } } : {}),
    };
  }
}
