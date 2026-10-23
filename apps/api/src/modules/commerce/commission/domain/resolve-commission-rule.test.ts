import type { Money } from "@banijjik/contracts/accounting";
import {
  COMMISSION_ALL_TARGET_VALUE,
  COMMISSION_CALCULATION,
  COMMISSION_SUBJECT_TYPE,
  COMMISSION_TARGET_TYPE,
} from "@banijjik/contracts/commission";
import { describe, expect, it } from "vitest";
import {
  computeCommissionAmount,
  resolveCommissionRule,
  type CommissionRuleCandidate,
  type CommissionSubjectFacts,
} from "./resolve-commission-rule.js";

const MEMBER = "member-1";
const ROLE_STYLIST = "role-stylist";
const ROLE_SENIOR = "role-senior";
const OFFERING = "offering-1";
const CATEGORY = "category-1";

function bdt(amount: number): Money {
  return { amount, currency: "BDT" };
}

const FACTS: CommissionSubjectFacts = {
  memberId: MEMBER,
  roleIds: [ROLE_STYLIST],
  offeringId: OFFERING,
  offeringKind: "SERVICE",
  categoryIds: [CATEGORY],
  base: bdt(100_000),
  quantity: 1,
};

let nextRuleNumber = 0;

function rule(overrides: Partial<CommissionRuleCandidate>): CommissionRuleCandidate {
  nextRuleNumber += 1;
  return {
    commissionRuleId: `rule-${String(nextRuleNumber).padStart(3, "0")}`,
    subjectType: COMMISSION_SUBJECT_TYPE.MEMBER,
    subjectId: MEMBER,
    targetType: COMMISSION_TARGET_TYPE.ALL,
    targetValue: COMMISSION_ALL_TARGET_VALUE,
    calculation: COMMISSION_CALCULATION.PERCENT,
    percentBasisPoints: 1000,
    fixedAmount: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function matchedRuleId(
  rules: readonly CommissionRuleCandidate[],
  facts: CommissionSubjectFacts = FACTS,
): string | undefined {
  const resolution = resolveCommissionRule(facts, rules);
  return resolution.outcome === "MATCHED" ? resolution.rule.commissionRuleId : undefined;
}

describe("resolveCommissionRule", () => {
  it("prefers a member rule over a role rule even when the role rule pays more", () => {
    const memberRule = rule({ commissionRuleId: "member-rule", percentBasisPoints: 500 });
    const roleRule = rule({
      commissionRuleId: "role-rule",
      subjectType: COMMISSION_SUBJECT_TYPE.ROLE,
      subjectId: ROLE_STYLIST,
      percentBasisPoints: 3000,
    });
    expect(matchedRuleId([roleRule, memberRule])).toBe("member-rule");
  });

  it("prefers OFFERING over CATEGORY over KIND over ALL", () => {
    const all = rule({ commissionRuleId: "all", percentBasisPoints: 9000 });
    const kind = rule({
      commissionRuleId: "kind",
      targetType: COMMISSION_TARGET_TYPE.KIND,
      targetValue: "SERVICE",
      percentBasisPoints: 8000,
    });
    const category = rule({
      commissionRuleId: "category",
      targetType: COMMISSION_TARGET_TYPE.CATEGORY,
      targetValue: CATEGORY,
      percentBasisPoints: 7000,
    });
    const offering = rule({
      commissionRuleId: "offering",
      targetType: COMMISSION_TARGET_TYPE.OFFERING,
      targetValue: OFFERING,
      percentBasisPoints: 100,
    });
    expect(matchedRuleId([all, kind, category, offering])).toBe("offering");
    expect(matchedRuleId([all, kind, category])).toBe("category");
    expect(matchedRuleId([all, kind])).toBe("kind");
    expect(matchedRuleId([all])).toBe("all");
  });

  it("ignores a rule whose target is another offering, category or kind", () => {
    const otherOffering = rule({
      targetType: COMMISSION_TARGET_TYPE.OFFERING,
      targetValue: "another-offering",
    });
    const otherCategory = rule({
      targetType: COMMISSION_TARGET_TYPE.CATEGORY,
      targetValue: "another-category",
    });
    const otherKind = rule({ targetType: COMMISSION_TARGET_TYPE.KIND, targetValue: "PRODUCT" });
    expect(resolveCommissionRule(FACTS, [otherOffering, otherCategory, otherKind])).toEqual({
      outcome: "NO_RULE",
    });
  });

  it("gives two role rules at the same step to the one with the higher amount", () => {
    const stylist = rule({
      commissionRuleId: "stylist",
      subjectType: COMMISSION_SUBJECT_TYPE.ROLE,
      subjectId: ROLE_STYLIST,
      percentBasisPoints: 1000,
    });
    const senior = rule({
      commissionRuleId: "senior",
      subjectType: COMMISSION_SUBJECT_TYPE.ROLE,
      subjectId: ROLE_SENIOR,
      percentBasisPoints: 1500,
    });
    const facts = { ...FACTS, roleIds: [ROLE_STYLIST, ROLE_SENIOR] };
    expect(matchedRuleId([stylist, senior], facts)).toBe("senior");
  });

  it("breaks a tie by the older rule, then by the lower rule ID", () => {
    const newer = rule({
      commissionRuleId: "a-newer",
      createdAt: new Date("2026-03-01T00:00:00Z"),
    });
    const older = rule({
      commissionRuleId: "z-older",
      createdAt: new Date("2026-02-01T00:00:00Z"),
    });
    expect(matchedRuleId([newer, older])).toBe("z-older");
    const sameAgeLowId = rule({ commissionRuleId: "a-low" });
    const sameAgeHighId = rule({ commissionRuleId: "b-high" });
    expect(matchedRuleId([sameAgeHighId, sameAgeLowId])).toBe("a-low");
  });

  it("does not count a role the member holds only at another location", () => {
    const roleRule = rule({
      subjectType: COMMISSION_SUBJECT_TYPE.ROLE,
      subjectId: ROLE_SENIOR,
    });
    expect(resolveCommissionRule({ ...FACTS, roleIds: [ROLE_STYLIST] }, [roleRule])).toEqual({
      outcome: "NO_RULE",
    });
  });

  it("counts a role the member holds at ALL locations", () => {
    const roleRule = rule({
      commissionRuleId: "all-locations-role",
      subjectType: COMMISSION_SUBJECT_TYPE.ROLE,
      subjectId: ROLE_SENIOR,
    });
    // The caller passes the roles held at the location or at ALL; an ALL assignment is just another role ID here.
    expect(matchedRuleId([roleRule], { ...FACTS, roleIds: [ROLE_SENIOR] })).toBe(
      "all-locations-role",
    );
  });

  it("returns NO_RULE when no rule matches", () => {
    expect(resolveCommissionRule(FACTS, [])).toEqual({ outcome: "NO_RULE" });
  });

  it("reports a currency mismatch for a fixed rule in another currency", () => {
    const foreign = rule({
      commissionRuleId: "foreign",
      calculation: COMMISSION_CALCULATION.FIXED,
      percentBasisPoints: null,
      fixedAmount: { amount: 5000, currency: "USD" as unknown as Money["currency"] },
    });
    expect(resolveCommissionRule(FACTS, [foreign])).toEqual({
      outcome: "CURRENCY_MISMATCH",
      commissionRuleId: "foreign",
    });
  });

  it("gives no commission when the amount rounds down to zero", () => {
    const tiny = rule({ percentBasisPoints: 1 });
    expect(resolveCommissionRule({ ...FACTS, base: bdt(5000) }, [tiny])).toEqual({
      outcome: "NO_RULE",
    });
  });
});

describe("computeCommissionAmount", () => {
  const percent = (basisPoints: number) => ({
    calculation: COMMISSION_CALCULATION.PERCENT,
    percentBasisPoints: basisPoints,
    fixedAmount: null,
  });

  it("floors a percentage in integer minor units (1250 basis points of 999 is 124)", () => {
    expect(computeCommissionAmount(percent(1250), bdt(999), 1)).toEqual(bdt(124));
  });

  it("multiplies a fixed amount by the quantity", () => {
    const fixed = {
      calculation: COMMISSION_CALCULATION.FIXED,
      percentBasisPoints: null,
      fixedAmount: bdt(2000),
    };
    expect(computeCommissionAmount(fixed, bdt(100_000), 3)).toEqual(bdt(6000));
  });

  it("clamps the commission to the base", () => {
    const fixed = {
      calculation: COMMISSION_CALCULATION.FIXED,
      percentBasisPoints: null,
      fixedAmount: bdt(80_000),
    };
    expect(computeCommissionAmount(fixed, bdt(100_000), 2)).toEqual(bdt(100_000));
    expect(computeCommissionAmount(percent(10_000), bdt(100_000), 1)).toEqual(bdt(100_000));
  });

  it("gives zero for a base of zero", () => {
    expect(computeCommissionAmount(percent(1000), bdt(0), 1)).toEqual(bdt(0));
  });

  it("gives no amount when a fixed rule is in another currency", () => {
    const foreign = {
      calculation: COMMISSION_CALCULATION.FIXED,
      percentBasisPoints: null,
      fixedAmount: { amount: 100, currency: "USD" as unknown as Money["currency"] },
    };
    expect(computeCommissionAmount(foreign, bdt(100_000), 1)).toBeUndefined();
  });
});
