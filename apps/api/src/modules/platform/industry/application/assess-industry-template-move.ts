import { INDUSTRY_TEMPLATE_STATUS, type IndustryTemplateKey } from "@banijjik/contracts";
import type { IndustryTemplateMove } from "../../../core/organization/index.js";
import { removedKindsAndModules } from "../domain/additive-change.js";
import {
  industryTemplateChangeNotAdditive,
  industryTemplateNotFound,
  industryTemplateStatusInvalid,
} from "../domain/errors.js";
import type { IndustryTemplate } from "../domain/industry-template.entity.js";
import type { IndustryTemplateRepository } from "./ports/industry-template-repository.js";

/**
 * Decides whether an organization may move from one template to another.
 * An unknown key is 404. A retired target is 422. The same key is unchanged.
 */
export class AssessIndustryTemplateMove implements IndustryTemplateMove {
  constructor(private readonly templates: IndustryTemplateRepository) {}

  async assess(input: {
    readonly currentKey: IndustryTemplateKey;
    readonly targetKey: IndustryTemplateKey;
  }): Promise<"unchanged" | "allowed"> {
    if (input.currentKey === input.targetKey) return "unchanged";
    const target = await this.requireTarget(input.targetKey);
    return this.keepCurrentKinds(input.currentKey, target);
  }

  /** Writes the target row, so a retire or a removal PATCH of that row conflicts and retries. */
  async reserve(input: {
    readonly currentKey: IndustryTemplateKey;
    readonly targetKey: IndustryTemplateKey;
  }): Promise<"unchanged" | "allowed"> {
    if (input.currentKey === input.targetKey) return "unchanged";
    const target = await this.templates.reserveAssignable(input.targetKey);
    if (target === undefined) return this.rejectUnreserved(input.targetKey);
    return this.keepCurrentKinds(input.currentKey, target);
  }

  private async rejectUnreserved(templateKey: IndustryTemplateKey): Promise<never> {
    const stored = await this.templates.findByKey(templateKey);
    if (stored === undefined) throw industryTemplateNotFound();
    throw industryTemplateStatusInvalid();
  }

  private async keepCurrentKinds(
    currentKey: IndustryTemplateKey,
    target: IndustryTemplate,
  ): Promise<"allowed"> {
    const current = await this.templates.findByKey(currentKey);
    if (current === undefined) throw industryTemplateNotFound();
    const removed = removedKindsAndModules(current, target);
    if (removed.length > 0) throw industryTemplateChangeNotAdditive(removed);
    return "allowed";
  }

  private async requireTarget(templateKey: IndustryTemplateKey) {
    const target = await this.templates.findByKey(templateKey);
    if (target === undefined) throw industryTemplateNotFound();
    if (target.status === INDUSTRY_TEMPLATE_STATUS.RETIRED) throw industryTemplateStatusInvalid();
    return target;
  }
}
