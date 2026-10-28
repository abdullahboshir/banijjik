import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import {
  PAGE_METADATA_KEY,
  REGION_LOCK,
  STATIC_CONTENT_REGION_PREFIX,
  TOKEN_GROUP,
  type RegionPolicy,
  type SiteDesign,
  type SiteEditPolicy,
  type SitePage,
  type SitePageRules,
  type SitePolicyEvaluator,
  type SiteSection,
  type SiteTokens,
  type StaticPageDraft,
} from "@banijjik/contracts/website";

type EvaluatorInput = Parameters<SitePolicyEvaluator["assertAllowed"]>[0];

function deny(reason: string): never {
  throw new DomainRuleError({ code: ERROR_CODE.BUSINESS_RULE, details: { reason } });
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function denyIfChanged(previous: unknown, next: unknown, reason: string): void {
  if (sameJson(previous, next)) return;
  deny(reason);
}

function regionOf(policy: SiteEditPolicy, regionKey: string): RegionPolicy | undefined {
  return policy.regions.find((region) => region.regionKey === regionKey);
}

/** Tenant draft edits are checked against the stored policy, never against a client-supplied one. */
export const sitePolicyEvaluator: SitePolicyEvaluator = {
  assertAllowed(input) {
    denyIfChanged(input.previous.schemaVersion, input.next.schemaVersion, "schema_version");
    assertTokenEdits(input.previous.tokens, input.next.tokens, input.policy);
    const previousPlacements = placementsOf(input.previous);
    const nextPlacements = placementsOf(input.next);
    assertPages(input);
    assertSectionEdits(input, previousPlacements, nextPlacements);
    assertRegionBounds(input.next, input.policy);
    assertStaticContent(input);
  },
};

function assertTokenEdits(previous: SiteTokens, next: SiteTokens, policy: SiteEditPolicy): void {
  for (const group of Object.values(TOKEN_GROUP)) {
    if (policy.tokenGroups[group]) continue;
    denyIfChanged(previous[group], next[group], `locked_token_group:${group}`);
  }
  if (policy.allowedColors === null) return;
  for (const color of Object.values(next.color)) {
    if (policy.allowedColors.includes(color)) continue;
    deny("color_not_allowed");
  }
}

interface Placement {
  readonly section: SiteSection;
  readonly pageId: string | null;
  readonly index: number;
}

function placementsOf(design: SiteDesign): Map<string, Placement> {
  const placements = new Map<string, Placement>();
  addPlacement(placements, design.header, { pageId: null, index: 0 });
  addPlacement(placements, design.footer, { pageId: null, index: 0 });
  for (const page of design.pages) {
    for (const [index, section] of page.sections.entries()) {
      addPlacement(placements, section, { pageId: page.pageId, index });
    }
  }
  return placements;
}

function addPlacement(
  placements: Map<string, Placement>,
  section: SiteSection,
  location: { pageId: string | null; index: number },
): void {
  if (placements.has(section.sectionId)) deny("duplicate_section_id");
  placements.set(section.sectionId, { section, ...location });
}

function assertPages(input: EvaluatorInput): void {
  const nextIds = input.next.pages.map((page) => page.pageId);
  if (new Set(nextIds).size !== nextIds.length) deny("duplicate_page_id");
  assertPageSetAndOrder(input);
  for (const nextPage of input.next.pages) {
    const previousPage = input.previous.pages.find((page) => page.pageId === nextPage.pageId);
    if (previousPage === undefined) continue;
    assertPageFields(previousPage, nextPage, input.policy.pageRules);
  }
}

function assertPageSetAndOrder(input: EvaluatorInput): void {
  const rules = input.policy.pageRules;
  const previousIds = input.previous.pages.map((page) => page.pageId);
  const nextIds = input.next.pages.map((page) => page.pageId);
  for (const pageId of nextIds) {
    if (previousIds.includes(pageId) || rules.allowCreate) continue;
    deny("page_create_denied");
  }
  for (const previousPage of input.previous.pages) {
    if (nextIds.includes(previousPage.pageId)) continue;
    assertPageDeleteAllowed(previousPage, input.policy, rules.allowDelete);
  }
  const remaining = previousIds.filter((pageId) => nextIds.includes(pageId));
  const nextRemaining = nextIds.filter((pageId) => previousIds.includes(pageId));
  if (rules.allowReorder || sameJson(remaining, nextRemaining)) return;
  deny("page_reorder_denied");
}

function assertPageDeleteAllowed(
  page: SitePage,
  policy: SiteEditPolicy,
  allowDelete: boolean,
): void {
  if (!allowDelete) deny("page_delete_denied");
  for (const section of page.sections) {
    const region = regionOf(policy, section.regionKey);
    if (region === undefined) deny("missing_policy");
    if (region.lock === REGION_LOCK.FULL && !region.required) continue;
    deny("page_delete_locked_region");
  }
}

function assertPageFields(previous: SitePage, next: SitePage, rules: SitePageRules): void {
  if (previous.path !== next.path && !rules.allowPathChange) deny("path_change_denied");
  const editable = new Set(rules.editableMetadataKeys);
  if (!editable.has(PAGE_METADATA_KEY.title))
    denyIfChanged(previous.title, next.title, "locked_title");
  if (!editable.has(PAGE_METADATA_KEY.description)) {
    denyIfChanged(previous.seo.description, next.seo.description, "locked_description");
  }
  if (!editable.has(PAGE_METADATA_KEY.noIndex)) {
    denyIfChanged(previous.seo.noIndex, next.seo.noIndex, "locked_no_index");
  }
}

function assertSectionEdits(
  input: EvaluatorInput,
  previousPlacements: Map<string, Placement>,
  nextPlacements: Map<string, Placement>,
): void {
  for (const [sectionId, previous] of previousPlacements) {
    const next = nextPlacements.get(sectionId);
    if (next === undefined) {
      assertDeleteAllowed(previous.section, input.policy);
      continue;
    }
    assertExistingSection(previous, next, input);
  }
  for (const [sectionId, next] of nextPlacements) {
    if (previousPlacements.has(sectionId)) continue;
    assertAddAllowed(next, input);
  }
}

function assertDeleteAllowed(section: SiteSection, policy: SiteEditPolicy): void {
  const region = regionOf(policy, section.regionKey);
  if (region === undefined) deny("missing_policy");
  if (region.lock !== REGION_LOCK.FULL || region.required) deny("delete_locked_section");
}

function assertAddAllowed(next: Placement, input: EvaluatorInput): void {
  if (!input.effectiveSectionKeys.includes(next.section.sectionKey)) deny("section_not_available");
  const region = regionOf(input.policy, next.section.regionKey);
  if (region === undefined) deny("missing_policy");
  if (region.lock !== REGION_LOCK.FULL || region.required) deny("add_locked_region");
  if (!region.sectionKeys.includes(next.section.sectionKey)) deny("section_key_not_allowed");
  assertVariantPalette(next.section, input.policy, undefined);
}

function assertExistingSection(previous: Placement, next: Placement, input: EvaluatorInput): void {
  if (next.section.regionKey !== previous.section.regionKey || next.pageId !== previous.pageId) {
    deny("reparent_denied");
  }
  const available = input.effectiveSectionKeys.includes(previous.section.sectionKey);
  if (!available) {
    denyIfChanged(previous.section, next.section, "section_not_available");
    denyIfChanged(previous.index, next.index, "section_not_available");
    return;
  }
  const region = regionOf(input.policy, previous.section.regionKey);
  if (region === undefined) {
    denyIfChanged(previous.section, next.section, "missing_policy");
    denyIfChanged(previous.index, next.index, "missing_policy");
    return;
  }
  assertLock({ previous, next, region, policy: input.policy });
}

function assertLock(input: {
  previous: Placement;
  next: Placement;
  region: RegionPolicy;
  policy: SiteEditPolicy;
}): void {
  const { previous, next, region, policy } = input;
  if (region.lock === REGION_LOCK.LOCKED) {
    denyIfChanged(previous.section, next.section, "locked_section");
    denyIfChanged(previous.index, next.index, "locked_position");
    return;
  }
  if (region.lock === REGION_LOCK.CONTENT_ONLY) {
    denyIfChanged(previous.section.variantKey, next.section.variantKey, "locked_variant");
    denyIfChanged(previous.section.binding, next.section.binding, "locked_binding");
    denyIfChanged(previous.section.sectionKey, next.section.sectionKey, "locked_section_key");
    denyIfChanged(previous.index, next.index, "locked_position");
    denyIfChanged(
      omitKeys(previous.section.content, region.editableContentKeys),
      omitKeys(next.section.content, region.editableContentKeys),
      "locked_content",
    );
    return;
  }
  if (!region.sectionKeys.includes(next.section.sectionKey)) deny("section_key_not_allowed");
  assertVariantPalette(next.section, policy, previous.section.variantKey);
}

function omitKeys(content: object, allowed: readonly string[]): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) {
    if (allowed.includes(key)) continue;
    rest[key] = value;
  }
  return rest;
}

