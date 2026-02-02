import { OrganizationOwnership } from "../entities/organization-ownership.entity";

export interface IOrganizationOwnershipRepository {
  save(ownership: OrganizationOwnership): Promise<OrganizationOwnership>;
  findByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationOwnership | null>;
  findByUserId(userId: string): Promise<OrganizationOwnership[]>;
  findById(ownershipId: string): Promise<OrganizationOwnership | null>;
}
