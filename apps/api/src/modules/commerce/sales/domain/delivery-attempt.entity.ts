import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import {
  SALES_DELIVERY_FAIL_REASON,
  type DeliveryAttempt as DeliveryAttemptContract,
  type DeliveryFailReasonKey,
} from "@banijjik/contracts/sales/delivery";
import { newId, type OrderId, type OrganizationId, type UserId } from "@banijjik/ids";

const INITIAL_VERSION = 1;

export type DeliveryDispatch =
  | { readonly method: "COURIER"; readonly consignmentId: string }
  | { readonly method: "OWN_RIDER"; readonly deliveryAssignmentId: string };

export interface NewDeliveryAttemptInput {
  readonly organizationId: OrganizationId;
  readonly orderId: OrderId;
  readonly ordinal: number;
  readonly dispatch: DeliveryDispatch;
  readonly actorUserId: UserId;
  readonly now: Date;
}

export interface FailDeliveryAttemptInput {
  readonly reasonKey: DeliveryFailReasonKey;
  readonly note?: string;
  readonly actorUserId: UserId;
  readonly now: Date;
}

function otherReasonNeedsNote(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path: "note", messageKey: "validation.required" }] },
  });
}

function alreadyFailed(currentStatus: string): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.INVALID_TRANSITION,
    details: { currentStatus },
  });
}

function invalidOrdinal(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: { fields: [{ path: "ordinal", messageKey: "validation.too_small" }] },
  });
}

function linksOf(dispatch: DeliveryDispatch): {
  readonly consignmentId: string | null;
  readonly deliveryAssignmentId: string | null;
} {
  if (dispatch.method === "COURIER") {
    return { consignmentId: dispatch.consignmentId, deliveryAssignmentId: null };
  }
  return { consignmentId: null, deliveryAssignmentId: dispatch.deliveryAssignmentId };
}

/**
 * One ship or reship of a COURIER/OWN_RIDER order. Exactly one of consignment or assignment is set.
 */
export class DeliveryAttempt implements DeliveryAttemptContract {
  readonly deliveryAttemptId: string;
  readonly organizationId: OrganizationId;
  readonly orderId: OrderId;
  readonly ordinal: number;
  readonly method: "COURIER" | "OWN_RIDER";
  readonly consignmentId: string | null;
  readonly deliveryAssignmentId: string | null;
  readonly startedAt: Date;
  readonly failedAt: Date | null;
  readonly reasonKey: string | null;
  readonly note: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId;
  readonly updatedByUserId: UserId;

  private constructor(
    props: DeliveryAttemptContract & {
      readonly organizationId: OrganizationId;
      readonly orderId: OrderId;
      readonly createdByUserId: UserId;
      readonly updatedByUserId: UserId;
    },
  ) {
    this.deliveryAttemptId = props.deliveryAttemptId;
    this.organizationId = props.organizationId;
    this.orderId = props.orderId;
    this.ordinal = props.ordinal;
    this.method = props.method;
    this.consignmentId = props.consignmentId;
    this.deliveryAssignmentId = props.deliveryAssignmentId;
    this.startedAt = props.startedAt;
    this.failedAt = props.failedAt;
    this.reasonKey = props.reasonKey;
    this.note = props.note;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
    this.updatedByUserId = props.updatedByUserId;
  }

  static start(input: NewDeliveryAttemptInput): DeliveryAttempt {
    if (!Number.isInteger(input.ordinal) || input.ordinal < 1) throw invalidOrdinal();
    const links = linksOf(input.dispatch);
    return new DeliveryAttempt({
      deliveryAttemptId: newId(),
      organizationId: input.organizationId,
      orderId: input.orderId,
      ordinal: input.ordinal,
      method: input.dispatch.method,
      consignmentId: links.consignmentId,
      deliveryAssignmentId: links.deliveryAssignmentId,
      startedAt: input.now,
      failedAt: null,
      reasonKey: null,
      note: null,
      version: INITIAL_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  static restore(
    props: DeliveryAttemptContract & {
      readonly organizationId: OrganizationId;
      readonly orderId: OrderId;
      readonly createdByUserId: UserId;
      readonly updatedByUserId: UserId;
    },
  ): DeliveryAttempt {
    return new DeliveryAttempt(props);
  }

  markFailed(input: FailDeliveryAttemptInput): DeliveryAttempt {
    if (this.failedAt !== null) throw alreadyFailed("FAILED");
    const note = input.note === undefined || input.note.trim() === "" ? null : input.note.trim();
    if (input.reasonKey === SALES_DELIVERY_FAIL_REASON.OTHER && note === null) {
      throw otherReasonNeedsNote();
    }
    return new DeliveryAttempt({
      deliveryAttemptId: this.deliveryAttemptId,
      organizationId: this.organizationId,
      orderId: this.orderId,
      ordinal: this.ordinal,
      method: this.method,
      consignmentId: this.consignmentId,
      deliveryAssignmentId: this.deliveryAssignmentId,
      startedAt: this.startedAt,
      failedAt: input.now,
      reasonKey: input.reasonKey,
      note,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: input.now,
      createdByUserId: this.createdByUserId,
      updatedByUserId: input.actorUserId,
    });
  }
}
