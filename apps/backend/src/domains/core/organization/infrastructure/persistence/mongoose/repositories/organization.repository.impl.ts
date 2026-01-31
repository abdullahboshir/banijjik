import { Organization } from "../../../../domain/entities/organization.entity";
import { IOrganizationRepository } from "../../../../domain/repositories/organization.repository";
import { OrganizationModel } from "../models/organization.model";
import { OrganizationMapper } from "../mappers/organization.mapper";

export class MongooseOrganizationRepository implements IOrganizationRepository {
  async save(organization: Organization): Promise<void> {
    const persistence = OrganizationMapper.toPersistence(organization);
    // Use the explicit business id for upsert/save
    if (organization.id) {
      await OrganizationModel.findOneAndUpdate(
        { id: organization.id },
        persistence,
        { upsert: true, new: true },
      );
    } else {
      await OrganizationModel.create(persistence);
    }
  }

  async findById(id: string): Promise<Organization | null> {
    const doc = await OrganizationModel.findOne({ id });
    return doc ? OrganizationMapper.toDomain(doc) : null;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const doc = await OrganizationModel.findOne({ slug });
    return doc ? OrganizationMapper.toDomain(doc) : null;
  }
}
