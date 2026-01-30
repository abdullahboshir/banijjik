import {
  IOrganizationMembershipRepository,
  OrganizationMembership,
} from "@iam/domain";
import { OrganizationMembershipModel } from "./organization-membership.model";
import { OrganizationMembershipMapper } from "./organization-membership.mapper";

export class MongooseOrganizationMembershipRepository implements IOrganizationMembershipRepository {
  async save(membership: OrganizationMembership): Promise<void> {
    const data = OrganizationMembershipMapper.toPersistence(membership);
    await OrganizationMembershipModel.findOneAndUpdate(
      {
        userId: data.userId,
        organizationId: data.organizationId,
        roleId: data.roleId,
      },
      data,
      { upsert: true },
    );
  }

  async findById(id: string): Promise<OrganizationMembership | null> {
    const doc = await OrganizationMembershipModel.findById(id);
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

  async delete(id: string): Promise<void> {
    await OrganizationMembershipModel.findByIdAndDelete(id);
  }
}
