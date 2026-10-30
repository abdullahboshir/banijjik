import { ERROR_CODE } from "@banijjik/contracts";
import { WEBSITE_EVENT_TYPE } from "@banijjik/contracts/website";
import type {
  CheckoutPrincipal,
  CheckoutRequest,
  CheckoutRequestLink,
  CheckoutResponse,
} from "@banijjik/contracts/website";
import { newId } from "@banijjik/ids";
import { AppError } from "../../../../kernel/http/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { Checkout, CheckoutAccess, CheckoutQuote } from "../domain/checkout-types.js";
import type {
  CatalogQuoteReaderPort,
  CheckoutAccessRepositoryPort,
  CheckoutQuoteRepositoryPort,
  CheckoutRepositoryPort,
  CheckoutRequestLinkRepositoryPort,
  EventPublisher,
  GuestContactPort,
  OrgStorefrontConfigReader,
  PublicBookingCommands,
  PublicEnrollmentCommands,
  PublicOrderCommands,
  UnitOfWork,
} from "./checkout-ports.js";
import { computeObjectHash, formatPrincipalKey } from "./quote-checkout.js";
import {
  assertQuoteValid,
  assertStorefrontEligible,
  checkIdempotentReplay,
  executeCommands,
} from "./submit-checkout-helpers.js";

export interface SubmitCheckoutDependencies {
  readonly quotes: CheckoutQuoteRepositoryPort;
  readonly checkouts: CheckoutRepositoryPort;
  readonly access: CheckoutAccessRepositoryPort;
  readonly requestLinks: CheckoutRequestLinkRepositoryPort;
  readonly guestContacts: GuestContactPort;
  readonly catalogQuoter: CatalogQuoteReaderPort;
  readonly orgConfig: OrgStorefrontConfigReader;
  readonly publicOrders: PublicOrderCommands;
  readonly publicBookings: PublicBookingCommands;
  readonly publicEnrollments: PublicEnrollmentCommands;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly clock: Clock;
}

interface SaveRecordsArgs {
  readonly checkoutId: string;
  readonly contactId: string;
  readonly input: {
    readonly organizationId: string;
    readonly principal: CheckoutPrincipal;
    readonly creationPrincipalKey: string;
    readonly idempotencyKeyHash: string;
    readonly inputHash: string;
    readonly quote: CheckoutQuote;
    readonly body: CheckoutRequest;
    readonly now: Date;
  };
  readonly links: readonly CheckoutRequestLink[];
}

export class SubmitCheckoutUseCase {
  constructor(private readonly deps: SubmitCheckoutDependencies) {}

