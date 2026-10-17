import type { OrganizationStatus } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";

/** An organization as its member sees it: the shape of both `POST /me/orgs` and `GET /me/orgs`. */
export interface MyOrganization {
  readonly organizationId: OrganizationId;
  readonly slug: string;
  readonly name: string;
  readonly status: OrganizationStatus;
  readonly roleKeys: readonly string[];
  /** The logo file, when the business has one; the transformer turns it into a thumbnail address (card 3.12). */
  readonly logoFileId?: string;
}
