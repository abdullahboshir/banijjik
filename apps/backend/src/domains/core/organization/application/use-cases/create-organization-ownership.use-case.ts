import { OrganizationOwnership } from "../../domain/entities/organization-ownership.entity";
import { IOrganizationOwnershipRepository } from "../../domain/repositories/organization-ownership.repository";
import { OwnershipStatus } from "../../domain/value-objects/ownership-status.vo";
import crypto from "crypto";

export interface CreateOrganizationOwnershipDto {
  organizationId: string;
  userId: string;
  billingEmail: string;
  billingPhone?: string;
  taxIdentifier?: string;
  termsVersion?: string;
}

export class CreateOrganizationOwnershipUseCase {
  constructor(
    private readonly ownershipRepository: IOrganizationOwnershipRepository,
  ) {}

  async execute(
    dto: CreateOrganizationOwnershipDto,
  ): Promise<OrganizationOwnership> {
    const ownership = OrganizationOwnership.create({
      ownershipId: crypto.randomUUID(),
      organizationId: dto.organizationId,
      userId: dto.userId,
      legalAcceptedAt: new Date(),
      termsVersion: dto.termsVersion || "1.0",
      taxIdentifier: dto.taxIdentifier,
      billingEmail: dto.billingEmail,
      billingPhone: dto.billingPhone,
      status: OwnershipStatus.VALUE.ACTIVE,
    });

    return await this.ownershipRepository.save(ownership);
  }
}
