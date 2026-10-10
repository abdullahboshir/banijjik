import { models } from "../../../../kernel/db/index.js";
import type {
  InvitationTokenLookup,
  InvitationWithContext,
} from "../application/ports/member-and-invitation-repositories.js";
import { toInvitation } from "./invitation.mapper.js";
import { INVITATION_MODEL_NAME, type InvitationDocument } from "./invitation.schema.js";
import { MEMBER_MODEL_NAME, type MemberDocument } from "./member.schema.js";
import { ORGANIZATION_MODEL_NAME, type OrganizationDocument } from "./organization.schema.js";

/**
 * Finds an invitation by its token hash across organizations, then the two facts the preview
 * shows. Three indexed reads. It runs without a tenant context, so routes/v1.ts wraps it as
 * system access (AUTH_LOOKUP).
 */
export class MongoInvitationTokenLookup implements InvitationTokenLookup {
  async findByTokenHash(tokenHash: string): Promise<InvitationWithContext | undefined> {
    const document = await models({})
      .get<InvitationDocument>(INVITATION_MODEL_NAME)
      .findOne({ tokenHash })
      .lean<InvitationDocument>();
    if (document === null) return undefined;
    const invitation = toInvitation(document);
    const organization = await models({})
      .get<OrganizationDocument>(ORGANIZATION_MODEL_NAME)
      .findOne({ organizationId: invitation.organizationId }, { name: 1, _id: 0 })
      .lean<Pick<OrganizationDocument, "name">>();
    if (organization === null) return undefined;
    const inviter = await models({})
      .get<MemberDocument>(MEMBER_MODEL_NAME)
      .findOne(
        { organizationId: invitation.organizationId, userId: invitation.invitedByUserId },
        { displayName: 1, _id: 0 },
      )
      .lean<Pick<MemberDocument, "displayName">>();
    return {
      invitation,
      organizationName: organization.name,
      invitedByDisplayName: inviter?.displayName ?? organization.name,
    };
  }
}
