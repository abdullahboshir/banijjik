import { asId, type MemberId } from "@banijjik/ids";
import type {
  MemberListQuery,
  MemberUpdateBody,
  VersionedTransitionBody,
} from "@banijjik/validation";
import type { Request, RequestHandler, Response } from "express";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  ChangeMemberStatusUseCase,
  GetMemberUseCase,
  ListMembersUseCase,
  MemberStatusAction,
  UpdateMemberUseCase,
} from "../application/use-cases/member.use-cases.js";
import { toAssignments, toMemberResponse } from "./member-and-invitation.transformers.js";
import { readTenantCaller } from "./tenant-caller.js";

export interface MemberControllerDependencies {
  readonly listMembers: ListMembersUseCase;
  readonly getMember: GetMemberUseCase;
  readonly updateMember: UpdateMemberUseCase;
  readonly changeStatus: ChangeMemberStatusUseCase;
}

function readMemberId(request: Request): MemberId {
  // validate() already parsed the path parameter with the member-id schema.
  return asId<MemberId>(String(request.params["memberId"]));
}

function readQuery(response: Response): MemberListQuery {
  // Safe: validate({ query: memberListQuerySchema }) produced this value on this route.
  return response.locals["validated"].query as MemberListQuery;
}

/** Staff endpoints (14-API.md section 5.1). Access control lives in the use cases and the router guards. */
export class MemberController {
  constructor(private readonly dependencies: MemberControllerDependencies) {}

  readonly list: RequestHandler = async (_request, response) => {
    const { page, limit, status, q } = readQuery(response);
    const result = await this.dependencies.listMembers.execute({
      page,
      limit,
      reach: readTenantCaller().allowedLocationIds,
      ...(status === undefined ? {} : { status }),
      ...(q === undefined ? {} : { search: q }),
    });
    sendData(response, result.items.map(toMemberResponse), {
      meta: { page, limit, hasNext: result.hasNext },
    });
  };

  readonly get: RequestHandler = async (request, response) => {
    const member = await this.dependencies.getMember.execute({
      memberId: readMemberId(request),
      reach: readTenantCaller().allowedLocationIds,
    });
    sendData(response, toMemberResponse(member));
  };

  readonly update: RequestHandler = async (request, response) => {
    // validate() already parsed the body with the member-update schema.
    const body: MemberUpdateBody = request.body;
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    const member = await this.dependencies.updateMember.execute({
      organizationId,
      actorUserId,
      reach: allowedLocationIds,
      memberId: readMemberId(request),
      version: body.version,
      changes: {
        ...(body.displayName === undefined ? {} : { displayName: body.displayName }),
        ...(body.jobTitle === undefined ? {} : { jobTitle: body.jobTitle }),
        ...(body.assignments === undefined ? {} : { assignments: toAssignments(body.assignments) }),
      },
    });
    sendData(response, toMemberResponse(member));
  };

  /** One handler per transition, so the router names what each route does. */
  readonly transition = (action: MemberStatusAction): RequestHandler => {
    return async (request, response) => {
      const body: VersionedTransitionBody = request.body;
      const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
      const member = await this.dependencies.changeStatus.execute({
        organizationId,
        actorUserId,
        reach: allowedLocationIds,
        memberId: readMemberId(request),
        version: body.version,
        action,
      });
      sendData(response, toMemberResponse(member));
    };
  };
}
