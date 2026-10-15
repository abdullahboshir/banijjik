import type { IndustryTemplateCustomField } from "@banijjik/contracts";
import { industryTemplateConfigurationSchema } from "@banijjik/validation";
import { blankIndustryConfiguration } from "./blank-configuration";

/** True when this one field would pass the same schema the API uses for a template configuration. */
export function customFieldIsValid(field: IndustryTemplateCustomField): boolean {
  const configuration = { ...blankIndustryConfiguration(), customFields: [field] };
  return industryTemplateConfigurationSchema.safeParse(configuration).success;
}
