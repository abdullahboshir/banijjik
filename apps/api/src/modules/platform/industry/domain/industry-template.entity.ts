import type {
  IndustryTemplateConfiguration,
  IndustryTemplateKey,
  IndustryTemplateStatus,
  LocalizedText,
  ModuleKey,
  OfferingKind,
} from "@banijjik/contracts";
import { newId, type IndustryTemplateId } from "@banijjik/ids";
import {
  assertAllowedModuleKeys,
  assertEnabledKinds,
  assertIconKey,
  assertLocalized,
  assertStatus,
  assertTemplateKey,
  INDUSTRY_TEMPLATE_DESCRIPTION_MAX_LENGTH,
  INDUSTRY_TEMPLATE_NAME_MAX_LENGTH,
} from "./industry-template-rules.js";

const INITIAL_VERSION = 1;

export interface IndustryTemplateProps {
  readonly industryTemplateId: IndustryTemplateId;
  readonly industryTemplateKey: IndustryTemplateKey;
  readonly status: IndustryTemplateStatus;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly iconKey: string;
  readonly enabledKinds: readonly OfferingKind[];
  readonly allowedModuleKeys: readonly ModuleKey[];
  readonly configuration: IndustryTemplateConfiguration;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewIndustryTemplateInput {
  readonly industryTemplateKey: string;
  readonly status: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly iconKey: string;
  readonly enabledKinds: readonly string[];
  readonly allowedModuleKeys: readonly string[];
  readonly configuration: IndustryTemplateConfiguration;
  readonly now: Date;
}

/**
 * One industry template, stored fully materialized (ADR-076). The key never changes.
 * Configuration meaning (terms, fields, settings) belongs to cards 2.2 to 2.4.
 */
export class IndustryTemplate implements IndustryTemplateProps {
  readonly industryTemplateId: IndustryTemplateId;
  readonly industryTemplateKey: IndustryTemplateKey;
  readonly status: IndustryTemplateStatus;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly iconKey: string;
  readonly enabledKinds: readonly OfferingKind[];
  readonly allowedModuleKeys: readonly ModuleKey[];
  readonly configuration: IndustryTemplateConfiguration;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: IndustryTemplateProps) {
    this.industryTemplateId = props.industryTemplateId;
    this.industryTemplateKey = props.industryTemplateKey;
    this.status = props.status;
    this.name = props.name;
    this.description = props.description;
    this.iconKey = props.iconKey;
    this.enabledKinds = props.enabledKinds;
    this.allowedModuleKeys = props.allowedModuleKeys;
    this.configuration = props.configuration;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input: NewIndustryTemplateInput): IndustryTemplate {
    return new IndustryTemplate({
      industryTemplateId: newId<IndustryTemplateId>(),
      industryTemplateKey: assertTemplateKey(input.industryTemplateKey),
      status: assertStatus(input.status),
      name: assertLocalized(input.name, "name", INDUSTRY_TEMPLATE_NAME_MAX_LENGTH),
      description: assertLocalized(
        input.description,
        "description",
        INDUSTRY_TEMPLATE_DESCRIPTION_MAX_LENGTH,
      ),
      iconKey: assertIconKey(input.iconKey),
      enabledKinds: assertEnabledKinds(input.enabledKinds),
      allowedModuleKeys: assertAllowedModuleKeys(input.allowedModuleKeys),
      configuration: input.configuration,
      version: INITIAL_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  /** Rebuilds a stored template. The data was validated when it was written. */
  static restore(props: IndustryTemplateProps): IndustryTemplate {
    return new IndustryTemplate(props);
  }
}
