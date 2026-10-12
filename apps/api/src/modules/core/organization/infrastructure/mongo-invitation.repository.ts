import { INVITATION_STATUS, type InvitationStatus } from "@banijjik/contracts";
import type { InvitationId, LocationId, UserId } from "@banijjik/ids";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type {
  InvitationListRequest,
  InvitationRepository,
} from "../application/ports/member-and-invitation-repositories.js";
import type { Page } from "../application/ports/profile-and-location-repositories.js";
import type { Invitation } from "../domain/invitation.entity.js";
import { assignmentsReachFilter } from "./assignments-reach-filter.js";
import { toInvitation, toInvitationDocument } from "./invitation.mapper.js";
import { INVITATION_MODEL_NAME, type InvitationDocument } from "./invitation.schema.js";

const LIST_SORT = { createdAt: -1, invitationId: 1 } as const;

/**
 * The stored status plus the date decide what a reader sees: PENDING means stored PENDING and not
 * yet expired, EXPIRED means stored PENDING and past its date (09 section 4.4).
 */
function statusFilter(status: InvitationStatus | undefined, now: Date): object {
  if (status === undefined) return {};
  if (status === INVITATION_STATUS.PENDING) {
    return { status: INVITATION_STATUS.PENDING, expiresAt: { $gt: now } };
  }
  if (status === INVITATION_STATUS.EXPIRED) {
    return { status: INVITATION_STATUS.PENDING, expiresAt: { $lte: now } };
  }
  return { status };
}

/** Invitations are tenant data: the tenant plugin adds the organization filter to every query. */
export class MongoInvitationRepository implements InvitationRepository {
  async insert(invitation: Invitation): Promise<void> {
    await this.model().create(
      [toInvitationDocument(invitation)],
      sessionOption(getActiveSession()),
    );
  }

  async findById(invitationId: InvitationId): Promise<Invitation | undefined> {
    const document = await this.model()
      .findOne({ invitationId }, null, sessionOption(getActiveSession()))
      .lean<InvitationDocument>();
    return document === null ? undefined : toInvitation(document);
  }

  async list(request: InvitationListRequest): Promise<Page<Invitation>> {
    const { status, now, page, limit, reach } = request;
    // One extra row tells whether another page exists, without counting the collection.
    const documents = await this.model()
      .find(
        { ...statusFilter(status, now), ...assignmentsReachFilter(reach) },
        null,
        sessionOption(getActiveSession()),
      )
      .sort(LIST_SORT)
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .lean<InvitationDocument[]>();
    return {
      items: documents.slice(0, limit).map(toInvitation),
      hasNext: documents.length > limit,
    };
  }

  async listPendingInvitedBy(userId: UserId, now: Date): Promise<Invitation[]> {
    const documents = await this.model()
      .find(
        { ...statusFilter(INVITATION_STATUS.PENDING, now), invitedByUserId: userId },
        null,
        sessionOption(getActiveSession()),
      )
      .lean<InvitationDocument[]>();
    return documents.map(toInvitation);
  }

  countPending(now: Date): Promise<number> {
    return this.model()
      .countDocuments(statusFilter(INVITATION_STATUS.PENDING, now))
      .session(getActiveSession() ?? null)
      .exec();
  }

  async existsPendingNaming(locationId: LocationId, now: Date): Promise<boolean> {
    const found = await this.model()
      .exists({
        ...statusFilter(INVITATION_STATUS.PENDING, now),
        "assignments.locationId": locationId,
      })
      .session(getActiveSession() ?? null);
    return found !== null;
  }

  async update(
    invitation: Invitation,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<Invitation> {
    const saved = await updateVersioned<InvitationDocument>({
      model: this.model(),
      filter: { invitationId: invitation.invitationId },
      expectedVersion,
      update: {
        $set: {
          status: invitation.status,
          updatedByUserId: actorUserId,
          ...(invitation.acceptedByUserId === undefined
            ? {}
            : { acceptedByUserId: invitation.acceptedByUserId }),
          ...(invitation.acceptedAt === undefined ? {} : { acceptedAt: invitation.acceptedAt }),
        },
      },
    });
    return toInvitation(saved);
  }

  private model() {
    return models({}).get<InvitationDocument>(INVITATION_MODEL_NAME);
  }
}
