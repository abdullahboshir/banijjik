import {
  INDUSTRY_TEMPLATE_STATUS,
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  type IndustryTemplateStatus,
  type PlatformIndustryTemplateDetail,
} from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import { diffAuditFields } from "../../../../../kernel/audit/index.js";
import { industryTemplateNotFound } from "../../domain/errors.js";
import type { IndustryTemplate } from "../../domain/industry-template.entity.js";
import type { IndustryTemplateWriteDependencies } from "./industry-template-write-dependencies.js";
import { toIndustryTemplateDetail } from "./industry-template-presenter.js";

export interface SetIndustryTemplateStatusInput {
  readonly actorUserId: UserId;
  readonly industryTemplateId: string;
  readonly version: number;
  readonly reason: string;
  readonly target: IndustryTemplateStatus;
}

/** Publishes or retires a template. The same status is a 200 with no write and no audit. */
export class SetIndustryTemplateStatusUseCase {
  constructor(private readonly dependencies: IndustryTemplateWriteDependencies) {}

  async execute(input: SetIndustryTemplateStatusInput): Promise<PlatformIndustryTemplateDetail> {
    const existing = await this.requireTemplate(input.industryTemplateId);
    if (existing.status === input.target) {
      return toIndustryTemplateDetail(existing, this.dependencies.settings);
    }
    const next = this.transition(existing, input.target);
    const saved = await this.dependencies.unitOfWork.run(() => this.save(existing, next, input));
    return toIndustryTemplateDetail(saved, this.dependencies.settings);
  }

  private transition(existing: IndustryTemplate, target: IndustryTemplateStatus): IndustryTemplate {
    if (target === INDUSTRY_TEMPLATE_STATUS.PUBLISHED) return existing.published();
    return existing.retired();
  }

  private async save(
    existing: IndustryTemplate,
    next: IndustryTemplate,
    input: SetIndustryTemplateStatusInput,
  ): Promise<IndustryTemplate> {
    const saved = await this.dependencies.templates.update(next, input.version, input.actorUserId);
    await this.dependencies.platformAudit.record({
      action: this.actionOf(input.target),
      targetType: PLATFORM_AUDIT_TARGET_TYPE.industry_template,
      targetId: saved.industryTemplateId,
      changes: diffAuditFields({ status: existing.status }, { status: saved.status }),
      reason: input.reason,
    });
    return saved;
  }

  private actionOf(target: IndustryTemplateStatus) {
    if (target === INDUSTRY_TEMPLATE_STATUS.PUBLISHED) {
      return PLATFORM_AUDIT_ACTION.INDUSTRY_TEMPLATE_PUBLISHED;
    }
    return PLATFORM_AUDIT_ACTION.INDUSTRY_TEMPLATE_RETIRED;
  }

  private async requireTemplate(industryTemplateId: string): Promise<IndustryTemplate> {
    const found = await this.dependencies.templates.findById(industryTemplateId);
    if (found === undefined) throw industryTemplateNotFound();
    return found;
  }
}
