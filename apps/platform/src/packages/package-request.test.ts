import { LIMIT_KEY_VALUES, MODULE_KEY } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { packageResponse } from "../test-support/fixtures";
import { draftOf, newDraft, type PackageDraft } from "./package-draft";
import { buildCreateRequest, buildUpdateRequest } from "./package-request";

function filledDraft(overrides: Partial<PackageDraft> = {}): PackageDraft {
  const draft = newDraft();
  for (const limitKey of LIMIT_KEY_VALUES)
    draft.limits[limitKey] = { isUnlimited: false, value: "3" };
  return { ...draft, packageKey: "GOLD", name: "Gold", moduleKeys: [MODULE_KEY.POS], ...overrides };
}

describe("buildCreateRequest", () => {
  it("builds the request of a valid base package", async () => {
    const result = await buildCreateRequest(filledDraft());
    expect(result).toMatchObject({
      isValid: true,
      request: { packageKey: "GOLD", name: "Gold", isAddOn: false, moduleKeys: ["pos"] },
    });
  });

  it("sends an unlimited limit as null, not as zero", async () => {
    const draft = filledDraft();
    draft.limits.members = { isUnlimited: true, value: "" };
    const result = await buildCreateRequest(draft);
    expect(result.isValid && result.request.limits.members).toBeNull();
  });

  it("refuses an empty limit instead of treating it as zero", async () => {
    const draft = filledDraft();
    draft.limits.members = { isUnlimited: false, value: "" };
    const result = await buildCreateRequest(draft);
    expect(result).toMatchObject({ isValid: false, errors: { limits: expect.any(String) } });
  });

  it("refuses a missing name and a key that is not in capitals", async () => {
    const result = await buildCreateRequest(filledDraft({ name: "", packageKey: "gold" }));
    expect(result).toMatchObject({
      isValid: false,
      errors: { name: "validation.required", packageKey: expect.any(String) },
    });
  });

  it("sends the increments of an add-on only", async () => {
    const addOn = filledDraft({ isAddOn: true });
    addOn.increments.smsPerMonth = "500";
    const base = filledDraft();
    base.increments.smsPerMonth = "500";
    const addOnResult = await buildCreateRequest(addOn);
    const baseResult = await buildCreateRequest(base);
    expect(addOnResult.isValid && addOnResult.request.limitIncrements).toEqual({
      smsPerMonth: 500,
    });
    expect(baseResult.isValid && baseResult.request.limitIncrements).toBeUndefined();
  });
});

describe("buildUpdateRequest", () => {
  it("carries the version and the name of an operator-made package", async () => {
    const draft = draftOf(packageResponse({ version: 4 }));
    const result = await buildUpdateRequest(
      { ...draft, name: "Renamed" },
      { version: 4, canRename: true },
    );
    expect(result).toMatchObject({ isValid: true, request: { version: 4, name: "Renamed" } });
  });

  it("leaves the name out for a built-in package, which cannot be renamed", async () => {
    const draft = draftOf(packageResponse({ nameKey: "package.SHOP.name", name: null }));
    const result = await buildUpdateRequest(draft, { version: 1, canRename: false });
    expect(result.isValid && "name" in result.request).toBe(false);
  });
});
