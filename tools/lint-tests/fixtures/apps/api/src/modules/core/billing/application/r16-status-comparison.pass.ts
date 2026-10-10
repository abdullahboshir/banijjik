export function isPaid(invoice: { status: string }): boolean {
  return invoice.status === "PAID";
}
