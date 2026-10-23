import { AUDIT_ACTION } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/accounting";
import {
  COMMISSION_CALCULATION,
  COMMISSION_RULE_STATUS,
  COMMISSION_TARGET_TYPE,
  type CommissionRuleResponse,
} from "@banijjik/contracts/commission";
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
import type {
  CommissionRuleCreateBody,
  CommissionRuleListQuery,
  CommissionRuleUpdateBody,
} from "@banijjik/validation/commission";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import {
  CommissionRule,
  type CommissionRuleCalculation,
  type NewCommissionRuleInput,
} from "../../domain/commission-rule.entity.js";
import {
  currencyMismatch,
  kindNotEnabled,
  recordNotFound,
  ruleDuplicate,
} from "../../domain/errors.js";
import { toRuleResponse } from "../commission-views.js";
import type {
  CommissionReferenceReader,
  CommissionRuleRepository,
  CommissionUnitOfWork,
} from "../ports/commission-ports.js";

export interface RuleWriteDependencies {
  readonly rules: CommissionRuleRepository;
  readonly references: CommissionReferenceReader;
  readonly unitOfWork: CommissionUnitOfWork;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

/** A FIXED amount is compared with the organization currency, never assumed (ADR-013). */
async function assertFixedCurrency(
  references: CommissionReferenceReader,
  organizationId: OrganizationId,
  fixedAmount: Money | null,
): Promise<void> {
  if (fixedAmount === null) return;
  const currency = await references.organizationCurrency(organizationId);
  if (fixedAmount.currency !== currency) throw currencyMismatch();
}

async function assertReferencesExist(
  references: CommissionReferenceReader,
  body: CommissionRuleCreateBody,
): Promise<void> {
  const checks: readonly [string | undefined, (id: string) => Promise<boolean>][] = [
    [body.memberId, (id) => references.memberExists(id)],
    [body.roleId, (id) => references.roleExists(id)],
    [body.categoryId, (id) => references.categoryExists(id)],
    [body.offeringId, (id) => references.offeringExists(id)],
  ];
  for (const [id, exists] of checks) {
    if (id !== undefined && !(await exists(id))) throw recordNotFound();
  }
  if (body.targetType !== COMMISSION_TARGET_TYPE.KIND || body.offeringKind === undefined) return;
  const enabled = await references.enabledKinds();
  if (!enabled.includes(body.offeringKind)) throw kindNotEnabled();
}

function calculationOf(
  body: Pick<CommissionRuleUpdateBody, "calculation" | "percentBasisPoints" | "fixedAmount">,
): CommissionRuleCalculation {
  const isPercent = body.calculation === COMMISSION_CALCULATION.PERCENT;
  return {
    calculation: body.calculation,
    percentBasisPoints: isPercent ? (body.percentBasisPoints ?? null) : null,
    fixedAmount: isPercent ? null : (body.fixedAmount ?? null),
  };
}

function newRuleInput(
  organizationId: OrganizationId,
  body: CommissionRuleCreateBody,
): Omit<NewCommissionRuleInput, "now" | "actorUserId"> {
  return {
    organizationId,
    subjectType: body.subjectType,
    memberId: body.memberId === undefined ? null : asId<MemberId>(body.memberId),
    roleId: body.roleId === undefined ? null : asId<RoleId>(body.roleId),
    targetType: body.targetType,
    offeringKind: body.offeringKind ?? null,
    categoryId: body.categoryId === undefined ? null : asId<CategoryId>(body.categoryId),
    offeringId: body.offeringId === undefined ? null : asId<OfferingId>(body.offeringId),
    ...calculationOf(body),
  };
}

export class CreateCommissionRuleUseCase {
  constructor(private readonly dependencies: RuleWriteDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly body: CommissionRuleCreateBody;
  }): Promise<CommissionRuleResponse> {
    const { references, rules, unitOfWork, audit, clock } = this.dependencies;
    await assertReferencesExist(references, input.body);
    const fields = newRuleInput(input.organizationId, input.body);
    await assertFixedCurrency(references, input.organizationId, fields.fixedAmount);
    const rule = CommissionRule.create({
      ...fields,
      now: clock.now(),
      actorUserId: input.actorUserId,
    });
    return unitOfWork.run(async () => {
      const existing = await rules.findActiveBySlot(rule.slot);
      if (existing !== undefined) throw ruleDuplicate(existing.commissionRuleId);
      // A parallel create can still win between the read above and this insert; the unique index decides.
      if ((await rules.insert(rule)) === "duplicate") throw ruleDuplicate();
      await audit.record({
        action: AUDIT_ACTION.COMMISSION_RULE_CREATED,
        entityType: "commissionRule",
        entityId: rule.commissionRuleId,
        changes: { calculation: { to: rule.calculation.calculation } },
      });
      return toRuleResponse(rule);
    });
  }
}

export class UpdateCommissionRuleUseCase {
  constructor(private readonly dependencies: RuleWriteDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly commissionRuleId: CommissionRuleId;
    readonly body: CommissionRuleUpdateBody;
  }): Promise<CommissionRuleResponse> {
    const { references, rules, unitOfWork, audit, clock } = this.dependencies;
    const existing = await rules.findById(input.commissionRuleId);
    if (existing === undefined) throw recordNotFound();
    const calculation = calculationOf(input.body);
    await assertFixedCurrency(references, input.organizationId, calculation.fixedAmount);
    const updated = existing.changeCalculation(calculation, clock.now(), input.actorUserId);
    return unitOfWork.run(async () => {
      await rules.save(updated, input.body.version);
      await audit.record({
        action: AUDIT_ACTION.COMMISSION_RULE_UPDATED,
        entityType: "commissionRule",
        entityId: updated.commissionRuleId,
        changes: {
          calculation: { from: existing.calculation.calculation, to: calculation.calculation },
          percentBasisPoints: {
            from: existing.calculation.percentBasisPoints,
            to: calculation.percentBasisPoints,
          },
          fixedAmount: {
            from: existing.calculation.fixedAmount?.amount ?? null,
            to: calculation.fixedAmount?.amount ?? null,
          },
        },
      });
      return toRuleResponse(updated);
    });
  }
}

export class ArchiveCommissionRuleUseCase {
  constructor(private readonly dependencies: RuleWriteDependencies) {}

  async execute(input: {
    readonly actorUserId: UserId;
    readonly commissionRuleId: CommissionRuleId;
    readonly version: number;
  }): Promise<CommissionRuleResponse> {
    const { rules, unitOfWork, audit, clock } = this.dependencies;
    const existing = await rules.findById(input.commissionRuleId);
    if (existing === undefined) throw recordNotFound();
    const archived = existing.archive(clock.now(), input.actorUserId);
    return unitOfWork.run(async () => {
      await rules.save(archived, input.version);
      await audit.record({
        action: AUDIT_ACTION.COMMISSION_RULE_ARCHIVED,
        entityType: "commissionRule",
        entityId: archived.commissionRuleId,
        changes: {
          status: { from: COMMISSION_RULE_STATUS.ACTIVE, to: COMMISSION_RULE_STATUS.ARCHIVED },
        },
      });
      return toRuleResponse(archived);
    });
  }
}

export class ListCommissionRulesUseCase {
  constructor(private readonly rules: Pick<CommissionRuleRepository, "list">) {}

  async execute(query: CommissionRuleListQuery): Promise<{
    readonly items: readonly CommissionRuleResponse[];
    readonly hasNext: boolean;
  }> {
    const page = await this.rules.list(query);
    return { items: page.items.map(toRuleResponse), hasNext: page.hasNext };
  }
}
