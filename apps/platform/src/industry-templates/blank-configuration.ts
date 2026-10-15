import { OFFERING_KIND, type IndustryTemplateConfiguration } from "@banijjik/contracts";
import { emptyCustomField } from "./empty-custom-field";

export { emptyCustomField };

/** The smallest configuration the API accepts when an operator starts an industry with nothing copied. */
export function blankIndustryConfiguration(): IndustryTemplateConfiguration {
  return {
    contactRoleKeys: ["CUSTOMER"],
    relationKeys: [],
    resourceTypes: [],
    terms: { contact: { bn: "যোগাযোগ", en: "Contact" } },
    customFields: [],
    settingsDefaults: {},
    knowledgeSeed: [{ topicKey: "HOURS", answer: { bn: "সময়", en: "Hours" } }],
    websiteTemplateKeys: ["blank"],
    botDefaults: { personaKey: "GUIDE", handoffTopics: ["help"] },
  };
}

export const BLANK_ENABLED_KINDS = [OFFERING_KIND.PRODUCT] as const;
export const BLANK_MODULE_KEYS = ["catalog"] as const;
