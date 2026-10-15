import type {
  IndustryTemplateConfiguration,
  LocalizedText,
  OfferingKind,
} from "@banijjik/contracts";

/** The create body. The API checks the key and the configuration; this file may name the key. */
export interface IndustryTemplateCreatePayload {
  industryTemplateKey: string;
  name: LocalizedText;
  description: LocalizedText;
  iconKey: string;
  reason: string;
  enabledKinds?: readonly OfferingKind[] | undefined;
  allowedModuleKeys?: readonly string[] | undefined;
  configuration?: IndustryTemplateConfiguration | undefined;
  cloneFromIndustryTemplateId?: string | undefined;
}
