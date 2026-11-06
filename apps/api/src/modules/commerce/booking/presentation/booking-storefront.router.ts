import { ERROR_CODE } from "@banijjik/contracts";
import { asId, type OrganizationId } from "@banijjik/ids";
import { publicAvailabilityQuerySchema } from "@banijjik/validation/booking";
import { Router, type RequestHandler } from "express";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { AppError, sendData, validationFailed } from "../../../../kernel/http/index.js";
import type {
  GetPublicAvailabilityUseCase,
  PublicAvailabilityQuery,
} from "../application/use-cases/get-public-availability.use-case.js";

export interface BookingStorefrontRouterDependencies {
  readonly requireBookingModule: RequestHandler;
  readonly getPublicAvailability: GetPublicAvailabilityUseCase;
  readonly readPublicLocationIds: (organizationId: string) => Promise<readonly string[]>;
}

function notFound(): AppError {
  return new AppError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: "errors.storefront_not_available",
  });
}

function resolveOrgId(): string {
  const { organizationId } = getRequestContext();
  if (organizationId === undefined) throw notFound();
  return organizationId;
}

export function buildBookingStorefrontRouter(
  dependencies: BookingStorefrontRouterDependencies,
): Router {
  const router = Router();
  router.get("/availability", dependencies.requireBookingModule, async (request, response) => {
    const organizationId = resolveOrgId();
    const parsed = publicAvailabilityQuerySchema.safeParse({ ...request.query });
    if (!parsed.success) {
      throw validationFailed(
        parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          messageKey: "validation.custom",
        })),
      );
    }
    const query: PublicAvailabilityQuery = parsed.data;
    const publicLocationIds = await dependencies.readPublicLocationIds(organizationId);
    const result = await dependencies.getPublicAvailability.execute({
      organizationId: asId<OrganizationId>(organizationId),
      publicLocationIds,
      query,
    });
    sendData(response, result);
  });
  return router;
}
