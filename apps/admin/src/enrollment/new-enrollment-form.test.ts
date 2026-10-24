import { PLAN_START_RULE } from "@banijjik/contracts/catalog";
import { describe, expect, it } from "vitest";
import {
  buildEnrollmentCreate,
  emptyNewEnrollmentForm,
  resourcesAt,
  withPlanChosen,
  type PlanChoice,
} from "./new-enrollment-form";

const LOCATION_ID = "01900000-0000-7000-8000-000000000001";
const CONTACT_ID = "01900000-0000-7000-8000-000000000002";
const PLAN_ID = "01900000-0000-7000-8000-000000000010";
const VARIANT_ID = "01900000-0000-7000-8000-000000000011";

const anyDatePlan: PlanChoice = {
  offeringId: PLAN_ID,
  name: "Monthly",
  startRule: PLAN_START_RULE.ANY_DATE,
  startDates: [],
  variants: [{ variantId: VARIANT_ID, name: "Default" }],
};

describe("new enrollment form", () => {
  it("is refused with a field error for every missing choice", () => {
    const form = emptyNewEnrollmentForm({ locationId: LOCATION_ID, today: "2026-10-24" });
    const built = buildEnrollmentCreate(form, CONTACT_ID);
    expect(built.ok).toBe(false);
    if (!built.ok)
      expect(Object.keys(built.errors).sort()).toEqual(["contact", "offeringId", "variantId"]);
  });

  it("builds the create body with the bed as a resource id", () => {
    const form = {
      ...withPlanChosen(
        emptyNewEnrollmentForm({ locationId: LOCATION_ID, today: "2026-10-24" }),
        anyDatePlan,
        "2026-10-24",
      ),
      contact: CONTACT_ID,
      variantId: VARIANT_ID,
      resourceId: "01900000-0000-7000-8000-000000000020",
    };
    const built = buildEnrollmentCreate(form, CONTACT_ID);
    expect(built).toEqual({
      ok: true,
      body: {
        locationId: LOCATION_ID,
        contactId: CONTACT_ID,
        offeringId: PLAN_ID,
        variantId: VARIANT_ID,
        startsOn: "2026-10-24",
        resourceIds: ["01900000-0000-7000-8000-000000000020"],
        customFields: {},
      },
    });
  });

  it("clears the start date when a fixed-date plan is chosen, so one of its dates must be picked", () => {
    const fixedPlan: PlanChoice = {
      ...anyDatePlan,
      startRule: PLAN_START_RULE.FIXED_DATES,
      startDates: ["2026-11-01"],
    };
    const form = emptyNewEnrollmentForm({ locationId: LOCATION_ID, today: "2026-10-24" });
    expect(withPlanChosen(form, fixedPlan, "2026-10-24").startsOn).toBe("");
  });

  it("offers only the beds of the chosen location", () => {
    const beds = [
      { resourceId: "a", locationId: LOCATION_ID, name: "Bed 1" },
      { resourceId: "b", locationId: "other", name: "Bed 2" },
    ];
    expect(resourcesAt(beds, LOCATION_ID).map((bed) => bed.resourceId)).toEqual(["a"]);
  });
});
