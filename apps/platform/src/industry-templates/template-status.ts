import { INDUSTRY_TEMPLATE_STATUS, type IndustryTemplateStatus } from "@banijjik/contracts";

/** Publish from draft or retired; retire from published. Without write, neither (ADR-101). */
export function templateStatusActions(
  status: IndustryTemplateStatus,
  canWrite: boolean,
): Array<"publish" | "retire"> {
  if (!canWrite) return [];
  if (status === INDUSTRY_TEMPLATE_STATUS.PUBLISHED) return ["retire"];
  return ["publish"];
}

/** Published and retired templates refuse removals. A draft an organization already uses is refused by the API. */
export function templateRefusesRemoval(status: IndustryTemplateStatus): boolean {
  return status !== INDUSTRY_TEMPLATE_STATUS.DRAFT;
}
