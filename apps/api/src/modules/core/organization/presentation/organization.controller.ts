import type { OrganizationCreateBody } from "@banijjik/validation";
import type { RequestHandler } from "express";
import { sendData } from "../../../../kernel/http/index.js";
import type { CreateOrganizationUseCase } from "../application/use-cases/create-organization.use-case.js";
import type { MyOrganizationsReader } from "../application/use-cases/list-my-organizations.use-case.js";
import { toMyOrganizationSummary } from "./my-organization.transformer.js";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";

export interface OrganizationControllerDependencies {
  readonly createOrganization: CreateOrganizationUseCase;
  readonly listMyOrganizations: MyOrganizationsReader;
}

const HTTP_CREATED = 201;

export class OrganizationController {
  constructor(private readonly dependencies: OrganizationControllerDependencies) {}

  readonly create: RequestHandler = async (request, response) => {
    // validate() already parsed the body with the organization-create schema.
    const body: OrganizationCreateBody = request.body;
    const created = await this.dependencies.createOrganization.execute({
      actorUserId: requireCurrentUserId(),
      name: body.name,
      slug: body.slug,
      industryTemplateKey: body.industryTemplateKey,
      district: body.district,
    });
    sendData(response, toMyOrganizationSummary(created), { status: HTTP_CREATED });
  };

  readonly list: RequestHandler = async (_request, response) => {
    const organizations = await this.dependencies.listMyOrganizations.execute({
      userId: requireCurrentUserId(),
    });
    sendData(response, organizations.map(toMyOrganizationSummary));
  };
}
