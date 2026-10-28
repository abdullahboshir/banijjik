import { CONSERVATIVE_PAGE_RULES, LOCKED_TOKEN_GROUPS } from "@banijjik/contracts/website";
import { describe, expect, it } from "vitest";
import { siteEditPolicySchema } from "./site-policy.schema.js";

function conservativePolicy(): {
  regions: {
    regionKey: string;
    lock: string;
    required: boolean;
    sectionKeys: string[];
    maxSections: number;
    editableContentKeys: string[];
  }[];
  tokenGroups: typeof LOCKED_TOKEN_GROUPS;
  allowedColors: string[] | null;
  allowedVariantsBySection: Record<string, string[]>;
  pageRules: typeof CONSERVATIVE_PAGE_RULES;
} {
  return {
    regions: [
      {
        regionKey: "header",
        lock: "LOCKED",
        required: true,
        sectionKeys: ["header"],
        maxSections: 1,
        editableContentKeys: [],
      },
    ],
    tokenGroups: LOCKED_TOKEN_GROUPS,
    allowedColors: null,
    allowedVariantsBySection: { header: ["SIMPLE"] },
    pageRules: CONSERVATIVE_PAGE_RULES,
  };
}

describe("siteEditPolicySchema", () => {
  it("accepts a conservative first-adoption policy", () => {
    expect(siteEditPolicySchema.safeParse(conservativePolicy()).success).toBe(true);
  });

  it("rejects a variant that is not in the section registry", () => {
    const policy = conservativePolicy();
    policy.allowedVariantsBySection = { header: ["BANNER"] };
    expect(siteEditPolicySchema.safeParse(policy).success).toBe(false);
  });

  it("rejects an unknown section in the variant palette", () => {
    const policy = conservativePolicy();
    policy.allowedVariantsBySection = { ratings: ["STARS"] };
    expect(siteEditPolicySchema.safeParse(policy).success).toBe(false);
  });

  it("rejects extra policy fields", () => {
    expect(
      siteEditPolicySchema.safeParse({ ...conservativePolicy(), ownerBypass: true }).success,
    ).toBe(false);
  });
});
