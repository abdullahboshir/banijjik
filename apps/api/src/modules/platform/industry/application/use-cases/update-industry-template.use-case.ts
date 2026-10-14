import {
  INDUSTRY_TEMPLATE_STATUS,
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  type IndustryTemplateConfiguration,
  type LocalizedText,
  type PlatformIndustryTemplateDetail,
} from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import { diffAuditFields } from "../../../../../kernel/audit/index.js";
import { removedByTemplateChange } from "../../domain/additive-change.js";
import {
  industryTemplateChangeNotAdditive,
  industryTemplateNotFound,
} from "../../domain/errors.js";
import type { IndustryTemplate } from "../../domain/industry-template.entity.js";
import type { IndustryTemplateWriteDependencies } from "./industry-template-write-dependencies.js";
import { auditFieldsOf, sameConfiguration } from "./industry-template-audit-fields.js";
import { toIndustryTemplateDetail } from "./industry-template-presenter.js";

export interface UpdateIndustryTemplateInput {
  readonly actorUserId: UserId;
  readonly industryTemplateId: string;
  readonly version: number;
  readonly reason: string;
  readonly name?: LocalizedText | undefined;
  readonly description?: LocalizedText | undefined;
  readonly iconKey?: string | undefined;
  readonly enabledKinds?: readonly string[] | undefined;
  readonly allowedModuleKeys?: readonly string[] | undefined;
  readonly configuration?: IndustryTemplateConfiguration | undefined;
}

/** Replaces the given fields. A locked template may only gain kinds, modules, fields and keys. */
export class UpdateIndustryTemplateUseCase {
  constructor(private readonly dependencies: IndustryTemplateWriteDependencies) {}

  async execute(input: UpdateIndustryTemplateInput): Promise<PlatformIndustryTemplateDetail> {
    const existing = await this.requireTemplate(input.industryTemplateId);
    const edited = existing.withEdits(input);
    const configurationChanged = this.configurationChanged(existing, input.configuration);
    const saved = await this.dependencies.unitOfWork.run(() =>
      this.save({ existing, edited, input, configurationChanged }),
    );
    return toIndustryTemplateDetail(saved);
  }

  private async save(command: {
    readonly existing: IndustryTemplate;
    readonly edited: IndustryTemplate;
    readonly input: UpdateIndustryTemplateInput;
    readonly configurationChanged: boolean;
  }): Promise<IndustryTemplate> {
    const { existing, edited, input, configurationChanged } = command;
    await this.assertAdditive(existing, edited);
    const saved = await this.dependencies.templates.update(
      edited,
      input.version,
      input.actorUserId,
    );
    await this.dependencies.platformAudit.record({
      action: PLATFORM_AUDIT_ACTION.INDUSTRY_TEMPLATE_UPDATED,
      targetType: PLATFORM_AUDIT_TARGET_TYPE.industry_template,
      targetId: saved.industryTemplateId,
      changes: diffAuditFields(
        auditFieldsOf(existing, false),
        auditFieldsOf(saved, configurationChanged),
      ),
      reason: input.reason,
    });
    return saved;
  }

  private async assertAdditive(
    existing: IndustryTemplate,
    edited: IndustryTemplate,
  ): Promise<void> {
    if (!(await this.isLocked(existing))) return;
    const removed = removedByTemplateChange(existing, edited);
    if (removed.length > 0) throw industryTemplateChangeNotAdditive(removed);
  }

  /** Published, retired, or a draft that an organization already uses. */
  private async isLocked(template: IndustryTemplate): Promise<boolean> {
    if (template.status !== INDUSTRY_TEMPLATE_STATUS.DRAFT) return true;
    const usedBy = await this.dependencies.usage.countByTemplateKey(template.industryTemplateKey);
    return usedBy > 0;
  }

  private async requireTemplate(industryTemplateId: string): Promise<IndustryTemplate> {
    const found = await this.dependencies.templates.findById(industryTemplateId);
    if (found === undefined) throw industryTemplateNotFound();
    return found;
  }

  private configurationChanged(
    existing: IndustryTemplate,
    configuration: IndustryTemplateConfiguration | undefined,
  ): boolean {
    if (configuration === undefined) return false;
    return !sameConfiguration(existing.configuration, configuration);
  }
}
