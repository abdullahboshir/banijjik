import {
  CUSTOMER_DATA_EXPORT_SECTION_KEY,
  type CheckoutExportItem,
  type CheckoutExportRequestItem,
  type CheckoutExportSection,
} from "@banijjik/contracts/contact";
import type { CustomerAccountId, OrganizationId } from "@banijjik/ids";
import type {
  CustomerDataExportParticipant,
  CustomerErasureParticipant,
  CustomerErasureResult,
} from "../../contact/index.js";
import type { Checkout, CheckoutRequestLinkRecord } from "../domain/checkout-types.js";
import type {
  CheckoutAccessRepositoryPort,
  CheckoutQuoteRepositoryPort,
  CheckoutRepositoryPort,
  CheckoutRequestLinkRepositoryPort,
} from "./checkout-ports.js";
import {
  MongoCheckoutAccessRepository,
  MongoCheckoutQuoteRepository,
  MongoCheckoutRepository,
  MongoCheckoutRequestLinkRepository,
} from "../infrastructure/mongo-checkout.repository.js";

export interface CheckoutPrivacyDependencies {
  readonly accesses: CheckoutAccessRepositoryPort;
  readonly checkouts: CheckoutRepositoryPort;
  readonly requestLinks: CheckoutRequestLinkRepositoryPort;
  readonly quotes: CheckoutQuoteRepositoryPort;
}

export function buildDefaultCheckoutPrivacyDependencies(): CheckoutPrivacyDependencies {
  return {
    accesses: new MongoCheckoutAccessRepository(),
    checkouts: new MongoCheckoutRepository(),
    requestLinks: new MongoCheckoutRequestLinkRepository(),
    quotes: new MongoCheckoutQuoteRepository(),
  };
}

function mapRequestLinkToExportItem(
  link: CheckoutRequestLinkRecord,
): CheckoutExportRequestItem {
  return {
    checkoutRequestLinkId: link.checkoutRequestLinkId,
    selectionIds: link.selectionIds,
    requestType: link.requestType,
    requestId: link.requestId,
    publicNumber: link.publicNumber,
    status: link.status,
    paymentRequired: link.paymentRequired,
    holdExpiresAt: link.holdExpiresAt !== null ? link.holdExpiresAt.toISOString() : null,
  };
}

function mapCheckoutToExportItem(
  checkout: Checkout,
  requests: readonly CheckoutExportRequestItem[],
): CheckoutExportItem {
  return {
    checkoutId: checkout.checkoutId,
    locationId: checkout.locationId,
    quoteId: checkout.quoteId,
    total: checkout.acceptedTotals.total,
    contactSnapshot: {
      name: checkout.contactSnapshot.name,
      phoneE164: checkout.contactSnapshot.phoneE164,
      customFields: checkout.contactSnapshot.customFields,
    },
    requests,
    createdAt: checkout.createdAt.toISOString(),
  };
}

function groupLinksByCheckoutId(
  rawLinks: readonly CheckoutRequestLinkRecord[],
): Map<string, CheckoutExportRequestItem[]> {
  const map = new Map<string, CheckoutExportRequestItem[]>();
  for (const rawLink of rawLinks) {
    const item = mapRequestLinkToExportItem(rawLink);
    const existing = map.get(rawLink.checkoutId);
    if (existing) {
      existing.push(item);
    } else {
      map.set(rawLink.checkoutId, [item]);
    }
  }
  return map;
}

export function buildCheckoutExportParticipant(
  dependencies: CheckoutPrivacyDependencies,
): CustomerDataExportParticipant {
  return {
    sectionKey: CUSTOMER_DATA_EXPORT_SECTION_KEY.CHECKOUT,
    async exportForAccount(input: {
      readonly organizationId: OrganizationId;
      readonly customerAccountId: CustomerAccountId;
      readonly maxRows: number;
    }): Promise<CheckoutExportSection> {
      const fetchLimit = input.maxRows + 1;
      const accesses = await dependencies.accesses.listByOwner(
        input.organizationId,
        "CUSTOMER",
        input.customerAccountId,
        { limit: fetchLimit },
      );

      const truncated = accesses.length > input.maxRows;
      const slicedAccesses = truncated ? accesses.slice(0, input.maxRows) : accesses;
      const checkoutIds = slicedAccesses.map((a) => a.checkoutId);

      if (checkoutIds.length === 0) {
        return {
          sectionKey: CUSTOMER_DATA_EXPORT_SECTION_KEY.CHECKOUT,
          checkouts: [],
          truncated: false,
        };
      }

      const [checkouts, rawLinks] = await Promise.all([
        dependencies.checkouts.findByIds(input.organizationId, checkoutIds),
        dependencies.requestLinks.listByCheckoutIds(input.organizationId, checkoutIds),
      ]);

      const linksByCheckoutId = groupLinksByCheckoutId(rawLinks);
      const checkoutItems: CheckoutExportItem[] = checkouts.map((checkout) =>
        mapCheckoutToExportItem(
          checkout,
          linksByCheckoutId.get(checkout.checkoutId) ?? [],
        ),
      );

      return {
        sectionKey: CUSTOMER_DATA_EXPORT_SECTION_KEY.CHECKOUT,
        checkouts: checkoutItems,
        truncated,
      };
    },
  };
}

export function buildCheckoutErasureParticipant(
  dependencies: CheckoutPrivacyDependencies,
): CustomerErasureParticipant {
  return {
    async eraseForAccount(input: {
      readonly organizationId: OrganizationId;
      readonly customerAccountId: CustomerAccountId;
      readonly now: Date;
    }): Promise<CustomerErasureResult> {
      const customerAccountId = input.customerAccountId;
      const organizationId = input.organizationId;

      // 1. Revoke all active CheckoutAccess records owned by this customer
      const checkoutIds = await dependencies.accesses.revokeForOwner({
        organizationId,
        ownerType: "CUSTOMER",
        identifier: customerAccountId,
        now: input.now,
      });

      // 2. Scrub contact snapshot in Checkout records
      if (checkoutIds.length > 0) {
        await dependencies.checkouts.redactContactSnapshots(organizationId, checkoutIds);
      }

      // 3. Scrub quotes associated with this customer principal
      await dependencies.quotes.scrubPrincipalQuotes(
        organizationId,
        `CUSTOMER:${customerAccountId}`,
      );

      // Financial records (orders, bookings, enrollments, request links, acceptedTotals) remain preserved
      return { forfeitedCredits: 0 };
    },
  };
}

export interface CheckoutPrivacyParticipants {
  readonly exportParticipant: CustomerDataExportParticipant;
  readonly erasureParticipant: CustomerErasureParticipant;
}

export function buildCheckoutPrivacyParticipants(
  dependencies?: Partial<CheckoutPrivacyDependencies>,
): CheckoutPrivacyParticipants {
  const resolvedDeps: CheckoutPrivacyDependencies = {
    ...buildDefaultCheckoutPrivacyDependencies(),
    ...dependencies,
  };
  return {
    exportParticipant: buildCheckoutExportParticipant(resolvedDeps),
    erasureParticipant: buildCheckoutErasureParticipant(resolvedDeps),
  };
}
