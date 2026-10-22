import type { DueItemResponse } from "@banijjik/contracts/payment";
import type { PaymentSummary } from "../../domain/payment-summary.entity.js";
import type {
  ListDuesFilter,
  PaginatedResult,
  PaymentSummaryRepository,
} from "../ports/payment-repositories.js";

function toDueItemResponse(summary: PaymentSummary): DueItemResponse {
  return {
    requestType: summary.requestType,
    requestId: summary.requestId,
    contactId: summary.contactId,
    locationId: summary.locationId,
    total: summary.total,
    allocated: summary.allocated,
    refunded: summary.refunded,
    due: summary.due,
    paymentStatus: summary.paymentStatus,
  };
}

export class GetDuesUseCase {
  constructor(private readonly summaries: PaymentSummaryRepository) {}

  async execute(filter: ListDuesFilter): Promise<PaginatedResult<DueItemResponse>> {
    const result = await this.summaries.listDues(filter);
    return {
      items: result.items.map(toDueItemResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
