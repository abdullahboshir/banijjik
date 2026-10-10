/**
 * Increments `Organization.configVersion`, which keys the resolved-config cache (card 1.6a).
 * Implemented by core/organization (it owns the organization), like the roles-version bumper of
 * iam. It joins the surrounding unit of work, so a subscription or override write and its bump
 * commit together or not at all. Every writer of a subscription or an override must call it.
 */
export interface ConfigVersionBumper {
  bump(organizationId: string): Promise<void>;
}
