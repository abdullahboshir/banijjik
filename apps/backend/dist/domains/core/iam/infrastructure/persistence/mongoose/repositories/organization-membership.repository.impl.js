import { OrganizationMembershipModel } from "../models/organization-membership.model";
import { OrganizationMembershipMapper } from "../mappers/organization-membership.mapper";
export class MongooseOrganizationMembershipRepository {
    async save(membership) {
        const data = OrganizationMembershipMapper.toPersistence(membership);
        await OrganizationMembershipModel.findOneAndUpdate({
            userId: data.userId,
            organizationId: data.organizationId,
            roleId: data.roleId,
        }, data, { upsert: true });
    }
    async findById(id) {
        const doc = await OrganizationMembershipModel.findById(id);
        if (!doc)
            return null;
        return OrganizationMembershipMapper.toDomain(doc);
    }
    async findByUserAndOrg(userId, organizationId) {
        const docs = await OrganizationMembershipModel.find({
            userId,
            organizationId,
        });
        return docs.map((doc) => OrganizationMembershipMapper.toDomain(doc));
    }
    async findByOrganization(organizationId) {
        const docs = await OrganizationMembershipModel.find({ organizationId });
        return docs.map((doc) => OrganizationMembershipMapper.toDomain(doc));
    }
    async delete(id) {
        await OrganizationMembershipModel.findByIdAndDelete(id);
    }
}
//# sourceMappingURL=organization-membership.repository.impl.js.map