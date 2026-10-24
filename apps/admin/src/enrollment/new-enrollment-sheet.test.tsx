// @vitest-environment jsdom
import { PLAN_START_RULE, type PlanStartRule } from "@banijjik/contracts/catalog";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { newEnrollmentLabelsOf } from "./new-enrollment-labels";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./enrollment-api", () => ({ createEnrollment: vi.fn() }));
vi.mock("../contacts/contact-api", () => ({
  searchContacts: vi.fn().mockResolvedValue([]),
  createContact: vi.fn(),
}));

const { NewEnrollmentSheet } = await import("./new-enrollment-sheet");

const PLAN_ID = "01900000-0000-7000-8000-000000000010";

function renderSheet(startRule: PlanStartRule) {
  renderInBangla(
    <NewEnrollmentSheet
      organizationId="org-1"
      locationId="loc-1"
      today="2026-10-24"
      locations={[{ locationId: "loc-1", name: "প্রধান শাখা" }]}
      plans={[
        {
          offeringId: PLAN_ID,
          name: "মাসিক",
          startRule,
          startDates: ["2026-11-01"],
          variants: [{ variantId: "variant-1", name: "সাধারণ" }],
        },
      ]}
      resources={[{ resourceId: "bed-1", locationId: "loc-1", name: "বেড ১" }]}
      labels={newEnrollmentLabelsOf({
        t: banglaTranslator().t,
        enrollmentTerm: "মেম্বারশিপ",
        planTerm: "প্ল্যান",
        resourceTerm: "রিসোর্স",
      })}
      onClose={() => {}}
    />,
  );
}

describe("NewEnrollmentSheet", () => {
  it("lists the variants of the chosen plan and the beds of the location", async () => {
    renderSheet(PLAN_START_RULE.ANY_DATE);
    await userEvent
      .setup()
      .selectOptions(document.querySelector("#new-enrollment-plan") as HTMLElement, PLAN_ID);
    expect(screen.getByRole("option", { name: "সাধারণ" })).toBeDefined();
    expect(screen.getByRole("option", { name: "বেড ১" })).toBeDefined();
  });

  it("offers only the plan's fixed dates when the plan starts on fixed dates", async () => {
    renderSheet(PLAN_START_RULE.FIXED_DATES);
    await userEvent
      .setup()
      .selectOptions(document.querySelector("#new-enrollment-plan") as HTMLElement, PLAN_ID);
    expect(screen.getByRole("option", { name: "2026-11-01" })).toBeDefined();
    expect(document.querySelector("input[type=date]")).toBeNull();
  });
});
