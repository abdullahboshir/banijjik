import type { IndustryTemplateKey } from "@banijjik/contracts";

/** Whether moving an organization from one template to another is allowed. Implemented by platform/industry. */
export interface IndustryTemplateMove {
  assess(input: {
    readonly currentKey: IndustryTemplateKey;
    readonly targetKey: IndustryTemplateKey;
  }): Promise<"unchanged" | "allowed">;
}
