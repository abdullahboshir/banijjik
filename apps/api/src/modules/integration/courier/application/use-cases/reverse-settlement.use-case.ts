import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import { COURIER_EVENT_TYPE } from "@banijjik/contracts/courier";
import {
  asId,
  type CourierSettlementId,
  type OrganizationId,
  type PaymentId,
  type UserId,
} from "@banijjik/ids";
import { CourierSettlement } from "../../domain/courier-settlement.entity.js";
import { courierSettlementNotFound, settlementAlreadyReversed } from "../../domain/errors.js";
import type { CourierDependencies } from "../courier-dependencies.js";

export interface ReverseSettlementInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly courierSettlementId: CourierSettlementId;
  readonly body: {
    readonly version: number;
    readonly reason: string;
    readonly approvalToken: string;
  };
}

export class ReverseCourierSettlementUseCase {
  constructor(private readonly dependencies: CourierDependencies) {}

  async execute(input: ReverseSettlementInput): Promise<CourierSettlement> {
    const original = await this.dependencies.courierSettlements.findById(
      input.organizationId,
      input.courierSettlementId,
    );
    if (original === undefined) throw courierSettlementNotFound();

    const existingReversal = await this.dependencies.courierSettlements.findByReversalId(
      input.organizationId,
      input.courierSettlementId,
    );
    if (existingReversal !== undefined) {
      throw settlementAlreadyReversed(input.courierSettlementId);
    }

    const now = this.dependencies.clock.now();
    const reversal = CourierSettlement.reverse({
      original,
      reason: input.body.reason,
      actorUserId: input.actorUserId,
      now,
    });

    return this.dependencies.unitOfWork.run(async () => {
      await this.dependencies.approvals.verifyApprovalToken({
        organizationId: input.organizationId,
        courierSettlementId: input.courierSettlementId,
        token: input.body.approvalToken,
        action: "courier.settlement.reverse",
      });

      const persisted = await this.dependencies.courierSettlements.insert(reversal);

      if (this.dependencies.payments.releaseCollections) {
        await this.dependencies.payments.releaseCollections({
          organizationId: input.organizationId,
          paymentIds: original.paymentIds.map((id) => asId<PaymentId>(id)),
          carrierMethod: "COD_COURIER",
          referenceId: original.courierSettlementId,
          actorUserId: input.actorUserId,
          now,
        });
      }

      await this.dependencies.events.publish(
        COURIER_EVENT_TYPE.SETTLEMENT_REVERSED,
        {
          courierSettlementId: persisted.courierSettlementId,
          reversesCourierSettlementId: original.courierSettlementId,
        },
        { orderingKey: `courierSettlement:${persisted.courierSettlementId}` },
      );

      await this.dependencies.audit.record({
        action: AUDIT_ACTION.COURIER_SETTLEMENT_REVERSED,
        entityType: AUDIT_ENTITY_TYPE.courierSettlement,
        entityId: persisted.courierSettlementId,
        changes: { reversesCourierSettlementId: { to: original.courierSettlementId } },
      });

      return persisted;
    });
  }
}
