import type { PlatformChangePackageBody, PlatformExtendTrialBody } from "@banijjik/validation";
import type { RequestHandler, Response } from "express";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  ChangePackageUseCase,
  ExtendTrialUseCase,
  GetSubscriptionUseCase,
} from "../application/use-cases/subscription-admin.use-cases.js";
import { toSubscriptionResponse } from "./subscription.transformer.js";

export interface SubscriptionControllerDependencies {
  readonly getSubscription: GetSubscriptionUseCase;
  readonly extendTrial: ExtendTrialUseCase;
  readonly changePackage: ChangePackageUseCase;
}

function organizationIdOf(response: Response): string {
  // Safe: validate({ params: platformOrganizationParamsSchema }) produced this value on these routes.
  return (response.locals["validated"].params as { organizationId: string }).organizationId;
}

export class SubscriptionController {
  constructor(private readonly dependencies: SubscriptionControllerDependencies) {}

  readonly get: RequestHandler = async (_request, response) => {
    const detail = await this.dependencies.getSubscription.execute({
      organizationId: organizationIdOf(response),
    });
    sendData(response, toSubscriptionResponse(detail));
  };

  readonly extendTrial: RequestHandler = async (request, response) => {
    // validate() already parsed the body with the extend-trial schema.
    const body: PlatformExtendTrialBody = request.body;
    const detail = await this.dependencies.extendTrial.execute({
      actorUserId: requireCurrentUserId(),
      organizationId: organizationIdOf(response),
      days: body.days,
      reason: body.reason,
    });
    sendData(response, toSubscriptionResponse(detail));
  };

  readonly changePackage: RequestHandler = async (request, response) => {
    // validate() already parsed the body with the change-package schema.
    const body: PlatformChangePackageBody = request.body;
    const detail = await this.dependencies.changePackage.execute({
      actorUserId: requireCurrentUserId(),
      organizationId: organizationIdOf(response),
      basePackageId: body.basePackageId,
      addOnPackageIds: body.addOnPackageIds,
    });
    sendData(response, toSubscriptionResponse(detail));
  };
}
