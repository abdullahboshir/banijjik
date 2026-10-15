import type { LocalizedText } from "@banijjik/contracts";

/** Template terms for one organization. Only industry implements this (ADR-104). */
export interface IndustryTermsReader {
  forOrganization(organizationId: string): Promise<Readonly<Record<string, LocalizedText>>>;
}
