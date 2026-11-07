import type {
  ConsignmentResponse,
  ConsignmentStatus,
  CourierSettlementReceivedVia,
  CourierSettlementResponse,
  ManualCourierKey,
} from "@banijjik/contracts/courier";

export interface CourierLabels {
  readonly title: string;
  readonly subtitle: string;
  readonly empty: string;
  readonly courierKey: string;
  readonly trackingNumber: string;
  readonly orderId: string;
  readonly location: string;
  readonly status: string;
  readonly created: string;
  readonly filterCourierAll: string;
  readonly recordSettlement: string;
  readonly reverseSettlement: string;
  readonly close: string;
  readonly settlement: {
    readonly title: string;
    readonly description: string;
    readonly courier: string;
    readonly reference: string;
    readonly referencePlaceholder: string;
    readonly charges: string;
    readonly chargesPlaceholder: string;
    readonly receivedVia: string;
    readonly businessDate: string;
    readonly payments: string;
    readonly paymentsPlaceholder: string;
    readonly submit: string;
    readonly success: string;
  };
  readonly reverse: {
    readonly title: string;
    readonly description: string;
    readonly reason: string;
    readonly reasonPlaceholder: string;
    readonly submit: string;
    readonly success: string;
  };
}

export interface CourierConsignmentsViewProps {
  readonly orgSlug: string;
  readonly organizationId: string;
  readonly consignments: readonly ConsignmentResponse[];
  readonly total?: number | undefined;
  readonly hasNext?: boolean | undefined;
  readonly page?: number | undefined;
  readonly labels: CourierLabels;
  readonly canRecordSettlement: boolean;
  readonly canReverseSettlement: boolean;
}
