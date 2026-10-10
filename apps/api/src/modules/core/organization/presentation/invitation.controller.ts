import { asId, type InvitationId } from "@banijjik/ids";
import type {
  InvitationCreateBody,
  InvitationListQuery,
  VersionedTransitionBody,
} from "@banijjik/validation";
import type { Request, RequestHandler, Response } from "express";
import { sendData } from "../../../../kernel/http/index.js";
import { redactFromReplay } from "../../../../kernel/idempotency/index.js";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type {
  AcceptInvitationUseCase,
  PreviewInvitationUseCase,
} from "../application/use-cases/accept-invitation.use-case.js";
import type {
  CreateInvitationUseCase,
  ListInvitationsUseCase,
  RevokeInvitationUseCase,
} from "../application/use-cases/invitation.use-cases.js";
import { toMyOrganizationSummary } from "./my-organization.transformer.js";
import {
  toAssignments,
  toInvitationCreatedResponse,
  toInvitationPreviewResponse,
  toInvitationResponse,
} from "./member-and-invitation.transformers.js";
import { readTenantCaller } from "./tenant-caller.js";

const HTTP_CREATED = 201;
const INVITE_URL_FIELD = "inviteUrlPath";

export interface InvitationControllerDependencies {
  readonly listInvitations: ListInvitationsUseCase;
  readonly createInvitation: CreateInvitationUseCase;
  readonly revokeInvitation: RevokeInvitationUseCase;
  readonly previewInvitation: PreviewInvitationUseCase;
  readonly acceptInvitation: AcceptInvitationUseCase;
  readonly clock: Clock;
}

function readQuery(response: Response): InvitationListQuery {
  // Safe: validate({ query: invitationListQuerySchema }) produced this value on this route.
  return response.locals["validated"].query as InvitationListQuery;
}

function readToken(request: Request): string {
  // validate() already parsed the path parameter with the token schema.
  return String(request.params["token"]);
}

/** Invitation endpoints: the tenant ones and the two user-level link routes (14-API.md sections 4 and 5.1). */
export class InvitationController {
  constructor(private readonly dependencies: InvitationControllerDependencies) {}

  readonly list: RequestHandler = async (_request, response) => {
    const { page, limit, status } = readQuery(response);
    const { clock } = this.dependencies;
    const now = clock.now();
    const result = await this.dependencies.listInvitations.execute({
      page,
      limit,
      now,
      ...(status === undefined ? {} : { status }),
    });
    sendData(
      response,
      result.items.map((item) => toInvitationResponse(item, now)),
      {
        meta: { page, limit, hasNext: result.hasNext },
      },
    );
  };

  readonly create: RequestHandler = async (request, response) => {
    // validate() already parsed the body with the invitation-create schema.
    const body: InvitationCreateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const created = await this.dependencies.createInvitation.execute({
      organizationId,
      actorUserId,
      assignments: toAssignments(body.assignments),
      ...(body.email === undefined ? {} : { email: body.email }),
      ...(body.phone === undefined ? {} : { phoneE164: body.phone }),
      ...(body.displayName === undefined ? {} : { displayName: body.displayName }),
    });
    // The link is shown once: a replay of the same Idempotency-Key must not carry it.
    redactFromReplay(response, [INVITE_URL_FIELD]);
    sendData(
      response,
      toInvitationCreatedResponse(created.invitation, created.token, this.dependencies.clock.now()),
      { status: HTTP_CREATED },
    );
  };

  readonly revoke: RequestHandler = async (request, response) => {
    const body: VersionedTransitionBody = request.body;
    const { actorUserId } = readTenantCaller();
    const invitation = await this.dependencies.revokeInvitation.execute({
      actorUserId,
      invitationId: asId<InvitationId>(String(request.params["invitationId"])),
      version: body.version,
    });
    sendData(response, toInvitationResponse(invitation, this.dependencies.clock.now()));
  };

  readonly preview: RequestHandler = async (request, response) => {
    const preview = await this.dependencies.previewInvitation.execute({
      token: readToken(request),
    });
    sendData(response, toInvitationPreviewResponse(preview));
  };

  readonly accept: RequestHandler = async (request, response) => {
    const organization = await this.dependencies.acceptInvitation.execute({
      token: readToken(request),
      userId: requireCurrentUserId(),
    });
    sendData(response, toMyOrganizationSummary(organization));
  };
}
