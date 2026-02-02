import { StorefrontModel } from "../models/storefront.model";
import { StorefrontMapper } from "../../../mappers/storefront.mapper";
export class StorefrontRepositoryImpl {
    async save(storefront) {
        const raw = StorefrontMapper.toPersistence(storefront);
        await StorefrontModel.findOneAndUpdate({ organizationId: storefront.organizationId }, { $set: raw }, { upsert: true, new: true });
    }
    async findById(storefrontId) {
        const raw = await StorefrontModel.findOne({ storefrontId });
        return raw ? StorefrontMapper.toDomain(raw) : null;
    }
    async findByOrganizationId(organizationId) {
        const raw = await StorefrontModel.findOne({ organizationId });
        return raw ? StorefrontMapper.toDomain(raw) : null;
    }
    async findBySlug(slug) {
        const raw = await StorefrontModel.findOne({ slug });
        return raw ? StorefrontMapper.toDomain(raw) : null;
    }
    async delete(storefrontId) {
        await StorefrontModel.findOneAndDelete({ storefrontId });
    }
}
//# sourceMappingURL=storefront.repository.impl.js.map