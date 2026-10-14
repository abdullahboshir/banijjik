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
import { IndustryTemplate } from "../../domain/industry-template.entity.js";
import {
  industryTemplateKeyTaken,
  industryTemplateNotFound,
  invalidIndustryTemplateField,
} from "../../domain/errors.js";
import type { IndustryTemplateWriteDependencies } from "./industry-template-write-dependencies.js";
import { auditFieldsOf } from "./industry-template-audit-fields.js";
import { toIndustryTemplateDetail } from "./industry-template-presenter.js";

export interface CreateIndustryTemplateInput {
  readonly actorUserId: UserId;
  readonly industryTemplateKey: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly iconKey: string;
  readonly reason: string;
  readonly enabledKinds?: readonly string[] | undefined;
  readonly allowedModuleKeys?: readonly string[] | undefined;
  readonly configuration?: IndustryTemplateConfiguration | undefined;
  readonly cloneFromIndustryTemplateId?: string | undefined;
}

interface TemplateContents {
  readonly enabledKinds: readonly string[];
  readonly allowedModuleKeys: readonly string[];
  readonly configuration: IndustryTemplateConfiguration;
}

/** Creates a DRAFT template, from fields or by copying another template of any status. */
export class CreateIndustryTemplateUseCase {
  constructor(private readonly dependencies: IndustryTemplateWriteDependencies) {}

  async execute(input: CreateIndustryTemplateInput): Promise<PlatformIndustryTemplateDetail> {
    const contents = await this.contentsOf(input);
    const created = IndustryTemplate.create({
      industryTemplateKey: input.industryTemplateKey,
      status: INDUSTRY_TEMPLATE_STATUS.DRAFT,
      name: input.name,
      description: input.description,
      iconKey: input.iconKey,
      enabledKinds: contents.enabledKinds,
      allowedModuleKeys: contents.allowedModuleKeys,
      configuration: contents.configuration,
      now: this.dependencies.clock.now(),
    });
    await this.persist(created, input);
    return toIndustryTemplateDetail(created);
  }

  private async persist(
    created: IndustryTemplate,
    input: CreateIndustryTemplateInput,
  ): Promise<void> {
    const { templates, unitOfWork, platformAudit } = this.dependencies;
    await unitOfWork.run(async () => {
      const existing = await templates.findByKey(created.industryTemplateKey);
      if (existing !== undefined) throw industryTemplateKeyTaken();
      await templates.insert(created, input.actorUserId);
      await platformAudit.record({
        action: PLATFORM_AUDIT_ACTION.INDUSTRY_TEMPLATE_CREATED,
        targetType: PLATFORM_AUDIT_TARGET_TYPE.industry_template,
        targetId: created.industryTemplateId,
        changes: diffAuditFields({}, auditFieldsOf(created, true)),
        reason: input.reason,
      });
    });
  }

  private async contentsOf(input: CreateIndustryTemplateInput): Promise<TemplateContents> {
    if (input.cloneFromIndustryTemplateId === undefined) return explicitContents(input);
    const source = await this.dependencies.templates.findById(input.cloneFromIndustryTemplateId);
    if (source === undefined) throw industryTemplateNotFound();
    return {
      enabledKinds: source.enabledKinds,
      allowedModuleKeys: source.allowedModuleKeys,
      configuration: source.configuration,
    };
  }
}

function explicitContents(input: CreateIndustryTemplateInput): TemplateContents {
  if (
    input.enabledKinds === undefined ||
    input.allowedModuleKeys === undefined ||
    input.configuration === undefined
  ) {
    throw invalidIndustryTemplateField("configuration");
  }
  return {
    enabledKinds: input.enabledKinds,
    allowedModuleKeys: input.allowedModuleKeys,
    configuration: input.configuration,
  };
}
