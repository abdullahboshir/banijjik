import {
  COMMISSION_ALL_TARGET_VALUE,
  COMMISSION_RULE_STATUS,
  COMMISSION_SUBJECT_TYPE,
  COMMISSION_TARGET_TYPE,
  type CommissionCalculation,
  type CommissionRuleStatus,
  type CommissionSubjectType,
  type CommissionTargetType,
} from "@banijjik/contracts/commission";
import type { Money } from "@banijjik/contracts/accounting";
import type { OfferingKind } from "@banijjik/contracts";
import {
  asId,
  newId,
  type CategoryId,
  type CommissionRuleId,
  type MemberId,
  type OfferingId,
  type OrganizationId,
  type RoleId,
  type UserId,
} from "@banijjik/ids";
import { ruleArchived } from "./errors.js";

export interface CommissionRuleProps {
  readonly commissionRuleId: CommissionRuleId;
  readonly organizationId: OrganizationId;
  readonly subjectType: CommissionSubjectType;
  readonly memberId: MemberId | null;
  readonly roleId: RoleId | null;
  readonly targetType: CommissionTargetType;
  readonly offeringKind: OfferingKind | null;
  readonly categoryId: CategoryId | null;
  readonly offeringId: OfferingId | null;
  readonly calculation: CommissionCalculation;
  readonly percentBasisPoints: number | null;
  readonly fixedAmount: Money | null;
  readonly status: CommissionRuleStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export interface CommissionRuleCalculation {
  readonly calculation: CommissionCalculation;
  readonly percentBasisPoints: number | null;
  readonly fixedAmount: Money | null;
}

export type NewCommissionRuleInput = Omit<
  CommissionRuleProps,
  | "commissionRuleId"
  | "status"
  | "version"
  | "createdAt"
  | "updatedAt"
  | "createdByUserId"
  | "updatedByUserId"
> & { readonly now: Date; readonly actorUserId: UserId | null };

/** The identity of the rule inside the unique "one active rule per slot" index. */
export interface CommissionRuleSlot {
  readonly subjectType: CommissionSubjectType;
  readonly subjectId: string;
  readonly targetType: CommissionTargetType;
  readonly targetValue: string;
}

export class CommissionRule {
  private constructor(private readonly props: CommissionRuleProps) {}

  static create(input: NewCommissionRuleInput): CommissionRule {
    const { now, actorUserId, ...fields } = input;
    return new CommissionRule({
      ...fields,
      commissionRuleId: asId<CommissionRuleId>(newId()),
      status: COMMISSION_RULE_STATUS.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdByUserId: actorUserId,
      updatedByUserId: actorUserId,
    });
  }

  static rehydrate(props: CommissionRuleProps): CommissionRule {
    return new CommissionRule(props);
  }

  toProps(): CommissionRuleProps {
    return this.props;
  }

  get commissionRuleId(): CommissionRuleId {
    return this.props.commissionRuleId;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get status(): CommissionRuleStatus {
    return this.props.status;
  }

  get version(): number {
    return this.props.version;
  }

  get isActive(): boolean {
    return this.props.status === COMMISSION_RULE_STATUS.ACTIVE;
  }

  get calculation(): CommissionRuleCalculation {
    return {
      calculation: this.props.calculation,
      percentBasisPoints: this.props.percentBasisPoints,
      fixedAmount: this.props.fixedAmount,
    };
  }

  get slot(): CommissionRuleSlot {
    return slotOf(this.props);
  }

  changeCalculation(
    calculation: CommissionRuleCalculation,
    now: Date,
    actorUserId: UserId | null,
  ): CommissionRule {
    if (!this.isActive) throw ruleArchived();
    return new CommissionRule({
      ...this.props,
      ...calculation,
      version: this.props.version + 1,
      updatedAt: now,
      updatedByUserId: actorUserId,
    });
  }

  archive(now: Date, actorUserId: UserId | null): CommissionRule {
    if (!this.isActive) throw ruleArchived();
    return new CommissionRule({
      ...this.props,
      status: COMMISSION_RULE_STATUS.ARCHIVED,
      version: this.props.version + 1,
      updatedAt: now,
      updatedByUserId: actorUserId,
    });
  }
}

function targetValueOf(props: CommissionRuleProps): string {
  switch (props.targetType) {
    case COMMISSION_TARGET_TYPE.OFFERING:
      return props.offeringId ?? COMMISSION_ALL_TARGET_VALUE;
    case COMMISSION_TARGET_TYPE.CATEGORY:
      return props.categoryId ?? COMMISSION_ALL_TARGET_VALUE;
    case COMMISSION_TARGET_TYPE.KIND:
      return props.offeringKind ?? COMMISSION_ALL_TARGET_VALUE;
    default:
      return COMMISSION_ALL_TARGET_VALUE;
  }
}

export function slotOf(props: CommissionRuleProps): CommissionRuleSlot {
  const subjectId =
    props.subjectType === COMMISSION_SUBJECT_TYPE.MEMBER ? props.memberId : props.roleId;
  return {
    subjectType: props.subjectType,
    subjectId: subjectId ?? "",
    targetType: props.targetType,
    targetValue: targetValueOf(props),
  };
}
