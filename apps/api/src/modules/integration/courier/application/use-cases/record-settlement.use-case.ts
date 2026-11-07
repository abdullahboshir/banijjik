import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, ERROR_CODE } from "@banijjik/contracts";
import {
  COURIER_EVENT_TYPE,
  type CourierSettlementReceivedVia,
  type ManualCourierKey,
  type Money,
} from "@banijjik/contracts/courier";
import { asId, type OrganizationId, type PaymentId, type UserId } from "@banijjik/ids";
import { AppError } from "../../../../../kernel/http/index.js";
import { CourierSettlement } from "../../domain/courier-settlement.entity.js";
import { paymentNotEligibleForSettlement } from "../../domain/errors.js";
import type { CourierDependencies } from "../courier-dependencies.js";

export interface RecordSettlementInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly body: {
    readonly courierKey: ManualCourierKey;
    readonly paymentIds: readonly string[];
    readonly courierChargesMinor: number;
    readonly receivedVia: CourierSettlementReceivedVia;
    readonly externalReference: string;
    readonly businessDate: string;
  };
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

export class RecordCourierSettlementUseCase {
  constructor(private readonly dependencies: CourierDependencies) {}

  async execute(input: RecordSettlementInput): Promise<CourierSettlement> {
    const paymentIds = input.body.paymentIds.map((id) => asId<PaymentId>(id));
    const payments = await this.dependencies.payments.findPaymentsByIds(
      input.organizationId,
      paymentIds,
    );

    if (payments.length !== paymentIds.length) {
      const foundSet = new Set(payments.map((p) => p.paymentId));
      const missing = paymentIds.find((id) => !foundSet.has(id));
      throw paymentNotEligibleForSettlement(
        missing ?? "unknown",
        "Payment not found in this organization",
      );
    }

    const grossAmount = computeGrossAmount(payments);
    const courierCharges: Money = {
      amount: input.body.courierChargesMinor,
      currency: grossAmount.currency,
    };
    const now = this.dependencies.clock.now();

    const settlement = CourierSettlement.record({
      organizationId: input.organizationId,
      courierKey: input.body.courierKey,
      paymentIds: input.body.paymentIds,
      grossAmount,
      courierCharges,
      receivedVia: input.body.receivedVia,
      externalReference: input.body.externalReference,
      businessDate: input.body.businessDate,
      actorUserId: input.actorUserId,
      now,
    });

    return this.dependencies.unitOfWork.run(async () => {
      const persisted = await this.dependencies.courierSettlements.insert(settlement);

      if (this.dependencies.payments.claimCollections) {
        await this.dependencies.payments.claimCollections({
          organizationId: input.organizationId,
          paymentIds,
          carrierMethod: "COD_COURIER",
          referenceId: persisted.courierSettlementId,
          actorUserId: input.actorUserId,
          now,
        });
      }

      await this.dependencies.events.publish(
        COURIER_EVENT_TYPE.SETTLEMENT_RECORDED,
        { courierSettlementId: persisted.courierSettlementId },
        { orderingKey: persisted.courierSettlementId },
      );

      await this.dependencies.audit.record({
        action: AUDIT_ACTION.COURIER_SETTLEMENT_RECORDED,
        entityType: AUDIT_ENTITY_TYPE.courierSettlement,
        entityId: persisted.courierSettlementId,
        changes: {},
      });

      return persisted;
    });
  }
}
