import { asId, type OrganizationId } from "@banijjik/ids";
import type { ChangeIndustryTemplateBody } from "@banijjik/validation";
import type { RequestHandler, Response } from "express";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type { ChangeIndustryTemplateUseCase } from "../../../core/organization/index.js";

function validatedOrganizationId(response: Response): string {
  // Safe: validate({ params: platformOrganizationParamsSchema }) produced this value.
  return (response.locals["validated"].params as { organizationId: string }).organizationId;
}

export class ChangeIndustryTemplateController {
  constructor(private readonly changeTemplate: ChangeIndustryTemplateUseCase) {}

  readonly change: RequestHandler = async (request, response) => {
    const body: ChangeIndustryTemplateBody = request.body;
    const result = await this.changeTemplate.execute({
      organizationId: asId<OrganizationId>(validatedOrganizationId(response)),
      actorUserId: requireCurrentUserId(),
      industryTemplateKey: body.industryTemplateKey,
      reason: body.reason,
    });
    sendData(response, result);
  };
}
