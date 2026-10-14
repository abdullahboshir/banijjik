import type { IndustryTemplateKey } from "@banijjik/contracts";
import type { PlatformAuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { IndustryTemplateRepository } from "../ports/industry-template-repository.js";

/** How many organizations already use a template key. Implemented by core/organization. */
export interface OrganizationTemplateUsage {
  countByTemplateKey(templateKey: IndustryTemplateKey): Promise<number>;
}

export interface IndustryTemplateUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}

/** What a template write needs. The usage port is adapted in routes/platform.ts. */
export interface IndustryTemplateWriteDependencies {
  readonly templates: IndustryTemplateRepository;
  readonly usage: OrganizationTemplateUsage;
  readonly unitOfWork: IndustryTemplateUnitOfWork;
  readonly platformAudit: PlatformAuditRecorder;
  readonly clock: Clock;
}
