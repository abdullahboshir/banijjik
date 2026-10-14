import {
  ORGANIZATION_EVENT_TYPE,
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  type ChangeIndustryTemplateResponse,
  type IndustryTemplateKey,
} from "@banijjik/contracts";
import type { OrganizationId, UserId } from "@banijjik/ids";
import type { PlatformAuditRecorder } from "../../../../../kernel/audit/index.js";
import type { ConfigVersionBumper } from "../../../../../kernel/tenancy/index.js";
import { recordNotFound } from "../../domain/errors.js";
import type { Organization } from "../../domain/organization.entity.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { IndustryTemplateMove } from "../ports/industry-template-move.js";
import type { OrganizationContextRunner } from "../ports/organization-context-runner.js";
import type { OrganizationTemplateRepository } from "../ports/organization-template-repository.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface ChangeIndustryTemplateInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly industryTemplateKey: IndustryTemplateKey;
  readonly reason: string;
}

export interface ChangeIndustryTemplateDependencies {
  readonly organizations: OrganizationTemplateRepository;
  readonly configVersion: ConfigVersionBumper;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly platformAudit: PlatformAuditRecorder;
  readonly contextRunner: OrganizationContextRunner;
  readonly templates: IndustryTemplateMove;
}

interface SavedMove {
  readonly organization: Organization;
  readonly bumped: boolean;
}

/** Moves an organization onto another template when that template keeps every kind and module. */
export class ChangeIndustryTemplateUseCase {
  constructor(private readonly dependencies: ChangeIndustryTemplateDependencies) {}

  async execute(input: ChangeIndustryTemplateInput): Promise<ChangeIndustryTemplateResponse> {
    const existing = await this.dependencies.organizations.findById(input.organizationId);
    if (existing === undefined) throw recordNotFound();
    const decision = await this.dependencies.templates.assess({
      currentKey: existing.industryTemplateKey,
      targetKey: input.industryTemplateKey,
    });
    if (decision === "unchanged") return this.responseOf(existing, false);
    const saved = await this.dependencies.contextRunner.run(input.organizationId, () =>
      this.dependencies.unitOfWork.run(() => this.save(existing, input)),
    );
    return this.responseOf(saved.organization, saved.bumped);
  }

  private async save(
    existing: Organization,
    input: ChangeIndustryTemplateInput,
  ): Promise<SavedMove> {
    const decision = await this.dependencies.templates.assess({
      currentKey: existing.industryTemplateKey,
      targetKey: input.industryTemplateKey,
    });
    if (decision === "unchanged") return { organization: existing, bumped: false };
    const moved = existing.withIndustryTemplate(input.industryTemplateKey);
    const saved = await this.dependencies.organizations.updateIndustryTemplate(
      moved,
      existing.version,
      input.actorUserId,
    );
    await this.dependencies.configVersion.bump(input.organizationId);
    await this.dependencies.platformAudit.record({
      action: PLATFORM_AUDIT_ACTION.ORGANIZATION_INDUSTRY_TEMPLATE_CHANGED,
      targetType: PLATFORM_AUDIT_TARGET_TYPE.organization,
      targetId: input.organizationId,
      organizationId: input.organizationId,
      changes: {
        industryTemplateKey: {
          from: existing.industryTemplateKey,
          to: input.industryTemplateKey,
        },
      },
      reason: input.reason,
    });
    await this.dependencies.events.publish(ORGANIZATION_EVENT_TYPE.INDUSTRY_TEMPLATE_CHANGED, {
      organizationId: input.organizationId,
    });
    return { organization: saved, bumped: true };
  }

  private responseOf(organization: Organization, bumped: boolean): ChangeIndustryTemplateResponse {
    return {
      organizationId: organization.organizationId,
      industryTemplateKey: organization.industryTemplateKey,
      configVersion: organization.configVersion + (bumped ? 1 : 0),
      version: organization.version,
    };
  }
}
