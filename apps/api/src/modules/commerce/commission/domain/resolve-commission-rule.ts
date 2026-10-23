import type { Money } from "@banijjik/contracts/accounting";
import type { OfferingKind } from "@banijjik/contracts";
import {
  COMMISSION_ALL_TARGET_VALUE,
  COMMISSION_CALCULATION,
  COMMISSION_SUBJECT_TYPE,
  COMMISSION_TARGET_TYPE,
  type CommissionCalculation,
  type CommissionSubjectType,
  type CommissionTargetType,
} from "@banijjik/contracts/commission";

export interface CommissionRuleCandidate {
  readonly commissionRuleId: string;
  readonly subjectType: CommissionSubjectType;
  /** The member ID or the role ID, by `subjectType`. */
  readonly subjectId: string;
  readonly targetType: CommissionTargetType;
  /** `"*"` for ALL, otherwise the kind, category ID or offering ID, by `targetType`. */
  readonly targetValue: string;
  readonly calculation: CommissionCalculation;
  readonly percentBasisPoints: number | null;
  readonly fixedAmount: Money | null;
  readonly createdAt: Date;
}

export interface CommissionSubjectFacts {
  readonly memberId: string;
  /** The roles the member holds at the source location, or at ALL locations. */
  readonly roleIds: readonly string[];
  readonly offeringId: string;
  readonly offeringKind: OfferingKind;
  readonly categoryIds: readonly string[];
  /** The price after discount, without tax. */
  readonly base: Money;
  readonly quantity: number;
}

export type CommissionResolution =
  | { readonly outcome: "NO_RULE" }
  | { readonly outcome: "CURRENCY_MISMATCH"; readonly commissionRuleId: string }
  | {
      readonly outcome: "MATCHED";
      readonly rule: CommissionRuleCandidate;
      readonly amount: Money;
    };

const BASIS_POINTS_DIVISOR = 10_000;

/** `floor(amount × numerator / denominator)` in integers; BigInt keeps large minor-unit amounts exact. */
export function floorRatio(amount: number, numerator: number, denominator: number): number {
  return Number((BigInt(amount) * BigInt(numerator)) / BigInt(denominator));
}

type CalculationFields = Pick<
  CommissionRuleCandidate,
  "calculation" | "percentBasisPoints" | "fixedAmount"
>;

function rawAmountOf(rule: CalculationFields, base: Money, quantity: number): number | undefined {
  if (rule.calculation === COMMISSION_CALCULATION.PERCENT) {
    return floorRatio(base.amount, rule.percentBasisPoints ?? 0, BASIS_POINTS_DIVISOR);
  }
  if (rule.fixedAmount === null || rule.fixedAmount.currency !== base.currency) return undefined;
  return rule.fixedAmount.amount * quantity;
}

/**
 * The commission of one rule in integer minor units, clamped to `0 … base` so it never exceeds the
 * base. Undefined when a FIXED rule is in another currency than the base: the currencies are
 * compared, never assumed (a rule in another currency gives no entry).
 */
export function computeCommissionAmount(
  rule: CalculationFields,
  base: Money,
  quantity: number,
): Money | undefined {
  const raw = rawAmountOf(rule, base, quantity);
  if (raw === undefined) return undefined;
  return { amount: Math.min(Math.max(raw, 0), base.amount), currency: base.currency };
}

function matchesTarget(rule: CommissionRuleCandidate, facts: CommissionSubjectFacts): boolean {
  switch (rule.targetType) {
    case COMMISSION_TARGET_TYPE.OFFERING:
      return rule.targetValue === facts.offeringId;
    case COMMISSION_TARGET_TYPE.CATEGORY:
      return facts.categoryIds.includes(rule.targetValue);
    case COMMISSION_TARGET_TYPE.KIND:
      return rule.targetValue === facts.offeringKind;
    default:
      return rule.targetValue === COMMISSION_ALL_TARGET_VALUE;
  }
}

/** Inside a subject level the most specific target comes first. */
const TARGET_ORDER: readonly CommissionTargetType[] = [
  COMMISSION_TARGET_TYPE.OFFERING,
  COMMISSION_TARGET_TYPE.CATEGORY,
  COMMISSION_TARGET_TYPE.KIND,
  COMMISSION_TARGET_TYPE.ALL,
];

interface PricedRule {
  readonly rule: CommissionRuleCandidate;
  readonly amount: Money;
}

/** Higher amount first, then the older rule, then the lower ID: the same answer on every run. */
function isBetter(candidate: PricedRule, current: PricedRule): boolean {
  if (candidate.amount.amount !== current.amount.amount) {
    return candidate.amount.amount > current.amount.amount;
  }
  const byAge = candidate.rule.createdAt.getTime() - current.rule.createdAt.getTime();
  if (byAge !== 0) return byAge < 0;
  return candidate.rule.commissionRuleId < current.rule.commissionRuleId;
}

function bestOf(priced: readonly PricedRule[]): PricedRule | undefined {
  let best: PricedRule | undefined;
  for (const candidate of priced) {
    if (best === undefined || isBetter(candidate, best)) best = candidate;
  }
  return best;
}

interface SubjectLevel {
  readonly subjectType: CommissionSubjectType;
  readonly subjectIds: readonly string[];
}

/** Member rules come before role rules. */
function subjectLevels(facts: CommissionSubjectFacts): readonly SubjectLevel[] {
  return [
    { subjectType: COMMISSION_SUBJECT_TYPE.MEMBER, subjectIds: [facts.memberId] },
    { subjectType: COMMISSION_SUBJECT_TYPE.ROLE, subjectIds: facts.roleIds },
  ];
}

interface StepOutcome {
  readonly best: PricedRule | undefined;
  readonly mismatchedRuleId: string | undefined;
}

function priceStep(
  step: readonly CommissionRuleCandidate[],
  facts: CommissionSubjectFacts,
): StepOutcome {
  const priced: PricedRule[] = [];
  let mismatchedRuleId: string | undefined;
  for (const rule of step) {
    const amount = computeCommissionAmount(rule, facts.base, facts.quantity);
    if (amount === undefined) mismatchedRuleId ??= rule.commissionRuleId;
    else priced.push({ rule, amount });
  }
  return { best: bestOf(priced), mismatchedRuleId };
}

/**
 * Picks the rule that decides the commission (ADR-135). The first (level, target) step with at least
 * one matching rule decides; several rules at that step give the higher amount, then the older rule.
 */
export function resolveCommissionRule(
  facts: CommissionSubjectFacts,
  rules: readonly CommissionRuleCandidate[],
): CommissionResolution {
  let mismatchedRuleId: string | undefined;
  for (const level of subjectLevels(facts)) {
    for (const targetType of TARGET_ORDER) {
      const step = rules.filter(
        (rule) =>
          rule.subjectType === level.subjectType &&
          level.subjectIds.includes(rule.subjectId) &&
          rule.targetType === targetType &&
          matchesTarget(rule, facts),
      );
      if (step.length === 0) continue;
      const outcome = priceStep(step, facts);
      mismatchedRuleId ??= outcome.mismatchedRuleId;
      if (outcome.best === undefined) continue;
      if (outcome.best.amount.amount <= 0) return { outcome: "NO_RULE" };
      return { outcome: "MATCHED", rule: outcome.best.rule, amount: outcome.best.amount };
    }
  }
  if (mismatchedRuleId !== undefined) {
    return { outcome: "CURRENCY_MISMATCH", commissionRuleId: mismatchedRuleId };
  }
  return { outcome: "NO_RULE" };
}
