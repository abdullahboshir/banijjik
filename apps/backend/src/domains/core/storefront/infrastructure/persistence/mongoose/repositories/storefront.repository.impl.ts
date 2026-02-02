import { Storefront } from "../../../../domain/entities";
import { IStorefrontRepository } from "../../../../domain/repositories";
import { StorefrontModel } from "../models/storefront.model";
import { StorefrontMapper } from "../../../mappers/storefront.mapper";

export class StorefrontRepositoryImpl implements IStorefrontRepository {
  async save(storefront: Storefront): Promise<void> {
    const raw = StorefrontMapper.toPersistence(storefront);
    await StorefrontModel.findOneAndUpdate(
      { organizationId: storefront.organizationId },
      { $set: raw },
      { upsert: true, new: true },
    );
  }

  async findById(storefrontId: string): Promise<Storefront | null> {
    const raw = await StorefrontModel.findOne({ storefrontId });
    return raw ? StorefrontMapper.toDomain(raw) : null;
  }

  async findByOrganizationId(
    organizationId: string,
  ): Promise<Storefront | null> {
    const raw = await StorefrontModel.findOne({ organizationId });
    return raw ? StorefrontMapper.toDomain(raw) : null;
  }

  async findBySlug(slug: string): Promise<Storefront | null> {
    const raw = await StorefrontModel.findOne({ slug });
    return raw ? StorefrontMapper.toDomain(raw) : null;
  }

  async delete(storefrontId: string): Promise<void> {
    await StorefrontModel.findOneAndDelete({ storefrontId });
  }
}
