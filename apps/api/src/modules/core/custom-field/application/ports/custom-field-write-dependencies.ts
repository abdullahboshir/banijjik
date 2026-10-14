import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { ConfigVersionBumper } from "../../../../../kernel/tenancy/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { CustomFieldEventPublisher } from "./custom-field-event-publisher.js";
import type {
  CustomFieldAvailability,
  CustomFieldDefinitionRepository,
  IndustryCustomFields,
} from "./custom-field-ports.js";
import type { CustomFieldPreferenceRepository } from "./custom-field-preference-repository.js";

export interface CustomFieldUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}

export interface CustomFieldWriteDependencies {
  readonly definitions: CustomFieldDefinitionRepository;
  readonly preferences: CustomFieldPreferenceRepository;
  readonly industry: IndustryCustomFields;
  readonly availability: CustomFieldAvailability;
  readonly unitOfWork: CustomFieldUnitOfWork;
  readonly audit: AuditRecorder;
  readonly events: CustomFieldEventPublisher;
  readonly configVersion: ConfigVersionBumper;
  readonly clock: Clock;
}
