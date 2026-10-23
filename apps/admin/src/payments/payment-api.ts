import type {
  ApprovalGrantRequest,
  ApprovalGrantResponse,
  ApproverSummary,
} from "@banijjik/contracts/iam";
import type {
  Money,
  PaymentAllocation,
  PaymentDirection,
  PaymentMethod,
  PaymentResponse,
} from "@banijjik/contracts/payment";
import { newId } from "@banijjik/ids";
import { apiFetch } from "../lib/api/api-client";

export interface PaymentPage {
  readonly items: readonly PaymentResponse[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export interface PaymentListQuery {
  readonly page?: number;
  readonly limit?: number;
  readonly locationId?: string;
  readonly contactId?: string;
  readonly method?: PaymentMethod;
  readonly direction?: PaymentDirection;
  readonly from?: string;
  readonly to?: string;
}

export interface ReceivePaymentInput {
  readonly locationId: string;
  readonly method: PaymentMethod;
  readonly amount: Money;
  readonly externalReference?: string | null;
  readonly allocations: readonly PaymentAllocation[];
  readonly contactId?: string | null;
  readonly note?: string | null;
}

export interface RefundPaymentInput {
  readonly locationId: string;
  readonly method: PaymentMethod;
  readonly amount: Money;
  readonly externalReference?: string | null;
  readonly allocations: readonly PaymentAllocation[];
  readonly contactId?: string | null;
  readonly approvalToken?: string;
  readonly note?: string | null;
}

export interface ReversePaymentInput {
  readonly approvalToken: string;
  readonly note?: string | null;
}

function base(organizationId: string): string {
  return `/orgs/${organizationId}/payments`;
}

function buildListParams(query: PaymentListQuery): string {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(query)) {
    if (val !== undefined && val !== null && val !== "") {
      params.set(key, String(val));
    }
  }
  return params.toString();
}

export async function listPayments(
  organizationId: string,
  query: PaymentListQuery = {},
): Promise<PaymentPage> {
  const queryStr = buildListParams(query);
  const url = queryStr ? `${base(organizationId)}?${queryStr}` : base(organizationId);
  const result = await apiFetch<
    readonly PaymentResponse[],
    { total?: number; page?: number; limit?: number }
  >(url);
  return {
    items: result.data,
    total: result.meta?.total ?? result.data.length,
    page: result.meta?.page ?? 1,
    limit: result.meta?.limit ?? 50,
  };
}

export async function getPayment(
  organizationId: string,
  paymentId: string,
): Promise<PaymentResponse> {
  const result = await apiFetch<PaymentResponse>(`${base(organizationId)}/${paymentId}`);
  return result.data;
}

export async function receivePayment(
  organizationId: string,
  body: ReceivePaymentInput,
): Promise<PaymentResponse> {
  const result = await apiFetch<PaymentResponse>(base(organizationId), {
    method: "POST",
    body,
    idempotencyKey: newId(),
  });
  return result.data;
}

export async function refundPayment(
  organizationId: string,
  body: RefundPaymentInput,
): Promise<PaymentResponse> {
  const result = await apiFetch<PaymentResponse>(`/orgs/${organizationId}/refunds`, {
    method: "POST",
    body,
    idempotencyKey: newId(),
  });
  return result.data;
}

export async function reversePayment(
  organizationId: string,
  paymentId: string,
  body: ReversePaymentInput,
): Promise<PaymentResponse> {
  const result = await apiFetch<PaymentResponse>(`${base(organizationId)}/${paymentId}/reverse`, {
    method: "POST",
    body,
    idempotencyKey: newId(),
  });
  return result.data;
}

export async function listApprovers(
  organizationId: string,
  locationId: string,
): Promise<readonly ApproverSummary[]> {
  const params = new URLSearchParams({ locationId });
  const result = await apiFetch<ApproverSummary[]>(`/orgs/${organizationId}/approvers?${params}`);
  return result.data;
}

export async function grantApproval(
  organizationId: string,
  body: ApprovalGrantRequest,
): Promise<ApprovalGrantResponse> {
  const result = await apiFetch<ApprovalGrantResponse>(`/orgs/${organizationId}/approvals`, {
    method: "POST",
    body,
  });
  return result.data;
}
