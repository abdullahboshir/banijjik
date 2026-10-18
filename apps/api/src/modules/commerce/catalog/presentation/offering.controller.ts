import { asId, type OfferingId } from "@banijjik/ids";
import type {
  OfferingCreateBody,
  OfferingListQuery,
  OfferingLocationBody,
  OfferingLocationListQuery,
  OfferingUpdateBody,
  VersionedTransitionBody,
} from "@banijjik/validation";
import type { Request, RequestHandler, Response } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type { CreateOfferingUseCase } from "../application/use-cases/create-offering.use-case.js";
import type { GetOfferingUseCase } from "../application/use-cases/get-offering.use-case.js";
import type { ListOfferingsUseCase } from "../application/use-cases/list-offerings.use-case.js";
import type {
  ClearOfferingLocationUseCase,
  ListOfferingLocationsUseCase,
  SetOfferingLocationUseCase,
} from "../application/use-cases/offering-location.use-cases.js";
import type {
  ArchiveOfferingUseCase,
  PublishOfferingUseCase,
} from "../application/use-cases/offering-transitions.use-cases.js";
import type { UpdateOfferingUseCase } from "../application/use-cases/update-offering.use-case.js";

const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;

export interface OfferingControllerDependencies {
  readonly listOfferings: ListOfferingsUseCase;
  readonly getOffering: GetOfferingUseCase;
  readonly createOffering: CreateOfferingUseCase;
  readonly updateOffering: UpdateOfferingUseCase;
  readonly publishOffering: PublishOfferingUseCase;
  readonly archiveOffering: ArchiveOfferingUseCase;
  readonly listLocations: ListOfferingLocationsUseCase;
  readonly setLocation: SetOfferingLocationUseCase;
  readonly clearLocation: ClearOfferingLocationUseCase;
}

function readOfferingId(request: Request): OfferingId {
  // validate() already parsed the path parameter with the offering-id schema.
  return asId<OfferingId>(String(request.params["offeringId"]));
}

function readLocationId(request: Request): string {
  return String(request.params["locationId"]);
}

function readQuery<Query>(response: Response): Query {
  // Safe: validate({ query }) produced this value on the routes that call it.
  return response.locals["validated"].query as Query;
}

/** Offering endpoints (14-API.md section 5.3). */
export class OfferingController {
  constructor(private readonly dependencies: OfferingControllerDependencies) {}

  readonly list: RequestHandler = async (_request, response) => {
    const { page, limit, ...filters } = readQuery<OfferingListQuery>(response);
    const result = await this.dependencies.listOfferings.execute({ page, limit, ...filters });
    sendData(response, result.items, { meta: { page, limit, hasNext: result.hasNext } });
  };

  readonly get: RequestHandler = async (request, response) => {
    const { organizationId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.getOffering.execute({
        organizationId,
        offeringId: readOfferingId(request),
      }),
    );
  };

  readonly create: RequestHandler = async (request, response) => {
    const body: OfferingCreateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const created = await this.dependencies.createOffering.execute({
      organizationId,
      actorUserId,
      ...body,
    });
    sendData(response, created, { status: HTTP_CREATED });
  };

  readonly update: RequestHandler = async (request, response) => {
    const body: OfferingUpdateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.updateOffering.execute({
        organizationId,
        actorUserId,
        offeringId: readOfferingId(request),
        ...body,
      }),
    );
  };

  readonly publish: RequestHandler = async (request, response) => {
    sendData(response, await this.dependencies.publishOffering.execute(this.transition(request)));
  };

  readonly archive: RequestHandler = async (request, response) => {
    sendData(response, await this.dependencies.archiveOffering.execute(this.transition(request)));
  };

  readonly listLocations: RequestHandler = async (request, response) => {
    const { page, limit, locationId } = readQuery<OfferingLocationListQuery>(response);
    const { allowedLocationIds } = readTenantCaller();
    const result = await this.dependencies.listLocations.execute({
      offeringId: readOfferingId(request),
      page,
      limit,
      allowedLocationIds,
      ...(locationId === undefined ? {} : { locationId }),
    });
    sendData(response, result.items, { meta: { page, limit, hasNext: result.hasNext } });
  };

  readonly setLocation: RequestHandler = async (request, response) => {
    const body: OfferingLocationBody = request.body;
    const caller = readTenantCaller();
    sendData(
      response,
      await this.dependencies.setLocation.execute({
        ...caller,
        offeringId: readOfferingId(request),
        locationId: readLocationId(request),
        ...body,
      }),
    );
  };

  readonly clearLocation: RequestHandler = async (request, response) => {
    const { variantId } = readQuery<{ variantId?: string }>(response);
    const caller = readTenantCaller();
    await this.dependencies.clearLocation.execute({
      ...caller,
      offeringId: readOfferingId(request),
      locationId: readLocationId(request),
      ...(variantId === undefined ? {} : { variantId }),
    });
    response.status(HTTP_NO_CONTENT).end();
  };

  private transition(request: Request) {
    const body: VersionedTransitionBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    return {
      organizationId,
      actorUserId,
      offeringId: readOfferingId(request),
      version: body.version,
    };
  }
}
