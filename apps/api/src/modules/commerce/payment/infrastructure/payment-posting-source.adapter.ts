import type { CurrencyCode } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/payment";
import { asId, type OrganizationId } from "@banijjik/ids";
import { models } from "../../../../kernel/db/index.js";
import type {
  PaymentAllocationForPosting,
  PaymentMethodCode,
  PaymentPostingSnapshot,
  PaymentPostingSource,
  StoreCreditPostingSnapshot,
} from "../../accounting/index.js";
import type { RequestReaderRegistry } from "../application/ports/request-reader.js";
import { PAYMENT_MODEL_NAME, type PaymentDocument } from "./payment.schema.js";
import {
  STORE_CREDIT_ENTRY_MODEL_NAME,
  type StoreCreditEntryDocument,
} from "./store-credit-entry.schema.js";

async function buildPostingAllocations(
  paymentDoc: PaymentDocument,
  requestReaders: RequestReaderRegistry,
): Promise<{ allocations: PaymentAllocationForPosting[]; totalAllocated: number }> {
  const organizationId = asId<OrganizationId>(paymentDoc.organizationId);
  const allocations: PaymentAllocationForPosting[] = [];
  let totalAllocated = 0;

  for (const alloc of paymentDoc.allocations) {
    let revenueState: "BEFORE_REVENUE" | "AFTER_REVENUE" = "BEFORE_REVENUE";
    const reader = requestReaders.get(alloc.requestType);
    if (reader) {
      const snapshot = await reader.read(organizationId, alloc.requestId);
      if (snapshot) {
        revenueState = snapshot.revenueState;
      }
    }
    allocations.push({
      requestId: alloc.requestId,
      amount: {
        amount: alloc.amount.amount,
        currency: alloc.amount.currency as CurrencyCode,
      },
      revenueState,
    });
    totalAllocated += alloc.amount.amount;
  }

  return { allocations, totalAllocated };
}

function computeOverpayment(
  paymentDoc: PaymentDocument,
  totalAllocated: number,
): Money | undefined {
  const overpaymentAmount = paymentDoc.amount.amount - totalAllocated;
  if (overpaymentAmount > 0 && paymentDoc.contactId && paymentDoc.direction === "IN") {
    return {
      amount: overpaymentAmount,
      currency: paymentDoc.amount.currency as CurrencyCode,
    };
  }
  return undefined;
}

async function readPaymentSnapshot(
  paymentId: string,
  requestReaders: RequestReaderRegistry,
): Promise<PaymentPostingSnapshot | undefined> {
  const paymentDoc = await models({})
    .get<PaymentDocument>(PAYMENT_MODEL_NAME)
    .findOne({ paymentId })
    .lean<PaymentDocument>();

  if (!paymentDoc) return undefined;

  const { allocations, totalAllocated } = await buildPostingAllocations(paymentDoc, requestReaders);

  return {
    paymentId: paymentDoc.paymentId,
    businessDate: paymentDoc.businessDate,
    locationId: paymentDoc.locationId,
    amount: {
      amount: paymentDoc.amount.amount,
      currency: paymentDoc.amount.currency as CurrencyCode,
    },
    method: paymentDoc.method as PaymentMethodCode,
    direction: paymentDoc.direction,
    allocations,
    overpaymentToStoreCredit: computeOverpayment(paymentDoc, totalAllocated),
    reversesPaymentId: paymentDoc.reversesPaymentId ?? undefined,
  };
}

async function readStoreCreditSnapshot(
  storeCreditEntryId: string,
): Promise<StoreCreditPostingSnapshot | undefined> {
  const entryDoc = await models({})
    .get<StoreCreditEntryDocument>(STORE_CREDIT_ENTRY_MODEL_NAME)
    .findOne({ storeCreditEntryId })
    .lean<StoreCreditEntryDocument>();

  if (!entryDoc || entryDoc.kind !== "EXPIRY") return undefined;

  return {
    storeCreditEntryId: entryDoc.storeCreditEntryId,
    businessDate: entryDoc.createdAt.toISOString().slice(0, 10),
    locationId: null,
    amount: {
      amount: entryDoc.amount.amount,
      currency: entryDoc.amount.currency as CurrencyCode,
    },
    kind: "EXPIRY",
  };
}

export function buildPaymentPostingSource(input: {
  readonly requestReaders: RequestReaderRegistry;
}): PaymentPostingSource {
  return {
    readPayment: (paymentId) => readPaymentSnapshot(paymentId, input.requestReaders),
    readStoreCreditEntry: readStoreCreditSnapshot,
  };
}
