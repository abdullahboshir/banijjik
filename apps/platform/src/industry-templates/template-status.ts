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

/** Published and retired templates refuse removals, and so does a draft an organization already uses (the API refuses it). */
export function templateRefusesRemoval(template: {
  status: IndustryTemplateStatus;
  isInUse: boolean;
}): boolean {
  return template.status !== INDUSTRY_TEMPLATE_STATUS.DRAFT || template.isInUse;
}

/** The message key of the lock banner: the status for a published or retired template, "in use" for a draft that is used. */
export function templateLockMessageKey(template: {
  status: IndustryTemplateStatus;
  isInUse: boolean;
}): string | undefined {
  if (template.status !== INDUSTRY_TEMPLATE_STATUS.DRAFT) {
    return `platform.industry.locked.${template.status}`;
  }
  return template.isInUse ? "platform.industry.locked.IN_USE" : undefined;
}
