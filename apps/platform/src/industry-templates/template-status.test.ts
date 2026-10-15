import { INDUSTRY_TEMPLATE_STATUS } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { templateRefusesRemoval, templateStatusActions } from "./template-status";

describe("templateStatusActions", () => {
  it("shows publish and retire only to someone who can write, and only on the allowed status", () => {
    expect(templateStatusActions(INDUSTRY_TEMPLATE_STATUS.DRAFT, true)).toEqual(["publish"]);
    expect(templateStatusActions(INDUSTRY_TEMPLATE_STATUS.RETIRED, true)).toEqual(["publish"]);
    expect(templateStatusActions(INDUSTRY_TEMPLATE_STATUS.PUBLISHED, true)).toEqual(["retire"]);
    expect(templateStatusActions(INDUSTRY_TEMPLATE_STATUS.DRAFT, false)).toEqual([]);
    expect(templateStatusActions(INDUSTRY_TEMPLATE_STATUS.PUBLISHED, false)).toEqual([]);
  });

  it("refuses removals once the template is published or retired", () => {
    expect(templateRefusesRemoval(INDUSTRY_TEMPLATE_STATUS.DRAFT)).toBe(false);
    expect(templateRefusesRemoval(INDUSTRY_TEMPLATE_STATUS.PUBLISHED)).toBe(true);
    expect(templateRefusesRemoval(INDUSTRY_TEMPLATE_STATUS.RETIRED)).toBe(true);
  });
});
