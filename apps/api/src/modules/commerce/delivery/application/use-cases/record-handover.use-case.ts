import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  DELIVERY_EVENT_TYPE,
  ERROR_CODE,
  type Money,
} from "@banijjik/contracts";
import type { RecordRiderCashHandoverBody } from "@banijjik/validation/delivery";
import {
  asId,
  type LocationId,
  type OrganizationId,
  type PaymentId,
  type UserId,
} from "@banijjik/ids";
import { AppError } from "../../../../../kernel/http/index.js";
import {
  paymentNotEligibleForHandover,
  riderCannotApproveOwnHandover,
} from "../../domain/errors.js";
import { RiderCashHandover } from "../../domain/rider-cash-handover.entity.js";
import type { DeliveryDependencies } from "../delivery-dependencies.js";

export interface RecordHandoverInput {
  readonly organizationId: OrganizationId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly actorUserId: UserId;
  readonly body: RecordRiderCashHandoverBody;
}

function computeGrossAmount(
  payments: readonly { readonly paymentId: PaymentId; readonly amount: Money }[],
): Money {
  const firstCurrency = payments[0]?.amount.currency;
  if (firstCurrency === undefined) {
    throw new AppError({ code: ERROR_CODE.VALIDATION_ERROR, messageKey: "errors.no_payments" });
  }

  let grossMinor = 0;
  for (const payment of payments) {
    if (payment.amount.currency !== firstCurrency) {
      throw new AppError({
        code: ERROR_CODE.BUSINESS_RULE,
        messageKey: "errors.currency_mismatch",
      });
    }
    grossMinor += payment.amount.amount;
  }
  return { amount: grossMinor, currency: firstCurrency };
}

export class RecordRiderCashHandoverUseCase {
  constructor(private readonly dependencies: DeliveryDependencies) {}

  async execute(input: RecordHandoverInput): Promise<RiderCashHandover> {
    const receivedByMemberId = await this.dependencies.members.findMemberIdForUser(
      input.organizationId,
      input.actorUserId,
    );
    if (receivedByMemberId === undefined) {
      throw new AppError({ code: ERROR_CODE.NOT_FOUND, messageKey: "errors.member_not_found" });
    }
    if (receivedByMemberId === input.body.riderMemberId) {
      throw riderCannotApproveOwnHandover();
    }

    const paymentIds = input.body.paymentIds.map((id) => asId<PaymentId>(id));
    const payments = await this.dependencies.payments.findPaymentsByIds(
      input.organizationId,
      paymentIds,
    );
    if (payments.length !== paymentIds.length) {
      const foundSet = new Set(payments.map((p) => p.paymentId));
      const missing = paymentIds.find((id) => !foundSet.has(id));
      throw paymentNotEligibleForHandover(
        missing ?? "unknown",
        "Payment not found in this organization",
      );
    }

    const locationId = payments[0]?.locationId ?? asId<LocationId>("");
    const grossAmount = computeGrossAmount(payments);
    const now = this.dependencies.clock.now();

    const handover = RiderCashHandover.record({
      organizationId: input.organizationId,
      locationId,
      riderMemberId: input.body.riderMemberId,
      receivedByMemberId,
      paymentIds: input.body.paymentIds,
      amount: grossAmount,
      receivedVia: input.body.receivedVia,
      posSessionId: input.body.posSessionId,
      businessDate: input.body.businessDate,
      actorUserId: input.actorUserId,
      now,
    });

    return this.dependencies.unitOfWork.run(async () => {
      const persisted = await this.dependencies.handovers.insert(handover);
      await this.postHandoverSideEffects(input, persisted, { paymentIds, now });
      return persisted;
    });
  }

  private async postHandoverSideEffects(
    input: RecordHandoverInput,
    persisted: RiderCashHandover,
    opts: { paymentIds: readonly PaymentId[]; now: Date },
  ): Promise<void> {
    if (this.dependencies.payments.claimCollections) {
      await this.dependencies.payments.claimCollections({
        organizationId: input.organizationId,
        paymentIds: opts.paymentIds,
        carrierMethod: "RIDER_CASH",
        referenceId: persisted.riderCashHandoverId,
        actorUserId: input.actorUserId,
        now: opts.now,
      });
    }

    await this.dependencies.events.publish(
      DELIVERY_EVENT_TYPE.HANDOVER_RECORDED,
      { riderCashHandoverId: persisted.riderCashHandoverId },
      { orderingKey: persisted.riderCashHandoverId },
    );
    await this.dependencies.audit.record({
      action: AUDIT_ACTION.DELIVERY_HANDOVER_RECORDED,
      entityType: AUDIT_ENTITY_TYPE.riderCashHandover,
      entityId: persisted.riderCashHandoverId,
      changes: {},
    });
  }
}
