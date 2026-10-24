// @vitest-environment jsdom
import { I18nProvider } from "@banijjik/web-client/client";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UNIT_KEY, type UnitKey } from "@banijjik/contracts/catalog";
import { banglaText, banglaTranslator } from "../auth/test-helpers";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const receiveStock = vi.fn();
const adjustStock = vi.fn();
const searchInventoryItems = vi.fn();
vi.mock("./stock-api", () => ({
  receiveStock: (...args: unknown[]) => receiveStock(...args),
  adjustStock: (...args: unknown[]) => adjustStock(...args),
  searchInventoryItems: (...args: unknown[]) => searchInventoryItems(...args),
  listApprovers: vi.fn(),
  grantApproval: vi.fn(),
}));

const { ReceiveStockSheet } = await import("./receive-stock-sheet");
const { AdjustStockSheet } = await import("./adjust-stock-sheet");
const { receiveStockLabelsOf, adjustStockLabelsOf, itemPickerLabelsOf } =
  await import("./stock-labels");

const { t } = banglaTranslator();
const labels = receiveStockLabelsOf(t);
const pickerLabels = itemPickerLabelsOf(t);

const locations = [
  {
    locationId: "loc-1",
    name: "মূল",
    status: "ACTIVE" as const,
    version: 1,
    organizationId: "org-1",
    locationType: "STORE" as const,
    isDefault: true,
    createdAt: "",
    updatedAt: "",
  },
];
const item = {
  inventoryItemId: "item-rice",
  name: "চাল",
  baseUnitKey: "GRAM" as const,
  status: "ACTIVE" as const,
};

function renderReceive(): void {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <ReceiveStockSheet
        organizationId="org-1"
        currency="BDT"
        locations={locations}
        defaultLocationId="loc-1"
        labels={labels}
        pickerLabels={pickerLabels}
        unitLabels={
          Object.fromEntries(
            Object.values(UNIT_KEY).map((unitKey) => [
              unitKey,
              banglaText(`catalog.unit.${unitKey}`),
            ]),
          ) as Record<UnitKey, string>
        }
        onClose={vi.fn()}
      />
    </I18nProvider>,
  );
}

beforeEach(() => {
  receiveStock.mockReset().mockResolvedValue(undefined);
  adjustStock.mockReset().mockResolvedValue(undefined);
  searchInventoryItems.mockReset().mockResolvedValue([item]);
  refresh.mockReset();
});

describe("ReceiveStockSheet", () => {
  it("searches for an item and posts a receipt with an idempotency key", async () => {
    renderReceive();

    await userEvent.type(screen.getByLabelText(labels.item), "চাল");
    await waitFor(() => expect(searchInventoryItems).toHaveBeenCalled());
    await userEvent.click(await screen.findByRole("button", { name: /চাল/u }));

    await userEvent.type(screen.getByLabelText(labels.quantity), "1000");
    await userEvent.type(screen.getByLabelText(labels.unitCost), "50");
    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    await waitFor(() => expect(receiveStock).toHaveBeenCalledTimes(1));
    expect(receiveStock.mock.calls[0]?.[1]).toMatchObject({
      locationId: "loc-1",
      paidVia: "CASH",
      lines: [
        {
          inventoryItemId: "item-rice",
          quantity: 1000,
          unitCost: { amount: 5000, currency: "BDT" },
        },
      ],
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("posts a receipt with ON_CREDIT paidVia when selected", async () => {
    renderReceive();

    await userEvent.type(screen.getByLabelText(labels.item), "চাল");
    await waitFor(() => expect(searchInventoryItems).toHaveBeenCalled());
    await userEvent.click(await screen.findByRole("button", { name: /চাল/u }));

    await userEvent.selectOptions(screen.getByLabelText(labels.paidVia), "ON_CREDIT");

    await userEvent.type(screen.getByLabelText(labels.quantity), "1000");
    await userEvent.type(screen.getByLabelText(labels.unitCost), "50");
    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    await waitFor(() => expect(receiveStock).toHaveBeenCalledTimes(1));
    expect(receiveStock.mock.calls[0]?.[1]).toMatchObject({
      locationId: "loc-1",
      paidVia: "ON_CREDIT",
      lines: [
        {
          inventoryItemId: "item-rice",
          quantity: 1000,
          unitCost: { amount: 5000, currency: "BDT" },
        },
      ],
    });
  });
});

describe("AdjustStockSheet", () => {
  it("posts a positive adjustment", async () => {
    const adjustLabels = {
      ...adjustStockLabelsOf(t),
      title: adjustStockLabelsOf(t).title,
      close: adjustStockLabelsOf(t).close,
    };
    render(
      <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
        <AdjustStockSheet
          organizationId="org-1"
          locations={locations}
          defaultLocationId="loc-1"
          labels={adjustLabels}
          pickerLabels={pickerLabels}
          onClose={vi.fn()}
        />
      </I18nProvider>,
    );

    await userEvent.type(screen.getByLabelText(adjustLabels.item), "চাল");
    await waitFor(() => expect(searchInventoryItems).toHaveBeenCalled());
    await userEvent.click(await screen.findByRole("button", { name: /চাল/u }));
    await userEvent.type(screen.getByLabelText(adjustLabels.quantityDelta), "5");
    await userEvent.click(screen.getByRole("button", { name: adjustLabels.save }));

    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(1));
    expect(adjustStock.mock.calls[0]?.[1]).toMatchObject({
      locationId: "loc-1",
      lines: [{ inventoryItemId: "item-rice", quantityDelta: 5, reason: "ADJUSTMENT" }],
    });
  });
});
