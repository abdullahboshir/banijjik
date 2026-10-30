import type { RequestPaymentLifecycle } from "../ports/request-payment-lifecycle.js";

export class DefaultRequestPaymentLifecycle implements RequestPaymentLifecycle {
  async beginReceipt(): Promise<void> {
    // Pass-through no-op for request types without explicit lifecycle gating
  }

  async endReceipt(): Promise<void> {
    // Pass-through no-op
  }
}
