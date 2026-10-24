// @vitest-environment jsdom
import type { Money } from "@banijjik/contracts/catalog";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderInBangla } from "../auth/test-helpers";
import type { EventSessionView } from "./event-session-api";
import { NewBookingEventStep, NewBookingRentalStep } from "./new-booking-mode-fields";

const TOTAL: Money = { amount: 250000, currency: "BDT" };

function session(patch: Partial<EventSessionView>): EventSessionView {
  return {
    eventSessionId: "session-1",
    offeringId: "o",
    variantId: "v",
    locationId: "l",
    startsAt: "2026-12-01T04:00:00.000Z",
    endsAt: "2026-12-01T06:00:00.000Z",
    capacity: 10,
    seatsSold: 0,
    status: "SCHEDULED",
    version: 1,
    ...patch,
  };
}

describe("NewBookingRentalStep", () => {
  it("shows the computed end and the quoted price for the chosen units", () => {
    renderInBangla(
      <NewBookingRentalStep
        rental={{ rateUnit: "DAY", minUnits: 1, resourceTypeKeys: ["ROOM"] }}
        timeZone="Asia/Dhaka"
        locale="bn"
        startsAt="2026-12-01T04:00:00.000Z"
        quantity="2"
        resourceId=""
        resources={[]}
        total={TOTAL}
        quoteLoading={false}
        onStartChange={vi.fn()}
        onQuantityChange={vi.fn()}
        onResourceChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("new-booking-rental-end")).toBeTruthy();
    expect(screen.getByTestId("new-booking-price").textContent).toContain("2,500");
  });

  it("reports the units the person types", async () => {
    const onQuantityChange = vi.fn();
    renderInBangla(
      <NewBookingRentalStep
        rental={{ rateUnit: "HOUR", minUnits: 1, resourceTypeKeys: [] }}
        timeZone="Asia/Dhaka"
        locale="bn"
        startsAt=""
        quantity="1"
        resourceId=""
        resources={[]}
        total={null}
        quoteLoading={false}
        onStartChange={vi.fn()}
        onQuantityChange={onQuantityChange}
        onResourceChange={vi.fn()}
      />,
    );
    await userEvent.setup().type(document.querySelector("#new-booking-quantity") as Element, "3");
    expect(onQuantityChange).toHaveBeenLastCalledWith("13");
    expect(screen.queryByTestId("new-booking-price")).toBeNull();
  });
});

describe("NewBookingEventStep", () => {
  it("lets the person pick a session with seats left and disables a sold-out one", async () => {
    const onPickSession = vi.fn();
    const open = session({ eventSessionId: "open", seatsSold: 4 });
    const full = session({ eventSessionId: "full", seatsSold: 10 });
    renderInBangla(
      <NewBookingEventStep
        sessions={[open, full]}
        sessionsLoading={false}
        eventSessionId=""
        quantity="2"
        timeZone="Asia/Dhaka"
        locale="bn"
        total={TOTAL}
        quoteLoading={false}
        onPickSession={onPickSession}
        onQuantityChange={vi.fn()}
      />,
    );
    const buttons = screen.getAllByTestId("new-booking-session") as HTMLButtonElement[];
    expect(buttons[1]?.disabled).toBe(true);
    await userEvent.setup().click(buttons[0] as HTMLButtonElement);
    expect(onPickSession).toHaveBeenCalledWith(open);
    expect(screen.getByTestId("new-booking-price")).toBeTruthy();
  });
});
