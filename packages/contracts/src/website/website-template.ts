import { defineEnum } from "../define-enum.js";
import type { ModuleKey } from "../modules/module-key.js";
import type { OfferingKind } from "../modules/offering-kind.js";
import type { LocalizedText } from "../platform/industry-template.js";
import type { SiteDesign } from "./site-design.js";
import type { SectionKey } from "./section-registry.js";
import type { SiteEditPolicy } from "./site-policy.js";

export const WEBSITE_TEMPLATE_STATUS = defineEnum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export type WebsiteTemplateStatus =
  (typeof WEBSITE_TEMPLATE_STATUS)[keyof typeof WEBSITE_TEMPLATE_STATUS];

export const WEBSITE_TEMPLATE_KEY_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const WEBSITE_PRESET_KEY_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const WEBSITE_TEMPLATE_MAX_PRESETS = 8;
export const WEBSITE_TEMPLATE_MAX_REQUIRED_MODULES = 8;
export const WEBSITE_TEMPLATE_MAX_REQUIRED_KINDS = 5;

export interface WebsiteDesignPreset {
  readonly presetKey: string;
  readonly name: LocalizedText;
  readonly tokens: SiteDesign["tokens"];
  readonly sectionVariants: Readonly<Partial<Record<SectionKey, string>>>;
}

export interface WebsiteTemplateContent {
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly requiredModules: readonly ModuleKey[];
  readonly requiredKinds: readonly OfferingKind[];
  readonly defaultPresetKey: string;
  readonly presets: readonly WebsiteDesignPreset[];
  readonly design: SiteDesign;
  readonly policy: SiteEditPolicy;
}

export interface WebsiteTemplateSummary {
  readonly websiteTemplateId: string;
  readonly templateKey: string;
  readonly status: WebsiteTemplateStatus;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly revision: number;
  readonly presetKeys: readonly string[];
  readonly updatedAt: string;
}

export interface WebsiteTemplateDetail extends WebsiteTemplateSummary {
  readonly version: number;
  readonly currentWebsiteTemplateRevisionId: string | null;
  readonly content: WebsiteTemplateContent;
}

export interface WebsiteTemplateRevisionSummary {
  readonly websiteTemplateRevisionId: string;
  readonly revision: number;
  readonly publishedAt: string;
  readonly publishedByUserId: string;
}

export interface CreateWebsiteTemplateRequest {
  readonly templateKey: string;
  readonly content: WebsiteTemplateContent;
  readonly reason: string;
}

export interface UpdateWebsiteTemplateRequest {
  readonly expectedVersion: number;
  readonly content: WebsiteTemplateContent;
  readonly reason: string;
}

export interface WebsiteTemplateStatusRequest {
  readonly expectedVersion: number;
  readonly reason: string;
}

export interface WebsiteTemplateListQuery {
  readonly page: number;
  readonly limit: number;
  readonly status?: WebsiteTemplateStatus | undefined;
}

export interface WebsiteTemplateRevisionListQuery {
  readonly websiteTemplateId: string;
  readonly page: number;
  readonly limit: number;
}
