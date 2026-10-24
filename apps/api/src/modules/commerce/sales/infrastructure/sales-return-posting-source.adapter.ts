import { ERROR_CODE, type CurrencyCode } from "@banijjik/contracts";
import { STOCK_MOVEMENT_REASON } from "@banijjik/contracts/inventory";
import type { Money } from "@banijjik/contracts/accounting";
import { asId, type SalesReturnId } from "@banijjik/ids";
import { DomainRuleError } from "../domain/errors.js";
import type {
  SalesReturnPostingSnapshot,
  SalesReturnPostingSource,
} from "../../accounting/index.js";
import { movementValue, type InventoryPostingSource } from "../../inventory/index.js";
import type { SalesReturnRepository } from "../application/ports/sales-return-ports.js";
import type { SalesReturnRecord } from "../domain/sales-return.record.js";

export interface SalesReturnPostingSourcePorts {
  readonly returns: SalesReturnRepository;
  readonly inventory: InventoryPostingSource;
  /** The organization currency; a return in another currency is refused, never posted (plan 3.5b decision 9). */
  readonly organizationCurrency: (
    organizationId: SalesReturnRecord["organizationId"],
  ) => Promise<CurrencyCode | undefined>;
}

function sumOf(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}

/** The return's cost: the value of the stock movements that came back (restocked and damaged alike). */
async function returnedCostOf(
  ports: SalesReturnPostingSourcePorts,
  record: SalesReturnRecord,
): Promise<number> {
  const movements = await ports.inventory.readMovements({
    organizationId: record.organizationId,
    sourceId: record.salesReturnId,
  });
  const returned = movements.filter(
    (movement) =>
      movement.reason === STOCK_MOVEMENT_REASON.RETURN ||
      movement.reason === STOCK_MOVEMENT_REASON.RETURN_DAMAGED,
  );
  return sumOf(returned.map((movement) => movementValue(movement)));
}

async function assertCurrencyMatches(
  ports: SalesReturnPostingSourcePorts,
  record: SalesReturnRecord,
): Promise<void> {
  const organizationCurrency = await ports.organizationCurrency(record.organizationId);
  if (organizationCurrency !== record.value.currency) {
    throw new DomainRuleError({
      code: ERROR_CODE.INTERNAL,
      details: { reason: "sales-return-currency-mismatch", salesReturnId: record.salesReturnId },
    });
  }
}

/** The posting snapshot of a return, read by the accounting worker outside any request (ADR-115). */
export function buildSalesReturnPostingSourceAdapter(
  ports: SalesReturnPostingSourcePorts,
): SalesReturnPostingSource {
  return {
    async readSalesReturn(salesReturnId: string): Promise<SalesReturnPostingSnapshot | undefined> {
      const record = await ports.returns.findById(asId<SalesReturnId>(salesReturnId));
      if (record === undefined) return undefined;
      await assertCurrencyMatches(ports, record);
      const currency = record.value.currency as Money["currency"];
      const cost = await returnedCostOf(ports, record);
      return {
        salesReturnId: record.salesReturnId,
        businessDate: record.businessDate,
        locationId: record.locationId,
        lineValue: { amount: sumOf(record.lines.map((line) => line.value.amount)), currency },
        lineTax: { amount: sumOf(record.lines.map((line) => line.taxPart.amount)), currency },
        deliveryReturned: record.deliveryChargeReturned,
        roundingReturned: record.roundingReturned,
        cost: { amount: cost, currency },
      };
    },
  };
}
