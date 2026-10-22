/**
 * The timezone of an organization.
 * Read directly from the organization document for date-computing modules.
 */
export interface OrganizationTimezoneReader {
  read(organizationId: string): Promise<string | undefined>;
}
