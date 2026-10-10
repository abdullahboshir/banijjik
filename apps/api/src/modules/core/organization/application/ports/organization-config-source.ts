import type { IndustryTemplateKey } from "@banijjik/contracts";

/** What the config resolver needs from an organization: its template and its config version. */
export interface OrganizationConfigSnapshot {
  readonly industryTemplateKey: IndustryTemplateKey;
  readonly configVersion: number;
}

export interface OrganizationConfigSource {
  find(organizationId: string): Promise<OrganizationConfigSnapshot | undefined>;
}
