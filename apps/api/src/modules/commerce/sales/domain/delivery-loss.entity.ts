import type { Money } from "@banijjik/contracts/catalog";
import type {
  DeliveryLossClosureId,
  DeliveryLossRecoveryId,
  OrderId,
  OrganizationId,
  UserId,
} from "@banijjik/ids";

export interface DeliveryLossClosureLine {
  readonly orderLineId: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly inventoryItemId: string | null;
  readonly shippedQuantity: number;
  readonly restockQuantity: number;
  readonly damagedQuantity: number;
  readonly lostQuantity: number;
  readonly recoveredQuantity: number;
  readonly lostCostAmount: number;
  readonly costCurrency: string;
}

export interface DeliveryLossClosureProps {
  readonly deliveryLossClosureId: DeliveryLossClosureId;
  readonly organizationId: OrganizationId;
  readonly orderId: OrderId;
  readonly locationId: string;
  readonly firstShipmentEventId: string | null;
  readonly reasonKey: string;
  readonly evidenceFileIds: readonly string[];
  readonly lines: readonly DeliveryLossClosureLine[];
  readonly totalLostCost: Money;
  readonly approvalToken: string;
  readonly approvalSnapshot: {
    readonly approverMemberId: string;
    readonly action: string;
  };
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId;
  readonly updatedByUserId: UserId;
}

export class DeliveryLossClosure {
  readonly deliveryLossClosureId: DeliveryLossClosureId;
  readonly organizationId: OrganizationId;
  readonly orderId: OrderId;
  readonly locationId: string;
  readonly firstShipmentEventId: string | null;
  readonly reasonKey: string;
  readonly evidenceFileIds: readonly string[];
  readonly lines: readonly DeliveryLossClosureLine[];
  readonly totalLostCost: Money;
  readonly approvalToken: string;
  readonly approvalSnapshot: {
    readonly approverMemberId: string;
    readonly action: string;
  };
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId;
  readonly updatedByUserId: UserId;

  constructor(props: DeliveryLossClosureProps) {
    this.deliveryLossClosureId = props.deliveryLossClosureId;
    this.organizationId = props.organizationId;
    this.orderId = props.orderId;
    this.locationId = props.locationId;
    this.firstShipmentEventId = props.firstShipmentEventId;
    this.reasonKey = props.reasonKey;
    this.evidenceFileIds = props.evidenceFileIds;
    this.lines = props.lines;
    this.totalLostCost = props.totalLostCost;
    this.approvalToken = props.approvalToken;
    this.approvalSnapshot = props.approvalSnapshot;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
    this.updatedByUserId = props.updatedByUserId;
  }

  withRecoveredQuantities(
    increments: ReadonlyMap<string, number>,
    actor: { readonly actorUserId: UserId; readonly now: Date },
  ): DeliveryLossClosure {
    const updatedLines = this.lines.map((line) => {
      const inc = increments.get(line.orderLineId) ?? 0;
      return {
        ...line,
        recoveredQuantity: line.recoveredQuantity + inc,
      };
    });
    return new DeliveryLossClosure({
      ...this,
      lines: updatedLines,
      version: this.version + 1,
      updatedAt: actor.now,
      updatedByUserId: actor.actorUserId,
    });
  }
}

export interface DeliveryLossRecoveryLine {
  readonly orderLineId: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly inventoryItemId: string | null;
  readonly restockQuantity: number;
  readonly damagedQuantity: number;
  readonly recoveredCostAmount: number;
  readonly costCurrency: string;
}

export interface DeliveryLossRecoveryProps {
  readonly deliveryLossRecoveryId: DeliveryLossRecoveryId;
  readonly organizationId: OrganizationId;
  readonly deliveryLossClosureId: DeliveryLossClosureId;
  readonly orderId: OrderId;
  readonly locationId: string;
  readonly lines: readonly DeliveryLossRecoveryLine[];
  readonly totalRecoveredCost: Money;
  readonly approvalToken: string;
  readonly approvalSnapshot: {
    readonly approverMemberId: string;
    readonly action: string;
  };
  readonly createdAt: Date;
  readonly createdByUserId: UserId;
}

export class DeliveryLossRecovery {
  readonly deliveryLossRecoveryId: DeliveryLossRecoveryId;
  readonly organizationId: OrganizationId;
  readonly deliveryLossClosureId: DeliveryLossClosureId;
  readonly orderId: OrderId;
  readonly locationId: string;
  readonly lines: readonly DeliveryLossRecoveryLine[];
  readonly totalRecoveredCost: Money;
  readonly approvalToken: string;
  readonly approvalSnapshot: {
    readonly approverMemberId: string;
    readonly action: string;
  };
  readonly createdAt: Date;
  readonly createdByUserId: UserId;

  constructor(props: DeliveryLossRecoveryProps) {
    this.deliveryLossRecoveryId = props.deliveryLossRecoveryId;
    this.organizationId = props.organizationId;
    this.deliveryLossClosureId = props.deliveryLossClosureId;
    this.orderId = props.orderId;
    this.locationId = props.locationId;
    this.lines = props.lines;
    this.totalRecoveredCost = props.totalRecoveredCost;
    this.approvalToken = props.approvalToken;
    this.approvalSnapshot = props.approvalSnapshot;
    this.createdAt = props.createdAt;
    this.createdByUserId = props.createdByUserId;
  }
}
