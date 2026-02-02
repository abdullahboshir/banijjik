import { IOrganizationOwnershipRepository } from "../../../../domain/repositories/organization-ownership.repository";
import { OrganizationOwnership } from "../../../../domain/entities/organization-ownership.entity";
import { OrganizationOwnershipModel } from "../models/organization-ownership.model";
import { OrganizationOwnershipMapper } from "../mappers/organization-ownership.mapper";

export class MongooseOrganizationOwnershipRepository implements IOrganizationOwnershipRepository {
  async save(ownership: OrganizationOwnership): Promise<OrganizationOwnership> {
    const data = OrganizationOwnershipMapper.toPersistence(ownership);
    const doc = await OrganizationOwnershipModel.findOneAndUpdate(
      { ownershipId: data.ownershipId },
      data,
      { upsert: true, new: true },
    );
    return OrganizationOwnershipMapper.toDomain(doc as any);
  }

  async findByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationOwnership | null> {
    const doc = await OrganizationOwnershipModel.findOne({ organizationId });
    if (!doc) return null;
    return OrganizationOwnershipMapper.toDomain(doc as any);
  }

  async findByUserId(userId: string): Promise<OrganizationOwnership[]> {
    const docs = await OrganizationOwnershipModel.find({ userId });
    return docs.map((doc) => OrganizationOwnershipMapper.toDomain(doc as any));
  }

  async findById(ownershipId: string): Promise<OrganizationOwnership | null> {
    const doc = await OrganizationOwnershipModel.findOne({ ownershipId });
    if (!doc) return null;
    return OrganizationOwnershipMapper.toDomain(doc as any);
  }
}
