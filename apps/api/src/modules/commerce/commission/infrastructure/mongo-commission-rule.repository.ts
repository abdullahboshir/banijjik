import { COMMISSION_RULE_STATUS, COMMISSION_SUBJECT_TYPE } from "@banijjik/contracts/commission";
import type { Money } from "@banijjik/contracts/accounting";
import {
  asId,
  type CategoryId,
  type CommissionRuleId,
  type MemberId,
  type OfferingId,
  type OrganizationId,
  type RoleId,
  type UserId,
} from "@banijjik/ids";
import type { Model, QueryFilter } from "mongoose";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type {
  CommissionRuleListFilter,
  CommissionRuleRepository,
  Page,
} from "../application/ports/commission-ports.js";
import {
  CommissionRule,
  slotOf,
  type CommissionRuleSlot,
} from "../domain/commission-rule.entity.js";
import type { CommissionRuleCandidate } from "../domain/resolve-commission-rule.js";
import {
  COMMISSION_RULE_MODEL_NAME,
  type CommissionRuleDocument,
  type MoneyDocument,
} from "./commission.schema.js";

function ruleModel(): Model<CommissionRuleDocument> {
  return models({}).get<CommissionRuleDocument>(COMMISSION_RULE_MODEL_NAME);
}

function toMoney(value: MoneyDocument | null): Money | null {
  return value === null ? null : { amount: value.amount, currency: value.currency };
}

function toUserId(value: string | null): UserId | null {
  return value === null ? null : asId<UserId>(value);
}

function toRule(row: CommissionRuleDocument): CommissionRule {
  return CommissionRule.rehydrate({
    commissionRuleId: asId<CommissionRuleId>(row.commissionRuleId),
    organizationId: asId<OrganizationId>(row.organizationId),
    subjectType: row.subjectType,
    memberId: row.memberId === null ? null : asId<MemberId>(row.memberId),
    roleId: row.roleId === null ? null : asId<RoleId>(row.roleId),
    targetType: row.targetType,
    offeringKind: row.offeringKind,
    categoryId: row.categoryId === null ? null : asId<CategoryId>(row.categoryId),
    offeringId: row.offeringId === null ? null : asId<OfferingId>(row.offeringId),
    calculation: row.calculation,
    percentBasisPoints: row.percentBasisPoints,
    fixedAmount: toMoney(row.fixedAmount),
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: toUserId(row.createdByUserId),
    updatedByUserId: toUserId(row.updatedByUserId),
  });
}

function toCandidate(row: CommissionRuleDocument): CommissionRuleCandidate {
  return {
    commissionRuleId: row.commissionRuleId,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    targetType: row.targetType,
    targetValue: row.targetValue,
    calculation: row.calculation,
    percentBasisPoints: row.percentBasisPoints,
    fixedAmount: toMoney(row.fixedAmount),
    createdAt: row.createdAt,
  };
}

function listQueryOf(filter: CommissionRuleListFilter): QueryFilter<CommissionRuleDocument> {
  const query: QueryFilter<CommissionRuleDocument> = {};
  if (filter.status !== undefined) query.status = filter.status;
  if (filter.subjectType !== undefined) query.subjectType = filter.subjectType;
  if (filter.memberId !== undefined) {
    query.subjectType = COMMISSION_SUBJECT_TYPE.MEMBER;
    query.subjectId = filter.memberId;
  }
  if (filter.roleId !== undefined) {
    query.subjectType = COMMISSION_SUBJECT_TYPE.ROLE;
    query.subjectId = filter.roleId;
  }
  return query;
}

export class MongoCommissionRuleRepository implements CommissionRuleRepository {
  async insert(rule: CommissionRule): Promise<"inserted" | "duplicate"> {
    const props = rule.toProps();
    const slot = slotOf(props);
    try {
      await ruleModel().create(
        [
          {
            commissionRuleId: props.commissionRuleId,
            organizationId: props.organizationId,
            subjectType: props.subjectType,
            memberId: props.memberId,
            roleId: props.roleId,
            subjectId: slot.subjectId,
            targetType: props.targetType,
            offeringKind: props.offeringKind,
            categoryId: props.categoryId,
            offeringId: props.offeringId,
            targetValue: slot.targetValue,
            calculation: props.calculation,
            percentBasisPoints: props.percentBasisPoints,
            fixedAmount: props.fixedAmount,
            status: props.status,
            version: props.version,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
            createdByUserId: props.createdByUserId,
            updatedByUserId: props.updatedByUserId,
          },
        ],
        sessionOption(getActiveSession()),
      );
      return "inserted";
    } catch (error) {
      if (isDuplicateKeyError(error)) return "duplicate";
      throw error;
    }
  }

  async save(rule: CommissionRule, expectedVersion: number): Promise<void> {
    const props = rule.toProps();
    await updateVersioned<CommissionRuleDocument>({
      model: ruleModel(),
      filter: { commissionRuleId: props.commissionRuleId },
      expectedVersion,
      update: {
        $set: {
          calculation: props.calculation,
          percentBasisPoints: props.percentBasisPoints,
          fixedAmount: props.fixedAmount,
          status: props.status,
          updatedAt: props.updatedAt,
          updatedByUserId: props.updatedByUserId,
        },
      },
    });
  }

  async findById(commissionRuleId: CommissionRuleId): Promise<CommissionRule | undefined> {
    const row = await ruleModel()
      .findOne({ commissionRuleId }, null, sessionOption(getActiveSession()))
      .lean<CommissionRuleDocument>();
    return row === null ? undefined : toRule(row);
  }

  async findActiveBySlot(slot: CommissionRuleSlot): Promise<CommissionRule | undefined> {
    const row = await ruleModel()
      .findOne(
        { ...slot, status: COMMISSION_RULE_STATUS.ACTIVE },
        null,
        sessionOption(getActiveSession()),
      )
      .lean<CommissionRuleDocument>();
    return row === null ? undefined : toRule(row);
  }

  async list(filter: CommissionRuleListFilter): Promise<Page<CommissionRule>> {
    const rows = await ruleModel()
      .find(listQueryOf(filter))
      .sort({ createdAt: -1, commissionRuleId: -1 })
      .skip((filter.page - 1) * filter.limit)
      .limit(filter.limit + 1)
      .lean<CommissionRuleDocument[]>();
    return { items: rows.slice(0, filter.limit).map(toRule), hasNext: rows.length > filter.limit };
  }

  async listActiveForSubjects(input: {
    readonly memberId: string;
    readonly roleIds: readonly string[];
  }): Promise<readonly CommissionRuleCandidate[]> {
    const subjects: QueryFilter<CommissionRuleDocument>[] = [
      { subjectType: COMMISSION_SUBJECT_TYPE.MEMBER, subjectId: input.memberId },
    ];
    if (input.roleIds.length > 0) {
      subjects.push({
        subjectType: COMMISSION_SUBJECT_TYPE.ROLE,
        subjectId: { $in: [...input.roleIds] },
      });
    }
    const query: QueryFilter<CommissionRuleDocument> = {
      status: COMMISSION_RULE_STATUS.ACTIVE,
      $or: subjects,
    };
    const rows = await ruleModel()
      .find(query, null, sessionOption(getActiveSession()))
      .lean<CommissionRuleDocument[]>();
    return rows.map(toCandidate);
  }
}
