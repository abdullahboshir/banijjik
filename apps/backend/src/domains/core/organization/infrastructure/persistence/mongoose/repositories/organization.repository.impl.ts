import { Organization } from "../../../../domain/entities/organization.entity";
import { IOrganizationRepository } from "../../../../domain/repositories/organization.repository";
import { OrganizationModel } from "../models/organization.model";
import { OrganizationMapper } from "../mappers/organization.mapper";

export class MongooseOrganizationRepository implements IOrganizationRepository {
  async save(organization: Organization): Promise<Organization> {
    const persistence = OrganizationMapper.toPersistence(organization);
    // Use the explicit business id for upsert/save
    let doc;
    if (organization.organizationId) {
      doc = await OrganizationModel.findOneAndUpdate(
        { organizationId: organization.organizationId },
        persistence,
        { upsert: true, new: true },
      );
    } else {
      doc = await OrganizationModel.create(persistence);
    }
    return OrganizationMapper.toDomain(doc);
  }

  async findById(organizationId: string): Promise<Organization | null> {
    const doc = await OrganizationModel.findOne({ organizationId });
    return doc ? OrganizationMapper.toDomain(doc) : null;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const doc = await OrganizationModel.findOne({ slug });
    return doc ? OrganizationMapper.toDomain(doc) : null;
  }
}
