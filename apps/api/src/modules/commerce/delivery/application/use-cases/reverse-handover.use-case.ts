import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  DELIVERY_EVENT_TYPE,
  ERROR_CODE,
} from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import type { ReverseRiderCashHandoverBody } from "@banijjik/validation/delivery";
import {
  asId,
  type OrganizationId,
  type PaymentId,
  type RiderCashHandoverId,
  type UserId,
} from "@banijjik/ids";
import { AppError } from "../../../../../kernel/http/index.js";
import { handoverAlreadyReversed } from "../../domain/errors.js";
import { RiderCashHandover } from "../../domain/rider-cash-handover.entity.js";
import type { DeliveryDependencies } from "../delivery-dependencies.js";

export interface ReverseHandoverInput {
  readonly organizationId: OrganizationId;
  readonly riderCashHandoverId: RiderCashHandoverId;
  readonly actorUserId: UserId;
  readonly body: ReverseRiderCashHandoverBody;
}

export class ReverseRiderCashHandoverUseCase {
  constructor(private readonly dependencies: DeliveryDependencies) {}

  async execute(input: ReverseHandoverInput): Promise<RiderCashHandover> {
    const original = await this.dependencies.handovers.findById(
      input.organizationId,
      input.riderCashHandoverId,
    );
    if (original === undefined) {
      throw new AppError({ code: ERROR_CODE.NOT_FOUND, messageKey: "errors.handover_not_found" });
    }
    if (original.reversesRiderCashHandoverId !== null) {
      throw new AppError({
        code: ERROR_CODE.BUSINESS_RULE,
        messageKey: "errors.cannot_reverse_a_reversal",
      });
    }

    const existingReversal = await this.dependencies.handovers.findByReversalId(
      input.organizationId,
      input.riderCashHandoverId,
    );
    if (existingReversal !== undefined) {
      throw handoverAlreadyReversed(input.riderCashHandoverId);
    }

    const now = this.dependencies.clock.now();
    const reversal = original.createReversal({
      reason: input.body.reason,
      actorUserId: input.actorUserId,
      now,
    });

    return this.dependencies.unitOfWork.run(async () => {
      await this.dependencies.approvals.verifyApprovalToken({
        organizationId: input.organizationId,
        riderCashHandoverId: input.riderCashHandoverId,
        token: input.body.approvalToken,
        action: APPROVAL_ACTION.RIDER_HANDOVER_REVERSAL,
      });

      const persisted = await this.dependencies.handovers.insert(reversal);

      if (this.dependencies.payments.releaseCollections) {
        await this.dependencies.payments.releaseCollections({
          organizationId: input.organizationId,
          paymentIds: original.paymentIds.map((id) => asId<PaymentId>(id)),
          carrierMethod: "RIDER_CASH",
          referenceId: original.riderCashHandoverId,
          actorUserId: input.actorUserId,
          now,
        });
      }

      await this.dependencies.events.publish(
        DELIVERY_EVENT_TYPE.HANDOVER_REVERSED,
        {
          riderCashHandoverId: persisted.riderCashHandoverId,
          reversesRiderCashHandoverId: original.riderCashHandoverId,
        },
        { orderingKey: `riderHandover:${persisted.riderCashHandoverId}` },
      );

      await this.dependencies.audit.record({
        action: AUDIT_ACTION.DELIVERY_HANDOVER_REVERSED,
        entityType: AUDIT_ENTITY_TYPE.riderCashHandover,
        entityId: persisted.riderCashHandoverId,
        changes: { reversesRiderCashHandoverId: { to: original.riderCashHandoverId } },
      });

      return persisted;
    });
  }
}
