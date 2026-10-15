import type { IndustryTemplateConfiguration } from "@banijjik/contracts";
import {
  toIndustryTemplateWriteConfiguration,
  type IndustryTemplateUpdateBody,
} from "@banijjik/validation";

type WriteConfiguration = NonNullable<IndustryTemplateUpdateBody["configuration"]>;

/** The PATCH body wants the write schema's output, which is a fresh copy of the stored configuration. */
export function writeConfiguration(
  configuration: IndustryTemplateConfiguration,
): WriteConfiguration {
  return toIndustryTemplateWriteConfiguration(configuration);
}
