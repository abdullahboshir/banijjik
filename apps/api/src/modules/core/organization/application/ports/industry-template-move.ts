import type { IndustryTemplateKey } from "@banijjik/contracts";

export interface IndustryTemplateMoveInput {
  readonly currentKey: IndustryTemplateKey;
  readonly targetKey: IndustryTemplateKey;
}

/** Whether moving an organization from one template to another is allowed. Implemented by platform/industry. */
export interface IndustryTemplateMove {
  assess(input: IndustryTemplateMoveInput): Promise<"unchanged" | "allowed">;
  /** Reserves the target inside the move transaction, then compares kinds and modules (ADR-092). */
  reserve(input: IndustryTemplateMoveInput): Promise<"unchanged" | "allowed">;
}
