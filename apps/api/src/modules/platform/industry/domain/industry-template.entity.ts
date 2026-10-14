import {
  INDUSTRY_TEMPLATE_STATUS,
  type IndustryTemplateConfiguration,
  type IndustryTemplateKey,
  type IndustryTemplateStatus,
  type LocalizedText,
  type ModuleKey,
  type OfferingKind,
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
import { industryTemplateStatusInvalid } from "./errors.js";

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

  /**
   * The template with the given fields replaced. The key and the status stay.
   * The repository moves `version` when it saves.
   */
  withEdits(edits: IndustryTemplateEdits): IndustryTemplate {
    return new IndustryTemplate({
      ...this,
      name: this.editedName(edits.name),
      description: this.editedDescription(edits.description),
      iconKey: edits.iconKey === undefined ? this.iconKey : assertIconKey(edits.iconKey),
      enabledKinds:
        edits.enabledKinds === undefined
          ? this.enabledKinds
          : assertEnabledKinds(edits.enabledKinds),
      allowedModuleKeys:
        edits.allowedModuleKeys === undefined
          ? this.allowedModuleKeys
          : assertAllowedModuleKeys(edits.allowedModuleKeys),
      configuration: edits.configuration ?? this.configuration,
    });
  }

  /** DRAFT or RETIRED becomes PUBLISHED. */
  published(): IndustryTemplate {
    const canPublish =
      this.status === INDUSTRY_TEMPLATE_STATUS.DRAFT ||
      this.status === INDUSTRY_TEMPLATE_STATUS.RETIRED;
    if (!canPublish) throw industryTemplateStatusInvalid();
    return new IndustryTemplate({ ...this, status: INDUSTRY_TEMPLATE_STATUS.PUBLISHED });
  }

  /** PUBLISHED becomes RETIRED. Organizations already on it keep working. */
  retired(): IndustryTemplate {
    if (this.status !== INDUSTRY_TEMPLATE_STATUS.PUBLISHED) throw industryTemplateStatusInvalid();
    return new IndustryTemplate({ ...this, status: INDUSTRY_TEMPLATE_STATUS.RETIRED });
  }

  private editedName(name: LocalizedText | undefined): LocalizedText {
    if (name === undefined) return this.name;
    return assertLocalized(name, "name", INDUSTRY_TEMPLATE_NAME_MAX_LENGTH);
  }

  private editedDescription(description: LocalizedText | undefined): LocalizedText {
    if (description === undefined) return this.description;
    return assertLocalized(description, "description", INDUSTRY_TEMPLATE_DESCRIPTION_MAX_LENGTH);
  }
}

/** The fields a platform save may replace. Absent keys stay as they are. */
export interface IndustryTemplateEdits {
  readonly name?: LocalizedText | undefined;
  readonly description?: LocalizedText | undefined;
  readonly iconKey?: string | undefined;
  readonly enabledKinds?: readonly string[] | undefined;
  readonly allowedModuleKeys?: readonly string[] | undefined;
  readonly configuration?: IndustryTemplateConfiguration | undefined;
}
