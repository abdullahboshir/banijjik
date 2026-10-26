import type { CurrencyCode } from "@banijjik/contracts";
import { useState } from "react";
import type { SaleCustomerInput } from "./pos-sheet-checkout";
import { storeCreditUseMinor, type TillCustomer } from "./till-customer";
import type { TenderPlan } from "./till-payment";
import { moneyFromInput } from "@banijjik/web-client";

/** A credit sale takes no payment: the whole payable bill stays owed to the attached customer. */
export const CREDIT_ONLY_PLAN: TenderPlan = {
  ok: true,
  payments: [],
  cashTendered: null,
  changeMinor: 0,
};

export interface SheetCustomerState {
  readonly customer: TillCustomer | null;
  readonly chooseCustomer: (customer: TillCustomer | null) => void;
  readonly creditText: string;
  readonly setCreditText: (text: string) => void;
  readonly creditSale: boolean;
  readonly setCreditSale: (on: boolean) => void;
  /** Store credit the sale applies, in minor units; zero without a customer. */
  readonly creditUseMinor: number;
  /** What is left to settle after store credit, in minor units. */
  readonly payableMinor: number;
  readonly saleCustomer: SaleCustomerInput;
}

/**
 * The customer on the sale and the store credit they apply. The credit is capped by the balance and
 * the bill here only so the till shows the right figure; the server applies the same cap.
 */
export function useSheetCustomer(totalMinor: number, currency: CurrencyCode): SheetCustomerState {
  const [customer, setCustomer] = useState<TillCustomer | null>(null);
  const [creditText, setCreditText] = useState("");
  const [creditSale, setCreditSale] = useState(false);
  const typedMinor = moneyFromInput(creditText, currency)?.amount ?? 0;
  const creditUseMinor = customer
    ? storeCreditUseMinor(typedMinor, customer.balanceMinor, totalMinor)
    : 0;

  function chooseCustomer(next: TillCustomer | null): void {
    setCustomer(next);
    if (next === null) setCreditSale(false);
  }

  return {
    customer,
    chooseCustomer,
    creditText,
    setCreditText,
    creditSale: customer !== null && creditSale,
    setCreditSale,
    creditUseMinor,
    payableMinor: totalMinor - creditUseMinor,
    saleCustomer: {
      contactId: customer?.contactId ?? null,
      storeCreditUse: creditUseMinor > 0 ? { amount: creditUseMinor, currency } : null,
    },
  };
}
