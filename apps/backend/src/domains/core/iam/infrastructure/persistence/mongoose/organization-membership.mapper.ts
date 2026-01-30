import { Types } from "mongoose";
import { OrganizationMembership } from "@iam/domain";
import { IOrganizationMembershipDoc } from "./organization-membership.model";

export class OrganizationMembershipMapper {
  static toDomain(doc: IOrganizationMembershipDoc): OrganizationMembership {
    return OrganizationMembership.create({
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      organizationId: doc.organizationId.toString(),
      roleId: doc.roleId.toString(),
      status: doc.status as any,
      joinedAt: doc.joinedAt,
      metadata: doc.metadata,
    });
  }

  static toPersistence(domain: OrganizationMembership): any {
    return {
      userId: new Types.ObjectId(domain.userId),
      organizationId: new Types.ObjectId(domain.organizationId),
      roleId: new Types.ObjectId(domain.roleId),
      status: domain.status,
      joinedAt: domain.joinedAt,
      metadata: domain.toObject().metadata,
    };
  }
}
