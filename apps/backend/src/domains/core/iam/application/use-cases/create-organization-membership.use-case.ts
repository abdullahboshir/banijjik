import {
  OrganizationMembership,
  IOrganizationMembershipRepository,
} from "@iam/domain";
import { CreateOrganizationMembershipDto } from "../dto/membership.dto";
import crypto from "crypto";

export class CreateOrganizationMembershipUseCase {
  constructor(
    private readonly membershipRepository: IOrganizationMembershipRepository,
  ) {}

  async execute(dto: CreateOrganizationMembershipDto): Promise<any> {
    const membership = OrganizationMembership.create({
      membershipId: crypto.randomUUID(),
      userId: dto.userId,
      organizationId: dto.organizationId,
      roleId: dto.roleId,
      type: dto.type,
      status: dto.status,
      source: dto.source,
      designation: dto.designation,
      metadata: dto.metadata || {},
      joinedAt: new Date(),
    });
    // 5. Persistence
    return await this.membershipRepository.save(membership);
  }
}
