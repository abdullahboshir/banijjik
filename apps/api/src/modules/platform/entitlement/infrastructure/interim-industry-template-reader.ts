import { MODULE_KEY_VALUES, OFFERING_KIND } from "@banijjik/contracts";
import type {
  IndustryTemplateReader,
  IndustryTemplateView,
} from "../application/ports/entitlement-ports.js";

const INTERIM_TEMPLATE_VERSION = 0;

/**
 * Interim reader until card 2.1 (platform/industry): every template allows every module and every
 * kind, at version 0. Steps 2 to 4 of the resolver are fully implemented and tested with a fake
 * reader; the template filter and the PUBLISHED check at signup arrive with the real reader.
 */
export class InterimIndustryTemplateReader implements IndustryTemplateReader {
  async find(): Promise<IndustryTemplateView> {
    return {
      allowedModuleKeys: MODULE_KEY_VALUES,
      enabledKinds: Object.values(OFFERING_KIND),
      templateVersion: INTERIM_TEMPLATE_VERSION,
    };
  }
}
