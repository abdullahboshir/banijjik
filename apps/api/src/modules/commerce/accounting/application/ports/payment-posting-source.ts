import type {
  PaymentPostingSnapshot,
  StoreCreditPostingSnapshot,
} from "../../domain/posting-rules.js";

/**
 * Reads payment module data for journal lines. Card 3.8 supplies the adapter; until then handlers
 * that need it are not registered (lead clarification).
 */
export interface PaymentPostingSource {
  readPayment(paymentId: string): Promise<PaymentPostingSnapshot | undefined>;
  readStoreCreditEntry(storeCreditEntryId: string): Promise<StoreCreditPostingSnapshot | undefined>;
}