  async execute(input: {
    readonly organizationId: string;
    readonly principal: CheckoutPrincipal;
    readonly idempotencyKey: string;
    readonly body: CheckoutRequest;
  }): Promise<CheckoutResponse> {
    const { organizationId, principal, idempotencyKey, body } = input;
    const creationPrincipalKey = formatPrincipalKey(principal);
    const idempotencyKeyHash = computeObjectHash(idempotencyKey);
    const inputHash = computeObjectHash(body);

    const replayed = await checkIdempotentReplay({
      checkouts: this.deps.checkouts,
      access: this.deps.access,
      requestLinks: this.deps.requestLinks,
      input: { organizationId, creationPrincipalKey, idempotencyKeyHash, inputHash, principal },
    });
    if (replayed) return replayed;

    const rawQuote = await this.deps.quotes.findById(organizationId, body.quoteId);
    const now = this.deps.clock.now();
    const quote = assertQuoteValid(rawQuote, creationPrincipalKey, now);

    const existingForQuote = await this.deps.checkouts.findByQuoteId(organizationId, body.quoteId);
    if (existingForQuote) {
      throw new AppError({ code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" });
    }

    const config = await this.deps.orgConfig.readStorefrontConfig(organizationId);
    assertStorefrontEligible(config, quote.input.locationId, quote.configVersion);

    await this.assertCatalogPriceMatch(organizationId, quote);

    return await this.executeTransaction({
      organizationId,
      principal,
      creationPrincipalKey,
      idempotencyKeyHash,
      inputHash,
      quote,
      body,
      now,
    });
  }

  private async assertCatalogPriceMatch(
    organizationId: string,
    quote: CheckoutQuote,
  ): Promise<void> {
    const currentPrice = await this.deps.catalogQuoter.priceSelections({
      organizationId,
      locationId: quote.input.locationId,
      selections: quote.input.selections,
      fulfillment: quote.input.fulfillment,
    });
    if (
      currentPrice.total.amount !== quote.pricedSnapshot.total.amount ||
      currentPrice.total.currency !== quote.pricedSnapshot.total.currency ||
      currentPrice.configVersion !== quote.configVersion
    ) {
      throw new AppError({
        code: ERROR_CODE.CHECKOUT_PRICE_CHANGED,
        messageKey: "errors.checkout_price_changed",
      });
    }
  }

  private async executeTransaction(input: {
    readonly organizationId: string;
    readonly principal: CheckoutPrincipal;
    readonly creationPrincipalKey: string;
    readonly idempotencyKeyHash: string;
    readonly inputHash: string;
    readonly quote: CheckoutQuote;
    readonly body: CheckoutRequest;
    readonly now: Date;
  }): Promise<CheckoutResponse> {
    const checkoutId = newId();
    return await this.deps.unitOfWork.run(async () => {
      const consumed = await this.deps.quotes.markConsumed({
        organizationId: input.organizationId,
        quoteId: input.body.quoteId,
        checkoutId,
        now: input.now,
      });
      if (!consumed) {
        throw new AppError({ code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" });
      }

      const contactId = await this.resolveContactId(input);
      const links = await executeCommands({
        quote: input.quote,
        body: input.body,
        commandContext: {
          organizationId: input.organizationId,
          locationId: input.quote.input.locationId,
          contactId,
          checkoutId,
          actorUserId: null,
        },
        commands: {
          publicOrders: this.deps.publicOrders,
          publicBookings: this.deps.publicBookings,
          publicEnrollments: this.deps.publicEnrollments,
        },
      });

      await this.saveRecords({ checkoutId, contactId, input, links });

      return {
        checkoutId,
        locationId: input.quote.input.locationId,
        total: input.quote.pricedSnapshot.total,
        requests: links,
      };
    });
  }

  private async resolveContactId(input: {
    readonly organizationId: string;
    readonly principal: CheckoutPrincipal;
    readonly body: CheckoutRequest;
  }): Promise<string> {
    if (input.principal.type === "GUEST") {
      return await this.deps.guestContacts.ensureProvisionalContact({
        organizationId: input.organizationId,
        guestSessionId: input.principal.guestSessionId,
        contactSnapshot: {
          name: input.body.contact.name,
          phoneE164: input.body.contact.phone,
          customFields: input.body.contact.customFields,
        },
      });
    }
    return input.principal.contactId;
  }

  private async saveRecords(args: SaveRecordsArgs): Promise<void> {
    const { checkoutId, contactId, input, links } = args;
    const checkout: Checkout = {
      checkoutId,
      organizationId: input.organizationId,
      locationId: input.quote.input.locationId,
      creationPrincipalKey: input.creationPrincipalKey,
      contactId,
      contactSnapshot: {
        name: input.body.contact.name,
        phoneE164: input.body.contact.phone,
        customFields: input.body.contact.customFields,
      },
      quoteId: input.body.quoteId,
      acceptedTotals: {
        total: input.quote.pricedSnapshot.total,
        deliveryCharge: input.quote.pricedSnapshot.deliveryCharge,
      },
      idempotencyKeyHash: input.idempotencyKeyHash,
      inputHash: input.inputHash,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
    };
    await this.deps.checkouts.save(checkout);

    const checkoutAccess: CheckoutAccess = {
      checkoutAccessId: newId(),
      organizationId: input.organizationId,
      checkoutId,
      owner:
        input.principal.type === "CUSTOMER"
          ? { type: "CUSTOMER", identifier: input.principal.customerAccountId }
          : { type: "GUEST", identifier: input.principal.guestSessionId },
      revokedAt: null,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
    };
    await this.deps.access.save(checkoutAccess);

    await this.deps.requestLinks.saveMany(
      links.map((link) => ({
        checkoutRequestLinkId: newId(),
        organizationId: input.organizationId,
        checkoutId,
        selectionIds: link.selectionIds,
        requestType: link.requestType,
        requestId: link.requestId,
        publicNumber: link.publicNumber,
        status: link.status,
        paymentRequired: link.paymentRequired,
        holdExpiresAt: link.holdExpiresAt ? new Date(link.holdExpiresAt) : null,
        createdAt: input.now,
        updatedAt: input.now,
      })),
    );

    await this.deps.events.publish(WEBSITE_EVENT_TYPE.CHECKOUT_CREATED, { checkoutId });
  }
}
