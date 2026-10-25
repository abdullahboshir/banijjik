import type { Money, PaymentMethod } from "@banijjik/contracts/payment";
import type { PosSaleResponse } from "@banijjik/contracts/pos";

export interface ReceiptLine {
  readonly name: string;
  readonly quantity: number;
  readonly lineNetTotal: Money;
}

export interface ReceiptPayment {
  readonly method: PaymentMethod;
  readonly amount: Money;
}

/** Everything the printed receipt shows, taken from the server's answer (never recomputed on the till). */
export interface ReceiptModel {
  readonly documentNumber: string;
  readonly businessDate: string;
  readonly lines: readonly ReceiptLine[];
  readonly grandTotal: Money;
  readonly discountTotal: Money;
  readonly payments: readonly ReceiptPayment[];
  readonly changeDue: Money;
  readonly dueAmount: Money;
  readonly footer: string;
}

/** The invoice number when it exists, otherwise the order number, otherwise the id for a completed sale. */
function documentNumberOf(sale: PosSaleResponse): string {
  const { invoiceNumber, orderNumber, orderId } = sale.order;
  return invoiceNumber ?? orderNumber ?? orderId;
}

function receiptLinesOf(sale: PosSaleResponse): readonly ReceiptLine[] {
  return sale.order.lines.map((line) => ({
    name: line.nameSnapshot,
    quantity: line.quantity,
    lineNetTotal: line.lineNetTotal,
  }));
}

function receiptPaymentsOf(sale: PosSaleResponse): readonly ReceiptPayment[] {
  return sale.payments.map((payment) => ({ method: payment.method, amount: payment.amount }));
}

export function buildReceiptModel(sale: PosSaleResponse): ReceiptModel {
  return {
    documentNumber: documentNumberOf(sale),
    businessDate: sale.order.businessDate,
    lines: receiptLinesOf(sale),
    grandTotal: sale.order.totals.grandTotal,
    discountTotal: sale.order.totals.discountTotal,
    payments: receiptPaymentsOf(sale),
    changeDue: sale.changeDue,
    dueAmount: sale.dueAmount,
    footer: sale.receiptFooter,
  };
}
