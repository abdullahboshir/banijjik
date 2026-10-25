import {
  PAYMENT_DIRECTION,
  PAYMENT_REQUEST_TYPE,
  type PaymentDirection,
  type PaymentMethod,
} from "@banijjik/contracts/payment";
import type { OrganizationId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import { PAYMENT_MODEL_NAME, type PaymentDocument } from "./payment.schema.js";

/** What a register took, by method and direction, from the payments that carry its `posSessionId`. */
export interface SessionMethodTotal {
  readonly method: PaymentMethod;
  readonly direction: PaymentDirection;
  readonly currency: string;
  readonly totalMinor: number;
  readonly count: number;
}

/** What those payments allocated to each order, so the report can tell what stayed owed. */
export interface SessionOrderAllocation {
  readonly orderId: string;
  readonly allocatedMinor: number;
  readonly refundedMinor: number;
}

/**
 * Reads the payments of one register session as sums (plan 3.9 decision 5): never the rows. It
 * joins the active unit of work, so the close sees exactly the payments committed before it.
 */
export interface PaymentSessionReader {
  methodTotals(input: {
    readonly organizationId: OrganizationId;
    readonly posSessionId: string;
  }): Promise<readonly SessionMethodTotal[]>;
  collectionTotals(input: {
    readonly organizationId: OrganizationId;
    readonly posSessionId: string;
    readonly soldOrderIds: readonly string[];
  }): Promise<readonly SessionMethodTotal[]>;
  orderAllocations(input: {
    readonly organizationId: OrganizationId;
    readonly posSessionId: string;
  }): Promise<readonly SessionOrderAllocation[]>;
}

interface MethodGroup {
  readonly _id: { method: PaymentMethod; direction: PaymentDirection; currency: string };
  readonly totalMinor: number;
  readonly count: number;
}

interface AllocationGroup {
  readonly _id: { requestId: string; direction: PaymentDirection };
  readonly totalMinor: number;
}

function paymentModel() {
  return models({}).get<PaymentDocument>(PAYMENT_MODEL_NAME);
}

async function readMethodGroups(
  organizationId: OrganizationId,
  posSessionId: string,
): Promise<readonly MethodGroup[]> {
  return paymentModel().aggregate<MethodGroup>(
    [
      { $match: { organizationId, posSessionId } },
      {
        $group: {
          _id: { method: "$method", direction: "$direction", currency: "$amount.currency" },
          totalMinor: { $sum: "$amount.amount" },
          count: { $sum: 1 },
        },
      },
    ],
    sessionOption(getActiveSession()),
  );
}

async function readAllocationGroups(
  organizationId: OrganizationId,
  posSessionId: string,
): Promise<readonly AllocationGroup[]> {
  return paymentModel().aggregate<AllocationGroup>(
    [
      { $match: { organizationId, posSessionId } },
      { $unwind: "$allocations" },
      { $match: { "allocations.requestType": PAYMENT_REQUEST_TYPE.ORDER } },
      {
        $group: {
          _id: { requestId: "$allocations.requestId", direction: "$direction" },
          totalMinor: { $sum: "$allocations.amount.amount" },
        },
      },
    ],
    sessionOption(getActiveSession()),
  );
}

function foldAllocations(groups: readonly AllocationGroup[]): readonly SessionOrderAllocation[] {
  const byOrder = new Map<string, { allocatedMinor: number; refundedMinor: number }>();
  for (const group of groups) {
    const entry = byOrder.get(group._id.requestId) ?? { allocatedMinor: 0, refundedMinor: 0 };
    if (group._id.direction === PAYMENT_DIRECTION.IN) entry.allocatedMinor += group.totalMinor;
    if (group._id.direction === PAYMENT_DIRECTION.REFUND) entry.refundedMinor += group.totalMinor;
    byOrder.set(group._id.requestId, entry);
  }
  return [...byOrder].map(([orderId, entry]) => ({ orderId, ...entry }));
}

async function readCollectionGroups(
  organizationId: OrganizationId,
  posSessionId: string,
  soldOrderIds: readonly string[],
): Promise<readonly MethodGroup[]> {
  return paymentModel().aggregate<MethodGroup>(
    [
      {
        $match: {
          organizationId,
          posSessionId,
          direction: PAYMENT_DIRECTION.IN,
          "allocations.requestId": { $nin: [...soldOrderIds] },
        },
      },
      {
        $group: {
          _id: { method: "$method", direction: "$direction", currency: "$amount.currency" },
          totalMinor: { $sum: "$amount.amount" },
          count: { $sum: 1 },
        },
      },
    ],
    sessionOption(getActiveSession()),
  );
}

export function buildPaymentSessionReader(): PaymentSessionReader {
  return {
    async methodTotals({ organizationId, posSessionId }) {
      const groups = await readMethodGroups(organizationId, posSessionId);
      return groups.map((group) => ({
        ...group._id,
        totalMinor: group.totalMinor,
        count: group.count,
      }));
    },
    async collectionTotals({ organizationId, posSessionId, soldOrderIds }) {
      const groups = await readCollectionGroups(organizationId, posSessionId, soldOrderIds);
      return groups.map((group) => ({
        ...group._id,
        totalMinor: group.totalMinor,
        count: group.count,
      }));
    },
    async orderAllocations({ organizationId, posSessionId }) {
      return foldAllocations(await readAllocationGroups(organizationId, posSessionId));
    },
  };
}
