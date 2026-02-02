import { OrganizationOwnership } from "../../../../domain/entities/organization-ownership.entity";
import { IOrganizationOwnershipDoc } from "../models/organization-ownership.model";

export class OrganizationOwnershipMapper {
  static toDomain(doc: IOrganizationOwnershipDoc): OrganizationOwnership {
    return OrganizationOwnership.create({
      ownershipId: doc.ownershipId,
      organizationId: doc.organizationId,
      userId: doc.userId,
      legalAcceptedAt: doc.legalAcceptedAt,
      termsVersion: doc.termsVersion,
      taxIdentifier: doc.taxIdentifier,
      billingEmail: doc.billingEmail,
      billingPhone: doc.billingPhone,
      accountRecoveryEmail: doc.accountRecoveryEmail,
      accountRecoveryPhone: doc.accountRecoveryPhone,
      transferredFrom: doc.transferredFrom,
      transferredAt: doc.transferredAt,
      status: doc.status,
      createdAt: (doc as any).createdAt,
      updatedAt: (doc as any).updatedAt,
    });
  }

  static toPersistence(domain: OrganizationOwnership): any {
    const props = domain.toPrimitives();
    return {
      ownershipId: props.ownershipId,
      organizationId: props.organizationId,
      userId: props.userId,
      legalAcceptedAt: props.legalAcceptedAt,
      termsVersion: props.termsVersion,
      taxIdentifier: props.taxIdentifier,
      billingEmail: props.billingEmail,
      billingPhone: props.billingPhone,
      accountRecoveryEmail: props.accountRecoveryEmail,
      accountRecoveryPhone: props.accountRecoveryPhone,
      transferredFrom: props.transferredFrom,
      transferredAt: props.transferredAt,
      status: props.status,
    };
  }
}
