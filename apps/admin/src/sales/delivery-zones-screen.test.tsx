// @vitest-environment jsdom
import { CURRENCY_CODE } from "@banijjik/contracts";
import type { DeliveryZone } from "@banijjik/contracts/sales/delivery";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { deliveryZoneLabelsOf } from "./delivery-zone-labels";
import { DeliveryZonesScreen } from "./delivery-zones-screen";

const createDeliveryZoneMock = vi.fn();
const updateDeliveryZoneMock = vi.fn();
vi.mock("./order-api", () => ({
  createDeliveryZone: (...args: unknown[]) => createDeliveryZoneMock(...args),
  updateDeliveryZone: (...args: unknown[]) => updateDeliveryZoneMock(...args),
}));

const SAMPLE_ZONE: DeliveryZone = {
  deliveryZoneId: "0190f0a0-0000-7000-8000-000000000001",
  zoneKey: "dhaka-inside",
  name: { en: "Inside Dhaka", bn: "ঢাকার ভেতরে" },
  areaCodes: ["dhk-gulshan", "dhk-banani"],
  fee: { currency: CURRENCY_CODE.BDT, amount: 6000 },
  status: "ACTIVE",
  version: 1,
};

function renderScreen(zones: readonly DeliveryZone[] = [SAMPLE_ZONE], canManage = true) {
  const t = banglaTranslator().t;
  const labels = deliveryZoneLabelsOf(t);
  renderInBangla(
    <DeliveryZonesScreen
      orgSlug="acme"
      organizationId="0190f0a0-0000-7000-8000-000000000002"
      initialZones={zones}
      currency={CURRENCY_CODE.BDT}
      labels={labels}
      locale="bn"
      canManage={canManage}
    />,
  );
  return { labels };
}

describe("DeliveryZonesScreen", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the zone list in Bangla with fee and area codes", () => {
    renderScreen();
    expect(screen.getByText("ঢাকার ভেতরে")).toBeDefined();
    expect(screen.getByText("(dhaka-inside)")).toBeDefined();
    expect(screen.getByText(/dhk-gulshan/)).toBeDefined();
  });

  it("shows empty state when no zones exist", () => {
    const { labels } = renderScreen([]);
    expect(screen.getByText(labels.empty)).toBeDefined();
  });

  it("opens create form when new button is clicked and can cancel", async () => {
    const user = userEvent.setup();
    const { labels } = renderScreen();
    await user.click(screen.getByRole("button", { name: labels.newZone }));
    expect(screen.getByText(labels.createTitle)).toBeDefined();

    await user.click(screen.getByRole("button", { name: labels.cancel }));
    await waitFor(() => {
      expect(screen.queryByText(labels.createTitle)).toBeNull();
    });
  });

  it("opens edit form when edit button is clicked with current values", async () => {
    const user = userEvent.setup();
    const { labels } = renderScreen();
    await user.click(screen.getByRole("button", { name: labels.edit }));
    expect(screen.getByText(labels.editTitle)).toBeDefined();
  });

  it("saves an updated zone through updateDeliveryZone", async () => {
    const user = userEvent.setup();
    const updatedZone: DeliveryZone = {
      ...SAMPLE_ZONE,
      version: 2,
      fee: { currency: CURRENCY_CODE.BDT, amount: 8000 },
    };
    updateDeliveryZoneMock.mockResolvedValueOnce(updatedZone);
    const { labels } = renderScreen();

    await user.click(screen.getByRole("button", { name: labels.edit }));
    await user.click(screen.getByRole("button", { name: labels.save }));

    await waitFor(() => {
      expect(updateDeliveryZoneMock).toHaveBeenCalledTimes(1);
    });
  });
});
