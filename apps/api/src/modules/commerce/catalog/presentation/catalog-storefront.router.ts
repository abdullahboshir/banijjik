import { ERROR_CODE } from "@banijjik/contracts";
import {
  publicOfferingDetailQuerySchema,
  publicOfferingParamsSchema,
  publicOfferingsQuerySchema,
  type PublicOfferingDetailQueryInput,
  type PublicOfferingParamsInput,
  type PublicOfferingsQueryInput,
} from "@banijjik/validation";
import { Router, type RequestHandler } from "express";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { AppError, sendData, validate } from "../../../../kernel/http/index.js";
import type { GetPublicCategoriesUseCase } from "../application/use-cases/get-public-categories.use-case.js";
import type { GetPublicOfferingDetailUseCase } from "../application/use-cases/get-public-offering-detail.use-case.js";
import type { GetPublicOfferingsUseCase } from "../application/use-cases/get-public-offerings.use-case.js";

export interface CatalogStorefrontRouterDependencies {
  readonly requireCatalogModule: RequestHandler;
  readonly getOfferings: GetPublicOfferingsUseCase;
  readonly getOfferingDetail: GetPublicOfferingDetailUseCase;
  readonly getCategories: GetPublicCategoriesUseCase;
}

function notFound(): AppError {
  return new AppError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: "errors.storefront_not_available",
  });
}

function resolveOrgId(): string {
  const { organizationId } = getRequestContext();
  if (organizationId === undefined) {
    throw notFound();
  }
  return organizationId;
}

export function buildCatalogStorefrontRouter(
  dependencies: CatalogStorefrontRouterDependencies,
): Router {
  const router = Router();

  router.get(
    "/offerings",
    dependencies.requireCatalogModule,
    validate({ query: publicOfferingsQuerySchema }),
    async (request, response) => {
      const organizationId = resolveOrgId();
      const query = request.query as unknown as PublicOfferingsQueryInput;
      const result = await dependencies.getOfferings.execute({
        organizationId,
        query,
      });
      sendData(response, result);
    },
  );

  router.get(
    "/offerings/:offeringSlug",
    dependencies.requireCatalogModule,
    validate({
      params: publicOfferingParamsSchema,
      query: publicOfferingDetailQuerySchema,
    }),
    async (request, response) => {
      const organizationId = resolveOrgId();
      const params = request.params as unknown as PublicOfferingParamsInput;
      const query = request.query as unknown as PublicOfferingDetailQueryInput;
      const result = await dependencies.getOfferingDetail.execute({
        organizationId,
        slug: params.offeringSlug,
        locationId: query.locationId,
      });
      if (result === null) {
        throw notFound();
      }
      sendData(response, result);
    },
  );

  router.get("/categories", dependencies.requireCatalogModule, async (_request, response) => {
    const organizationId = resolveOrgId();
    const result = await dependencies.getCategories.execute({
      organizationId,
    });
    sendData(response, result);
  });

  return router;
}
