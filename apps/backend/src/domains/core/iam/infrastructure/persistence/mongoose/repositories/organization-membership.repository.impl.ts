import {
  IOrganizationMembershipRepository,
  OrganizationMembership,
} from "@iam/domain";
import { OrganizationMembershipModel } from "../models/organization-membership.model";
import { OrganizationMembershipMapper } from "../mappers/organization-membership.mapper";

export class MongooseOrganizationMembershipRepository implements IOrganizationMembershipRepository {
  async save(
    membership: OrganizationMembership,
  ): Promise<OrganizationMembership> {
    const data = OrganizationMembershipMapper.toPersistence(membership);
    console.log("   [Repo] Saving Membership Data:", JSON.stringify(data));
    const doc = await OrganizationMembershipModel.findOneAndUpdate(
      {
        userId: data.userId,
        organizationId: data.organizationId,
        roleId: data.roleId,
      },
      data,
      { upsert: true, new: true },
    );
    console.log("   [Repo] Membership Saved. Doc ID:", doc?._id);
    return OrganizationMembershipMapper.toDomain(doc as any);
  }

  async findById(
    organizationMembershipId: string,
  ): Promise<OrganizationMembership | null> {
    // Note: If membershipId is mapped from _id.toString(), this findById is still valid.
    // But for consistency with Hybrid ID Strategy, we should use membershipId field if it exists.
    const doc = await OrganizationMembershipModel.findById(
      organizationMembershipId,
    );
    if (!doc) return null;
    return OrganizationMembershipMapper.toDomain(doc as any);
  }

  async findByUserAndOrg(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMembership[]> {
    const docs = await OrganizationMembershipModel.find({
      userId,
      organizationId,
    });
    return docs.map((doc) => OrganizationMembershipMapper.toDomain(doc as any));
  }

  async findByOrganization(
    organizationId: string,
  ): Promise<OrganizationMembership[]> {
    const docs = await OrganizationMembershipModel.find({ organizationId });
    return docs.map((doc) => OrganizationMembershipMapper.toDomain(doc as any));
  }

  async delete(organizationMembershipId: string): Promise<void> {
    await OrganizationMembershipModel.findByIdAndDelete(
      organizationMembershipId,
    );
  }
}
