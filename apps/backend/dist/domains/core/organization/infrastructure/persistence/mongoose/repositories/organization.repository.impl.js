import { OrganizationModel } from "../models/organization.model";
import { OrganizationMapper } from "../mappers/organization.mapper";
export class MongooseOrganizationRepository {
    async save(organization) {
        const persistence = OrganizationMapper.toPersistence(organization);
        // Use the explicit business id for upsert/save
        let doc;
        if (organization.organizationId) {
            doc = await OrganizationModel.findOneAndUpdate({ organizationId: organization.organizationId }, persistence, { upsert: true, new: true });
        }
        else {
            doc = await OrganizationModel.create(persistence);
        }
        return OrganizationMapper.toDomain(doc);
    }
    async findById(organizationId) {
        const doc = await OrganizationModel.findOne({ organizationId });
        return doc ? OrganizationMapper.toDomain(doc) : null;
    }
    async findBySlug(slug) {
        const doc = await OrganizationModel.findOne({ slug });
        return doc ? OrganizationMapper.toDomain(doc) : null;
    }
}
//# sourceMappingURL=organization.repository.impl.js.map