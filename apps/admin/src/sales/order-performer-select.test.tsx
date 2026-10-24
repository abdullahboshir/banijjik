// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { listPerformers } from "./order-api";
import { orderLabelsOf } from "./order-labels";
import { OrderPerformerSelect, type OrderPerformerSelectProps } from "./order-performer-select";

vi.mock("./order-api", () => ({
  listPerformers: vi.fn(),
}));

const labels = orderLabelsOf(banglaTranslator().t).line;
const FIRST_MEMBER = "0190f0a0-0000-7000-8000-000000000001";
const FORMER_MEMBER = "0190f0a0-0000-7000-8000-000000000009";

function renderSelect(overrides: Partial<OrderPerformerSelectProps> = {}, onChange = vi.fn()) {
  renderInBangla(
    <OrderPerformerSelect
      organizationId="org-1"
      locationId="loc-1"
      id="order-performer-0"
      value={null}
      disabled={false}
      labels={labels}
      onChange={onChange}
      {...overrides}
    />,
  );
  return onChange;
}

describe("OrderPerformerSelect", () => {
  it("lists the members of the location by name and reports the chosen member id", async () => {
    vi.mocked(listPerformers).mockResolvedValue([{ memberId: FIRST_MEMBER, name: "রহিম" }]);
    const onChange = renderSelect();

    const option = await screen.findByRole("option", { name: "রহিম" });
    fireEvent.change(screen.getByLabelText(labels.performer), {
      target: { value: FIRST_MEMBER },
    });

    expect(option).toBeDefined();
    expect(onChange).toHaveBeenCalledWith(FIRST_MEMBER);
  });

  it("reports no performer when the empty choice is picked", async () => {
    vi.mocked(listPerformers).mockResolvedValue([{ memberId: FIRST_MEMBER, name: "রহিম" }]);
    const onChange = renderSelect({ value: FIRST_MEMBER });
    await screen.findByRole("option", { name: "রহিম" });

    fireEvent.change(screen.getByLabelText(labels.performer), { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows the failure message and keeps the select usable when the staff list cannot load", async () => {
    vi.mocked(listPerformers).mockRejectedValue(new Error("network"));
    renderSelect();

    await waitFor(() => {
      expect(screen.getByText(labels.performerLoadFailed)).toBeDefined();
    });
    expect(screen.getByLabelText(labels.performer)).toBeDefined();
  });

  it("keeps a former staff member on the line under the neutral label", async () => {
    vi.mocked(listPerformers).mockResolvedValue([{ memberId: FIRST_MEMBER, name: "রহিম" }]);
    renderSelect({ value: FORMER_MEMBER });

    expect(await screen.findByRole("option", { name: labels.performerUnknown })).toBeDefined();
  });
});
