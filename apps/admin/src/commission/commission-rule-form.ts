import type { CurrencyCode, OfferingKind } from "@banijjik/contracts";
import {
  COMMISSION_CALCULATION,
  COMMISSION_SUBJECT_TYPE,
  COMMISSION_TARGET_TYPE,
  type CommissionCalculation,
  type CommissionRuleResponse,
  type CommissionSubjectType,
  type CommissionTargetType,
} from "@banijjik/contracts/commission";
import type {
  CommissionRuleCreateBody,
  CommissionRuleUpdateBody,
} from "@banijjik/validation/commission";
import { moneyFromInput, moneyToInputText } from "@banijjik/web-client";
import type { FieldErrors } from "../auth/field-errors";
import { percentTextOf, percentTextToBasisPoints } from "./commission-percent";

/** Field names the API also uses, so its validation paths land on the right control. */
export const COMMISSION_RULE_FORM_NAMES = [
  "memberId",
  "roleId",
  "offeringKind",
  "categoryId",
  "offeringId",
  "percentBasisPoints",
  "fixedAmount",
] as const;

const REQUIRED_KEY = "validation.required";
const INVALID_KEY = "validation.invalid_format";

export interface CommissionRuleFormState {
  subjectType: CommissionSubjectType;
  memberId: string;
  roleId: string;
  targetType: CommissionTargetType;
  offeringKind: OfferingKind | "";
  categoryId: string;
  offeringId: string;
  calculation: CommissionCalculation;
  percentText: string;
  fixedText: string;
}

export function emptyRuleForm(): CommissionRuleFormState {
  return {
    subjectType: COMMISSION_SUBJECT_TYPE.MEMBER,
    memberId: "",
    roleId: "",
    targetType: COMMISSION_TARGET_TYPE.ALL,
    offeringKind: "",
    categoryId: "",
    offeringId: "",
    calculation: COMMISSION_CALCULATION.PERCENT,
    percentText: "",
    fixedText: "",
  };
}

export function ruleFormFromRule(rule: CommissionRuleResponse): CommissionRuleFormState {
  return {
    subjectType: rule.subjectType,
    memberId: rule.memberId ?? "",
    roleId: rule.roleId ?? "",
    targetType: rule.targetType,
    offeringKind: rule.offeringKind ?? "",
    categoryId: rule.categoryId ?? "",
    offeringId: rule.offeringId ?? "",
    calculation: rule.calculation,
    percentText: rule.percentBasisPoints === null ? "" : percentTextOf(rule.percentBasisPoints),
    fixedText: rule.fixedAmount === null ? "" : moneyToInputText(rule.fixedAmount),
  };
}

interface CalculationFields {
  calculation: CommissionCalculation;
  percentBasisPoints?: number;
  fixedAmount?: { amount: number; currency: CurrencyCode };
}

function collectCalculation(
  form: CommissionRuleFormState,
  currency: CurrencyCode,
  errors: FieldErrors,
): CalculationFields | undefined {
  if (form.calculation === COMMISSION_CALCULATION.PERCENT) {
    const percentBasisPoints = percentTextToBasisPoints(form.percentText);
    if (percentBasisPoints === undefined) {
      errors["percentBasisPoints"] = form.percentText.trim() === "" ? REQUIRED_KEY : INVALID_KEY;
      return undefined;
    }
    return { calculation: form.calculation, percentBasisPoints };
  }
  const fixedAmount = moneyFromInput(form.fixedText, currency);
  if (fixedAmount === undefined || fixedAmount.amount <= 0) {
    errors["fixedAmount"] = form.fixedText.trim() === "" ? REQUIRED_KEY : INVALID_KEY;
    return undefined;
  }
  return { calculation: form.calculation, fixedAmount };
}

interface SlotFields {
  subjectType: CommissionSubjectType;
  memberId?: string;
  roleId?: string;
  targetType: CommissionTargetType;
  offeringKind?: OfferingKind;
  categoryId?: string;
  offeringId?: string;
}

function collectSlot(form: CommissionRuleFormState, errors: FieldErrors): SlotFields | undefined {
  const isMember = form.subjectType === COMMISSION_SUBJECT_TYPE.MEMBER;
  validateSubject(form, isMember, errors);
  validateTarget(form, errors);
  if (Object.keys(errors).length > 0) return undefined;
  return slotFromValidForm(form, isMember);
}

function validateSubject(
  form: CommissionRuleFormState,
  isMember: boolean,
  errors: FieldErrors,
): void {
  const field = isMember ? "memberId" : "roleId";
  const value = isMember ? form.memberId : form.roleId;
  if (value.trim() === "") errors[field] = REQUIRED_KEY;
}

function validateTarget(form: CommissionRuleFormState, errors: FieldErrors): void {
  const requiredFields: Record<string, string> = {
    [COMMISSION_TARGET_TYPE.KIND]: form.offeringKind,
    [COMMISSION_TARGET_TYPE.CATEGORY]: form.categoryId,
    [COMMISSION_TARGET_TYPE.OFFERING]: form.offeringId,
  };
  const value = requiredFields[form.targetType];
  if (value !== undefined && value.trim() === "") {
    const field =
      form.targetType === COMMISSION_TARGET_TYPE.KIND
        ? "offeringKind"
        : `${form.targetType.toLowerCase()}Id`;
    errors[field] = REQUIRED_KEY;
  }
}

function slotFromValidForm(form: CommissionRuleFormState, isMember: boolean): SlotFields {
  const slot: SlotFields = {
    subjectType: form.subjectType,
    targetType: form.targetType,
  };
  if (isMember) slot.memberId = form.memberId;
  else slot.roleId = form.roleId;
  if (form.targetType === COMMISSION_TARGET_TYPE.KIND)
    slot.offeringKind = form.offeringKind as OfferingKind;
  if (form.targetType === COMMISSION_TARGET_TYPE.CATEGORY) slot.categoryId = form.categoryId;
  if (form.targetType === COMMISSION_TARGET_TYPE.OFFERING) slot.offeringId = form.offeringId;
  return slot;
}

export type BuildCommissionRuleResult<T> =
  { ok: true; body: T } | { ok: false; errors: FieldErrors };

/** Builds the create body; a missing slot or rate becomes a field error and nothing is sent. */
export function buildCommissionRuleCreate(
  form: CommissionRuleFormState,
  currency: CurrencyCode,
): BuildCommissionRuleResult<CommissionRuleCreateBody> {
  const errors: FieldErrors = {};
  const slot = collectSlot(form, errors);
  const calculation = collectCalculation(form, currency, errors);
  if (slot === undefined || calculation === undefined) return { ok: false, errors };
  return { ok: true, body: { ...slot, ...calculation } };
}

/** An edit changes only the calculation; the slot is part of the rule's identity. */
export function buildCommissionRuleUpdate(
  form: CommissionRuleFormState,
  currency: CurrencyCode,
  version: number,
): BuildCommissionRuleResult<CommissionRuleUpdateBody> {
  const errors: FieldErrors = {};
  const calculation = collectCalculation(form, currency, errors);
  if (calculation === undefined) return { ok: false, errors };
  return { ok: true, body: { ...calculation, version } };
}
