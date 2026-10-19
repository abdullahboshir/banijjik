import type { ApprovalGrantBody, ApprovalPinSetBody, ApproversQuery } from "@banijjik/validation";
import { asId, type MemberId } from "@banijjik/ids";
import type { RequestHandler, Response } from "express";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { readTenantIdentity } from "../../../../kernel/access/index.js";
import { AppError, sendData } from "../../../../kernel/http/index.js";
import { ERROR_CODE } from "@banijjik/contracts";
import type { GrantApprovalUseCase } from "../application/use-cases/grant-approval.use-case.js";
import type { ListApproversUseCase } from "../application/use-cases/list-approvers.use-case.js";
import type { RemoveApprovalPinUseCase } from "../application/use-cases/remove-approval-pin.use-case.js";
import type { SetApprovalPinUseCase } from "../application/use-cases/set-approval-pin.use-case.js";

export interface ApprovalsControllerDependencies {
  readonly setPin: SetApprovalPinUseCase;
  readonly removePin: RemoveApprovalPinUseCase;
  readonly grant: GrantApprovalUseCase;
  readonly listApprovers: ListApproversUseCase;
}

const HTTP_NO_CONTENT = 204;

function readMemberId(): MemberId {
  const memberId = getRequestContext().memberId;
  if (memberId === undefined) {
    throw new AppError({
      code: ERROR_CODE.INTERNAL,
      messageKey: "errors.missing_tenant_context",
    });
  }
  return asId<MemberId>(memberId);
}

function readApproversQuery(response: Response): ApproversQuery {
  // Safe: validate({ query: approversQuerySchema }) produced this value on this route.
  return response.locals["validated"].query as ApproversQuery;
}

export class ApprovalsController {
  constructor(private readonly dependencies: ApprovalsControllerDependencies) {}

  readonly setPin: RequestHandler = async (request, response) => {
    const body: ApprovalPinSetBody = request.body;
    await this.dependencies.setPin.execute({
      ...readTenantIdentity(),
      memberId: readMemberId(),
      currentPassword: body.currentPassword,
      pin: body.pin,
    });
    response.status(HTTP_NO_CONTENT).end();
  };

  readonly removePin: RequestHandler = async (_request, response) => {
    await this.dependencies.removePin.execute({
      ...readTenantIdentity(),
      memberId: readMemberId(),
    });
    response.status(HTTP_NO_CONTENT).end();
  };

  readonly grant: RequestHandler = async (request, response) => {
    const body: ApprovalGrantBody = request.body;
    const result = await this.dependencies.grant.execute({
      ...readTenantIdentity(),
      action: body.action,
      subjectKey: body.subjectKey,
      amount: body.amount,
      locationId: body.locationId,
      approverMemberId: asId<MemberId>(body.approverMemberId),
      pin: body.pin,
    });
    sendData(response, {
      approvalToken: result.approvalToken,
      expiresAt: result.expiresAt.toISOString(),
    });
  };

  readonly listApprovers: RequestHandler = async (_request, response) => {
    const query = readApproversQuery(response);
    const items = await this.dependencies.listApprovers.execute({
      organizationId: readTenantIdentity().organizationId,
      locationId: query.locationId,
    });
    sendData(response, items);
  };
}
