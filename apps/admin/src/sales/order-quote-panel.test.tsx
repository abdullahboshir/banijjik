// @vitest-environment jsdom
import type { QuoteResponse } from "@banijjik/contracts/pricing";
import { formatMoney } from "@banijjik/ui";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { orderLabelsOf } from "./order-labels";
import { OrderQuotePanel } from "./order-quote-panel";

const quoteOrderMock = vi.fn();
vi.mock("./order-api", () => ({
  quoteOrder: (...args: unknown[]) => quoteOrderMock(...args),
}));

const labels = orderLabelsOf(banglaTranslator().t).quote;
const LINE = {
  offeringId: "offering-1",
  variantId: "variant-1",
  quantity: 2,
  modifierOptionIds: [],
};

function quoteWith(overrides: Partial<QuoteResponse> = {}): QuoteResponse {
  return {
    lines: [],
    totals: {
      subtotal: { amount: 25000, currency: "BDT" },
      discountTotal: { amount: 2500, currency: "BDT" },
      taxTotal: { amount: 0, currency: "BDT" },
      grandTotal: { amount: 22500, currency: "BDT" },
      roundingAdjustment: { amount: 0, currency: "BDT" },
    },
    approvalsRequired: [],
    ...overrides,
  };
}

function renderPanel(onQuote = vi.fn()): { onQuote: typeof onQuote } {
  renderInBangla(
    <OrderQuotePanel
      organizationId="org-1"
      locationId="location-1"
      lines={[LINE]}
      orderDiscount={undefined}
      currency="BDT"
      locale="bn"
      labels={labels}
      onQuote={onQuote}
    />,
  );
  return { onQuote };
}

function squashInvisible(text: string): string {
  return text.replace(/[\s\u200e\u200f\u2066-\u2069\u202a-\u202e]/gu, "");
}

function money(amount: number): string {
  return squashInvisible(formatMoney({ amount, currency: "BDT" }, { locale: "bn" }));
}

beforeEach(() => {
  quoteOrderMock.mockReset();
});

afterEach(cleanup);

describe("OrderQuotePanel", () => {
  it("shows the quoter's totals and hands the quote to the screen", async () => {
    const quote = quoteWith();
    quoteOrderMock.mockResolvedValue(quote);
    const { onQuote } = renderPanel();

    await waitFor(() => {
      expect(onQuote).toHaveBeenCalledWith(quote);
    });
    expect(quoteOrderMock).toHaveBeenCalledWith("org-1", {
      locationId: "location-1",
      lines: [LINE],
    });

    const text = squashInvisible(document.body.textContent ?? "");
    expect(text).toContain(labels.title);
    expect(text).toContain(labels.subtotal);
    expect(text).toContain(labels.discount);
    expect(text).toContain(labels.total);
    expect(text).toContain(money(25000));
    expect(text).toContain(money(22500));
  });

  it("tells the screen when the quote fails and shows its message", async () => {
    quoteOrderMock.mockRejectedValue(new Error("network"));
    const { onQuote } = renderPanel();

    expect(await screen.findByText(labels.failed)).toBeDefined();
    expect(onQuote).toHaveBeenCalledWith(undefined);
  });

  it("warns when a discount needs approval", async () => {
    quoteOrderMock.mockResolvedValue(quoteWith({ approvalsRequired: [{ action: "DISCOUNT" }] }));
    renderPanel();

    expect(await screen.findByText(labels.approvalRequired)).toBeDefined();
  });

  it("renders nothing and does not quote while no line is picked", () => {
    const onQuote = vi.fn();
    renderInBangla(
      <OrderQuotePanel
        organizationId="org-1"
        locationId="location-1"
        lines={[]}
        orderDiscount={undefined}
        currency="BDT"
        locale="bn"
        labels={labels}
        onQuote={onQuote}
      />,
    );

    expect(quoteOrderMock).not.toHaveBeenCalled();
    expect(onQuote).toHaveBeenCalledWith(undefined);
    expect(screen.queryByText(labels.title)).toBeNull();
  });
});
