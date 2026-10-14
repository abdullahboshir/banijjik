import { INDUSTRY_TEMPLATE_STATUS, type IndustryTemplateKey } from "@banijjik/contracts";
import type { IndustryTemplateMove } from "../../../core/organization/index.js";
import { removedKindsAndModules } from "../domain/additive-change.js";
import {
  industryTemplateChangeNotAdditive,
  industryTemplateNotFound,
  industryTemplateStatusInvalid,
} from "../domain/errors.js";
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
    const current = await this.templates.findByKey(input.currentKey);
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