function assertVariantPalette(
  section: SiteSection,
  policy: SiteEditPolicy,
  previousVariant: string | undefined,
): void {
  const palette = policy.allowedVariantsBySection[section.sectionKey];
  if (palette === undefined) {
    if (previousVariant === section.variantKey) return;
    deny("missing_variant_palette");
  }
  if (!palette.includes(section.variantKey)) deny("variant_not_allowed");
}

function assertRegionBounds(design: SiteDesign, policy: SiteEditPolicy): void {
  const counts = new Map<string, number>();
  for (const placement of placementsOf(design).values()) {
    const regionKey = placement.section.regionKey;
    counts.set(regionKey, (counts.get(regionKey) ?? 0) + 1);
  }
  for (const region of policy.regions) {
    const count = counts.get(region.regionKey) ?? 0;
    if (count > region.maxSections) deny("max_sections");
    if (region.required && count !== 1) deny("required_region_count");
  }
}

function assertStaticContent(input: EvaluatorInput): void {
  const previousByKey = new Map(
    input.previous.staticContent.map((page) => [page.pageKey, page] as const),
  );
  const nextByKey = new Map(input.next.staticContent.map((page) => [page.pageKey, page] as const));
  for (const next of input.next.staticContent) {
    assertStaticPage(previousByKey.get(next.pageKey), next, input.policy);
  }
  for (const previous of input.previous.staticContent) {
    if (nextByKey.has(previous.pageKey)) continue;
    const region = regionOf(input.policy, `${STATIC_CONTENT_REGION_PREFIX}${previous.pageKey}`);
    if (region === undefined || region.lock !== REGION_LOCK.FULL) deny("static_delete_denied");
  }
}

function assertStaticPage(
  previous: StaticPageDraft | undefined,
  next: StaticPageDraft,
  policy: SiteEditPolicy,
): void {
  const region = regionOf(policy, `${STATIC_CONTENT_REGION_PREFIX}${next.pageKey}`);
  if (previous === undefined) {
    if (region === undefined || region.lock !== REGION_LOCK.FULL) deny("static_create_denied");
    return;
  }
  if (sameJson(previous, next)) return;
  if (region === undefined) deny("missing_policy");
  if (region.lock === REGION_LOCK.LOCKED) deny("locked_static_content");
  if (region.lock === REGION_LOCK.CONTENT_ONLY) {
    denyIfChanged(
      omitKeys(previous, region.editableContentKeys),
      omitKeys(next, region.editableContentKeys),
      "locked_static_content",
    );
  }
}
