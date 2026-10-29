import { defineEnum } from "../define-enum.js";
import type { SectionKey } from "./section-registry.js";
import type { SiteDesign } from "./site-design.js";

export const REGION_LOCK = defineEnum(["LOCKED", "CONTENT_ONLY", "FULL"]);
export type RegionLock = (typeof REGION_LOCK)[keyof typeof REGION_LOCK];

export const TOKEN_GROUP = defineEnum(["color", "type", "shape", "spacing", "size"]);
export type TokenGroup = (typeof TOKEN_GROUP)[keyof typeof TOKEN_GROUP];

export const PAGE_METADATA_KEY = defineEnum(["title", "description", "noIndex"]);
export type PageMetadataKey = (typeof PAGE_METADATA_KEY)[keyof typeof PAGE_METADATA_KEY];

export interface RegionPolicy {
  readonly regionKey: string;
  readonly lock: RegionLock;
  readonly required: boolean;
  readonly sectionKeys: readonly string[];
  readonly maxSections: number;
  readonly editableContentKeys: readonly string[];
}

export interface SitePageRules {
  readonly allowCreate: boolean;
  readonly allowDelete: boolean;
  readonly allowReorder: boolean;
  readonly allowPathChange: boolean;
  readonly editableMetadataKeys: readonly PageMetadataKey[];
}

export interface SiteEditPolicy {
  readonly regions: readonly RegionPolicy[];
  readonly tokenGroups: Readonly<Record<TokenGroup, boolean>>;
  readonly allowedColors: readonly string[] | null;
  readonly allowedVariantsBySection: Readonly<Partial<Record<SectionKey, readonly string[]>>>;
  readonly pageRules: SitePageRules;
}

/**
 * First adoption supplies conservative page rules (audit correction). Missing policy entries
 * deny the change, so a first site cannot invent pages until a platform operator opens them.
 */
export const CONSERVATIVE_PAGE_RULES: SitePageRules = {
  allowCreate: false,
  allowDelete: false,
  allowReorder: false,
  allowPathChange: false,
  editableMetadataKeys: [PAGE_METADATA_KEY.title, PAGE_METADATA_KEY.description],
};

export const LOCKED_TOKEN_GROUPS: Readonly<Record<TokenGroup, boolean>> = {
  color: false,
  type: false,
  shape: false,
  spacing: false,
  size: false,
};

export interface SitePolicyEvaluator {
  assertAllowed(input: {
    previous: SiteDesign;
    next: SiteDesign;
    policy: SiteEditPolicy;
    effectiveSectionKeys: readonly string[];
  }): void;
}
