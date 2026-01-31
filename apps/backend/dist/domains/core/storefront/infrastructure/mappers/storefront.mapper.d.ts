import { Storefront } from "../../domain/entities/storefront.entity";
import { IStorefrontDoc } from "../persistence/mongoose/models/storefront.model";
export declare class StorefrontMapper {
    static toDomain(raw: IStorefrontDoc): Storefront;
    static toPersistence(domain: Storefront): any;
}
//# sourceMappingURL=storefront.mapper.d.ts.map