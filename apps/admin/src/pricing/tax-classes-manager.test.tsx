// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText, banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { taxClassLabelsOf } from "./pricing-labels";
import { ratePercentToBasisPoints, TaxClassesManager } from "./tax-classes-manager";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const createTaxClass = vi.fn();
const archiveTaxClass = vi.fn();
vi.mock("./pricing-api", () => ({
  createTaxClass: (...args: unknown[]) => createTaxClass(...args),
  archiveTaxClass: (...args: unknown[]) => archiveTaxClass(...args),
}));

const { t } = banglaTranslator();
const labels = taxClassLabelsOf(t);

beforeEach(() => {
  createTaxClass.mockReset();
  archiveTaxClass.mockReset();
});

describe("ratePercentToBasisPoints", () => {
  it("turns a percent string into basis points without floats", () => {
    expect(ratePercentToBasisPoints("7.5")).toBe(750);
    expect(ratePercentToBasisPoints("10")).toBe(1000);
    expect(ratePercentToBasisPoints("0.5")).toBe(50);
    expect(ratePercentToBasisPoints("7.55")).toBe(755);
    expect(ratePercentToBasisPoints("abc")).toBeUndefined();
  });
});

describe("TaxClassesManager", () => {
  it("creates a tax class with the rate in basis points", async () => {
    createTaxClass.mockResolvedValue({
      taxClassId: "t-1",
      taxClassKey: "vat-standard",
      name: "VAT",
      rateBasisPoints: 750,
      status: "ACTIVE",
      version: 1,
    });
    renderInBangla(
      <TaxClassesManager organizationId="org-1" taxClasses={[]} labels={labels} canUpdate />,
    );
    await userEvent.type(screen.getByLabelText(labels["taxClasses.key"]), "vat-standard");
    await userEvent.type(screen.getByLabelText(labels["taxClasses.name"]), "VAT");
    await userEvent.type(screen.getByLabelText(labels["taxClasses.rate"]), "7.5");
    await userEvent.click(screen.getByRole("button", { name: labels["taxClasses.save"] }));
    await waitFor(() => expect(createTaxClass).toHaveBeenCalled());
    expect(createTaxClass.mock.calls[0]?.[1]).toEqual({
      taxClassKey: "vat-standard",
      name: "VAT",
      rateBasisPoints: 750,
    });
  });

  it("shows the empty state when there are no classes", () => {
    renderInBangla(
      <TaxClassesManager
        organizationId="org-1"
        taxClasses={[]}
        labels={labels}
        canUpdate={false}
      />,
    );
    expect(screen.getByText(banglaText("pricing.taxClasses.empty"))).toBeTruthy();
  });
});
