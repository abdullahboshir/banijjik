/** A purchase row as the FIFO allocator sees it: face value and what already left it. */
export interface PurchaseForAllocation {
  readonly purchaseEntryId: string;
  readonly credits: number;
  readonly spent: number;
  readonly occurredAt: string;
  readonly expiresOn: string | null;
}

export interface SpendAllocation {
  readonly purchaseEntryId: string | null;
  readonly credits: number;
}

/**
 * Attributes a spend to purchases oldest-first, unexpired before expired (M.4 decision 2).
 * Unexpired purchases come first so a spend never silently consumes credits the daily expiry job
 * still owes an EXPIRE entry. Expired purchases come next so the job sees their remainder reduced
 * instead of writing an EXPIRE larger than the projected balance. What remains is non-expiring
 * credit (an ADJUST) and is recorded without attribution.
 */
export function allocateSpend(input: {
  readonly cost: number;
  readonly purchases: readonly PurchaseForAllocation[];
  readonly asOf: string;
}): readonly SpendAllocation[] {
  let remaining = input.cost;
  const ordered = [...input.purchases]
    .filter((purchase) => purchase.credits - purchase.spent > 0)
    .sort(comparePurchases(input.asOf));
  const allocations: SpendAllocation[] = [];
  for (const purchase of ordered) {
    if (remaining <= 0) break;
    const available = purchase.credits - purchase.spent;
    const taken = Math.min(available, remaining);
    allocations.push({ purchaseEntryId: purchase.purchaseEntryId, credits: taken });
    remaining -= taken;
  }
  if (remaining > 0) allocations.push({ purchaseEntryId: null, credits: remaining });
  return allocations;
}

function comparePurchases(asOf: string) {
  return (left: PurchaseForAllocation, right: PurchaseForAllocation): number => {
    const leftExpired = isExpired(left, asOf);
    const rightExpired = isExpired(right, asOf);
    if (leftExpired !== rightExpired) return leftExpired ? 1 : -1;
    return left.occurredAt.localeCompare(right.occurredAt);
  };
}

function isExpired(purchase: PurchaseForAllocation, asOf: string): boolean {
  return purchase.expiresOn !== null && purchase.expiresOn < asOf;
}
