import { ERROR_CODE } from "@banijjik/contracts";
import {
  CHECKOUT_RULE_KEY,
  WEBSITE_EVENT_TYPE,
  type ClaimCheckoutResponse,
} from "@banijjik/contracts/website";
import { AppError } from "../../../../kernel/http/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type {
  CheckoutAccessRepositoryPort,
  CheckoutRepositoryPort,
  CheckoutRequestLinkRepositoryPort,
  EventPublisher,
  UnitOfWork,
} from "./checkout-ports.js";
import type { ResolveGuestSessionUseCase } from "./use-cases/resolve-guest-session.use-case.js";

export interface CustomerPhoneReaderPort {
  getVerifiedPhone(organizationId: string, customerAccountId: string): Promise<string | null>;
}

export interface ClaimCheckoutDependencies {
  readonly access: CheckoutAccessRepositoryPort;
  readonly checkouts: CheckoutRepositoryPort;
  readonly requestLinks: CheckoutRequestLinkRepositoryPort;
  readonly resolveGuestSession: ResolveGuestSessionUseCase;
  readonly customerPhoneReader: CustomerPhoneReaderPort;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly clock: Clock;
}

export interface ClaimCheckoutInput {
  readonly organizationId: string;
  readonly checkoutId: string;
  readonly guestSessionId: string;
  readonly rawSecret: string;
  readonly customerAccountId: string;
}

export class ClaimCheckoutUseCase {
  constructor(private readonly deps: ClaimCheckoutDependencies) {}

  async execute(input: ClaimCheckoutInput): Promise<ClaimCheckoutResponse> {
    if (!input.customerAccountId || !input.guestSessionId || !input.rawSecret) {
      throw new AppError({
        code: ERROR_CODE.UNAUTHENTICATED,
        messageKey: "errors.unauthenticated",
      });
    }

    await this.validateGuestSession(input);
    const accessRecord = await this.loadAndVerifyAccess(input);
    await this.verifyPhoneMatch(input);

    await this.deps.unitOfWork.run(async () => {
      const updated = await this.deps.access.updateOwner({
        organizationId: input.organizationId,
        checkoutId: input.checkoutId,
        expectedVersion: accessRecord.version,
        newOwner: {
          type: "CUSTOMER",
          identifier: input.customerAccountId,
        },
      });

      if (!updated) {
        throw new AppError({ code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" });
      }

      const transferred = await this.deps.requestLinks.transferOwner({
        organizationId: input.organizationId,
        checkoutId: input.checkoutId,
        fromOwnerType: "GUEST",
        fromOwnerIdentifier: input.guestSessionId,
        toOwner: { type: "CUSTOMER", identifier: input.customerAccountId },
        now: this.deps.clock.now(),
      });
      // The access row moved but its links did not: half-claimed checkout, roll back via CONFLICT.
      if (transferred === 0) {
        throw new AppError({ code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" });
      }

      await this.deps.events.publish(WEBSITE_EVENT_TYPE.CHECKOUT_CLAIMED, {
        checkoutId: input.checkoutId,
      });
    });

    return {
      success: true,
      checkoutId: input.checkoutId,
      customerAccountId: input.customerAccountId,
      claimedAt: this.deps.clock.now().toISOString(),
    };
  }

  private async validateGuestSession(input: ClaimCheckoutInput): Promise<void> {
    const outcome = await this.deps.resolveGuestSession.execute({
      organizationId: input.organizationId,
      guestSessionId: input.guestSessionId,
      rawSecret: input.rawSecret,
    });

    if (outcome.kind === "CROSS_ORG") {
      throw new AppError({ code: ERROR_CODE.FORBIDDEN, messageKey: "errors.forbidden" });
    }
    if (outcome.kind === "EXPIRED") {
      throw new AppError({
        code: ERROR_CODE.WEBSITE_GUEST_SESSION_EXPIRED,
        messageKey: "errors.website_guest_session_expired",
      });
    }
    if (outcome.kind === "INVALID") {
      throw new AppError({
        code: ERROR_CODE.UNAUTHENTICATED,
        messageKey: "errors.unauthenticated",
      });
    }
  }

  private async loadAndVerifyAccess(input: ClaimCheckoutInput) {
    const accessRecord = await this.deps.access.findByCheckoutId(
      input.organizationId,
      input.checkoutId,
    );
    if (!accessRecord) {
      throw new AppError({ code: ERROR_CODE.NOT_FOUND, messageKey: "errors.checkout_not_found" });
    }
    if (accessRecord.revokedAt !== null) {
      throw new AppError({ code: ERROR_CODE.FORBIDDEN, messageKey: "errors.forbidden" });
    }
    if (
      accessRecord.owner.type !== "GUEST" ||
      accessRecord.owner.identifier !== input.guestSessionId
    ) {
      throw new AppError({ code: ERROR_CODE.FORBIDDEN, messageKey: "errors.forbidden" });
    }
    return accessRecord;
  }

  private async verifyPhoneMatch(input: ClaimCheckoutInput): Promise<void> {
    const checkout = await this.deps.checkouts.findById(input.organizationId, input.checkoutId);
    if (!checkout) {
      throw new AppError({ code: ERROR_CODE.NOT_FOUND, messageKey: "errors.checkout_not_found" });
    }

    const verifiedPhone = await this.deps.customerPhoneReader.getVerifiedPhone(
      input.organizationId,
      input.customerAccountId,
    );

    if (!verifiedPhone || verifiedPhone !== checkout.contactSnapshot.phoneE164) {
      throw new AppError({
        code: ERROR_CODE.CHECKOUT_CLAIM_PHONE_MISMATCH,
        messageKey: CHECKOUT_RULE_KEY.CLAIM_PHONE_MISMATCH,
      });
    }
  }
}
