import { Types } from "mongoose";
import { OrganizationMembership } from "@iam/domain";
export class OrganizationMembershipMapper {
    static toDomain(doc) {
        return OrganizationMembership.create({
            id: doc._id.toString(),
            userId: doc.userId.toString(),
            organizationId: doc.organizationId.toString(),
            roleId: doc.roleId.toString(),
            type: doc.type,
            designation: doc.designation,
            memberCode: doc.memberCode,
            status: doc.status,
            source: doc.source,
            joinedAt: doc.joinedAt,
            updatedAt: doc.updatedAt,
            metadata: doc.metadata,
        });
    }
    static toPersistence(domain) {
        const props = domain.toObject();
        return {
            userId: new Types.ObjectId(props.userId),
            organizationId: new Types.ObjectId(props.organizationId),
            roleId: new Types.ObjectId(props.roleId),
            type: props.type,
            designation: props.designation,
            memberCode: props.memberCode,
            status: props.status,
            source: props.source,
            joinedAt: props.joinedAt,
            updatedAt: props.updatedAt,
            metadata: props.metadata,
        };
    }
}
//# sourceMappingURL=organization-membership.mapper.js.map