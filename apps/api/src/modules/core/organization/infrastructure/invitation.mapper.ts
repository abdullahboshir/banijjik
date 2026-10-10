import { asId, type InvitationId, type OrganizationId, type UserId } from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import { Invitation } from "../domain/invitation.entity.js";
import { toAuthorId } from "./author-id.js";
import type { InvitationDocument } from "./invitation.schema.js";
import { toAssignment, toAssignmentDocument } from "./member.mapper.js";

/** The document to insert. Optional fields that are absent are left out, not stored as null. */
export function toInvitationDocument(invitation: Invitation): InvitationDocument {
  return {
    invitationId: invitation.invitationId,
    organizationId: invitation.organizationId,
    assignments: invitation.assignments.map(toAssignmentDocument),
    invitedByUserId: invitation.invitedByUserId,
    tokenHash: invitation.tokenHash,
    expiresAt: invitation.expiresAt,
    status: invitation.status,
    version: invitation.version,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
    createdByUserId: invitation.createdByUserId,
    updatedByUserId: null,
    ...(invitation.email === undefined ? {} : { email: invitation.email }),
    ...(invitation.phoneE164 === undefined ? {} : { phoneE164: invitation.phoneE164 }),
    ...(invitation.displayName === undefined ? {} : { displayName: invitation.displayName }),
  };
}

export function toInvitation(document: InvitationDocument): Invitation {
  const stored = stripMongoInternals(document);
  return Invitation.restore({
    invitationId: asId<InvitationId>(stored.invitationId),
    organizationId: asId<OrganizationId>(stored.organizationId),
    email: stored.email,
    phoneE164: stored.phoneE164,
    displayName: stored.displayName,
    assignments: stored.assignments.map(toAssignment),
    invitedByUserId: asId<UserId>(stored.invitedByUserId),
    tokenHash: stored.tokenHash,
    expiresAt: stored.expiresAt,
    status: stored.status,
    acceptedByUserId:
      stored.acceptedByUserId === undefined ? undefined : asId<UserId>(stored.acceptedByUserId),
    acceptedAt: stored.acceptedAt,
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    createdByUserId: toAuthorId(stored.createdByUserId),
  });
}
