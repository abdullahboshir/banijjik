import { OrganizationModel } from "../models/organization.model";
import { OrganizationMapper } from "../mappers/organization.mapper";
export class MongooseOrganizationRepository {
    async save(organization) {
        const persistence = OrganizationMapper.toPersistence(organization);
        // Use the explicit business id for upsert/save
        if (organization.id) {
            await OrganizationModel.findOneAndUpdate({ id: organization.id }, persistence, { upsert: true, new: true });
        }
        else {
            await OrganizationModel.create(persistence);
        }
    }
    async findById(id) {
        const doc = await OrganizationModel.findOne({ id });
        return doc ? OrganizationMapper.toDomain(doc) : null;
    }
    async findBySlug(slug) {
        const doc = await OrganizationModel.findOne({ slug });
        return doc ? OrganizationMapper.toDomain(doc) : null;
    }
}
//# sourceMappingURL=organization.repository.impl.js.map