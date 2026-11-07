import type {
  DeliveryAssignmentResponse,
  DeliveryAssignmentStatus,
  RiderCashHandoverResponse,
  RiderHandoverReceivedVia,
} from "@banijjik/contracts/delivery";

export interface DeliveryLabels {
  readonly title: string;
  readonly subtitle: string;
  readonly empty: string;
  readonly rider: string;
  readonly orderId: string;
  readonly status: string;
  readonly statusAll: string;
  readonly location: string;
  readonly notes: string;
  readonly created: string;
  readonly recordHandover: string;
  readonly reverseHandover: string;
  readonly close: string;
  readonly handover: {
    readonly title: string;
    readonly description: string;
    readonly rider: string;
    readonly receivedVia: string;
    readonly businessDate: string;
    readonly posSessionId: string;
    readonly posSessionPlaceholder: string;
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

export interface DeliveryAssignmentsViewProps {
  readonly orgSlug: string;
  readonly organizationId: string;
  readonly assignments: readonly DeliveryAssignmentResponse[];
  readonly total?: number | undefined;
  readonly hasNext?: boolean | undefined;
  readonly page?: number | undefined;
  readonly labels: DeliveryLabels;
  readonly canRecordHandover: boolean;
  readonly canReverseHandover: boolean;
}
