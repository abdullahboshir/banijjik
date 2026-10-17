import { INDUSTRY_TEMPLATE_STATUS } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import {
  templateLockMessageKey,
  templateRefusesRemoval,
  templateStatusActions,
} from "./template-status";

describe("templateStatusActions", () => {
  it("shows publish and retire only to someone who can write, and only on the allowed status", () => {
    expect(templateStatusActions(INDUSTRY_TEMPLATE_STATUS.DRAFT, true)).toEqual(["publish"]);
    expect(templateStatusActions(INDUSTRY_TEMPLATE_STATUS.RETIRED, true)).toEqual(["publish"]);
    expect(templateStatusActions(INDUSTRY_TEMPLATE_STATUS.PUBLISHED, true)).toEqual(["retire"]);
    expect(templateStatusActions(INDUSTRY_TEMPLATE_STATUS.DRAFT, false)).toEqual([]);
    expect(templateStatusActions(INDUSTRY_TEMPLATE_STATUS.PUBLISHED, false)).toEqual([]);
  });

  it("refuses removals once the template is published or retired", () => {
    expect(templateRefusesRemoval({ status: INDUSTRY_TEMPLATE_STATUS.DRAFT, isInUse: false })).toBe(
      false,
    );
    expect(
      templateRefusesRemoval({ status: INDUSTRY_TEMPLATE_STATUS.PUBLISHED, isInUse: false }),
    ).toBe(true);
    expect(
      templateRefusesRemoval({ status: INDUSTRY_TEMPLATE_STATUS.RETIRED, isInUse: false }),
    ).toBe(true);
  });

  it("refuses removals on a draft an organization already uses (Phase 2 review carry-over, 2.6 R1-3)", () => {
    expect(templateRefusesRemoval({ status: INDUSTRY_TEMPLATE_STATUS.DRAFT, isInUse: true })).toBe(
      true,
    );
  });
});

describe("templateLockMessageKey", () => {
  it('names the status for a published or retired template, and "in use" for a used draft', () => {
    expect(
      templateLockMessageKey({ status: INDUSTRY_TEMPLATE_STATUS.PUBLISHED, isInUse: true }),
    ).toBe("platform.industry.locked.PUBLISHED");
    expect(templateLockMessageKey({ status: INDUSTRY_TEMPLATE_STATUS.DRAFT, isInUse: true })).toBe(
      "platform.industry.locked.IN_USE",
    );
  });

  it("shows no banner for a draft nobody uses", () => {
    expect(
      templateLockMessageKey({ status: INDUSTRY_TEMPLATE_STATUS.DRAFT, isInUse: false }),
    ).toBeUndefined();
  });
});
