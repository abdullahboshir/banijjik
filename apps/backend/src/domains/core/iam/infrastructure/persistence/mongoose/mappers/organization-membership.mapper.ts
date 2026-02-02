import { OrganizationMembership } from "@iam/domain";
import { IOrganizationMembershipDoc } from "../models/organization-membership.model";

export class OrganizationMembershipMapper {
  static toDomain(doc: IOrganizationMembershipDoc): OrganizationMembership {
    return OrganizationMembership.create({
      membershipId: doc._id?.toString() ?? crypto.randomUUID(),
      userId: doc.userId,
      organizationId: doc.organizationId,
      roleId: doc.roleId,
      type: doc.type,
      designation: doc.designation,
      memberCode: doc.memberCode,
      status: doc.status as any,
      source: doc.source,
      joinedAt: doc.joinedAt,
      metadata: doc.metadata,
      updatedAt: (doc as any).updatedAt,
    });
  }

  static toPersistence(domain: OrganizationMembership): any {
    const props = domain.toObject();
    return {
      userId: props.userId,
      organizationId: props.organizationId,
      roleId: props.roleId,
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
