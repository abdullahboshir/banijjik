/** The customer the cashier attached to this sale, with the store credit they hold. */
export interface TillCustomer {
  readonly contactId: string;
  readonly name: string;
  readonly balanceMinor: number;
}

/**
 * The store credit the sale applies: the typed amount, never more than the balance or the bill. The
 * server re-checks it; this only keeps the till's own figures honest while the cashier types.
 */
export function storeCreditUseMinor(
  typedMinor: number,
  balanceMinor: number,
  totalMinor: number,
): number {
  return Math.max(0, Math.min(typedMinor, balanceMinor, totalMinor));
}
