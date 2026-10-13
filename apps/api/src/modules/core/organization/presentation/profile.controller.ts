import type { ProfileUpdateBody } from "@banijjik/validation";
import type { RequestHandler } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type { GetProfileUseCase } from "../application/use-cases/get-profile.use-case.js";
import type { UpdateProfileUseCase } from "../application/use-cases/update-profile.use-case.js";
import { toProfileResponse } from "./profile.transformer.js";

export interface ProfileControllerDependencies {
  readonly getProfile: GetProfileUseCase;
  readonly updateProfile: UpdateProfileUseCase;
}

/** Business profile endpoints (14-API.md section 5.1). */
export class ProfileController {
  constructor(private readonly dependencies: ProfileControllerDependencies) {}

  readonly getProfile: RequestHandler = async (_request, response) => {
    const { organizationId } = readTenantCaller();
    const organization = await this.dependencies.getProfile.execute({ organizationId });
    sendData(response, toProfileResponse(organization));
  };

  readonly updateProfile: RequestHandler = async (request, response) => {
    // validate() already parsed the body with the profile-update schema.
    const body: ProfileUpdateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const organization = await this.dependencies.updateProfile.execute({
      organizationId,
      actorUserId,
      version: body.version,
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.defaultLocale === undefined ? {} : { defaultLocale: body.defaultLocale }),
      ...(body.profile === undefined ? {} : { profile: body.profile }),
    });
    sendData(response, toProfileResponse(organization));
  };
}
