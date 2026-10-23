// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { banglaText, banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { DuesList } from "./dues-list";

describe("dues list and empty state", () => {
  it("shows dues with their request type, status, money and contact link", () => {
    renderInBangla(
      <DuesList
        orgSlug="acme"
        locale="bn"
        t={banglaTranslator().t}
        items={[
          {
            requestType: "BOOKING",
            requestId: "booking-1",
            contactId: "contact-1",
            locationId: "location-1",
            total: { amount: 10000, currency: "BDT" },
            allocated: { amount: 4000, currency: "BDT" },
            refunded: { amount: 0, currency: "BDT" },
            due: { amount: 6000, currency: "BDT" },
            paymentStatus: "PARTIAL",
          },
        ]}
      />,
    );
    expect(screen.getByText(banglaText("dues.type.BOOKING"))).toBeTruthy();
    expect(screen.getByText(banglaText("dues.status.PARTIAL"))).toBeTruthy();
    expect(screen.getByText(/60/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: banglaText("dues.contact") }).getAttribute("href"),
    ).toBe("/acme/contacts/contact-1");
  });

  it("shows the empty state when no dues match", () => {
    renderInBangla(<DuesList items={[]} orgSlug="acme" locale="bn" t={banglaTranslator().t} />);
    expect(screen.getByText(banglaText("dues.empty"))).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
