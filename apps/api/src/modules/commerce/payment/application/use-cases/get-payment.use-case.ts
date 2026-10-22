import type { PaymentResponse } from "@banijjik/contracts/payment";
import type { OrganizationId, PaymentId } from "@banijjik/ids";
import { recordNotFound } from "../../domain/errors.js";
import type {
  ListPaymentsFilter,
  PaginatedResult,
  PaymentRepository,
} from "../ports/payment-repositories.js";
import { toPaymentResponse } from "./receive-payment.use-case.js";

export class GetPaymentUseCase {
  constructor(private readonly payments: PaymentRepository) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly paymentId: PaymentId;
  }): Promise<PaymentResponse> {
    const payment = await this.payments.findById(input.organizationId, input.paymentId);
    if (!payment) {
      throw recordNotFound();
    }
    return toPaymentResponse(payment);
  }
}

export class ListPaymentsUseCase {
  constructor(private readonly payments: PaymentRepository) {}

  async execute(filter: ListPaymentsFilter): Promise<PaginatedResult<PaymentResponse>> {
    const result = await this.payments.list(filter);
    return {
      items: result.items.map(toPaymentResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
