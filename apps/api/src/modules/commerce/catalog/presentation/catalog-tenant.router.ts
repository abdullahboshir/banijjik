import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  categoryCreateRequestSchema,
  categoryIdParamsSchema,
  categoryListQuerySchema,
  categoryUpdateRequestSchema,
  modifierGroupCreateRequestSchema,
  modifierGroupIdParamsSchema,
  modifierGroupListQuerySchema,
  modifierGroupUpdateRequestSchema,
  offeringCreateRequestSchema,
  offeringIdParamsSchema,
  offeringListQuerySchema,
  offeringLocationClearQuerySchema,
  offeringLocationListQuerySchema,
  offeringLocationParamsSchema,
  offeringLocationRequestSchema,
  offeringUpdateRequestSchema,
  synonymsUpdateRequestSchema,
  versionedTransitionRequestSchema,
} from "@banijjik/validation";
import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { OfferingController } from "./offering.controller.js";
import type {
  CategoryController,
  ModifierGroupController,
  SynonymController,
} from "./record.controllers.js";

export interface CatalogRouterDependencies {
  readonly offerings: OfferingController;
  readonly categories: CategoryController;
  readonly modifierGroups: ModifierGroupController;
  readonly synonyms: SynonymController;
  readonly permission: PermissionMiddlewareFactory;
  /** The `Idempotency-Key` middleware, built once by routes/v1.ts (ADR-089). */
  readonly idempotency: RequestHandler;
}

function mountOfferings(router: Router, input: CatalogRouterDependencies): void {
  const { offerings: controller, permission, idempotency } = input;
  const params = offeringIdParamsSchema;
  const transition = versionedTransitionRequestSchema;
  router.get(
    "/offerings",
    permission(PERMISSION_KEY.CATALOG_OFFERING_READ),
    validate({ query: offeringListQuerySchema }),
    controller.list,
  );
  router.get(
    "/offerings/:offeringId",
    permission(PERMISSION_KEY.CATALOG_OFFERING_READ),
    validate({ params }),
    controller.get,
  );
  router.post(
    "/offerings",
    permission(PERMISSION_KEY.CATALOG_OFFERING_CREATE),
    validate({ body: offeringCreateRequestSchema }),
    idempotency,
    controller.create,
  );
  router.patch(
    "/offerings/:offeringId",
    permission(PERMISSION_KEY.CATALOG_OFFERING_UPDATE),
    validate({ params, body: offeringUpdateRequestSchema }),
    controller.update,
  );
  router.post(
    "/offerings/:offeringId/publish",
    permission(PERMISSION_KEY.CATALOG_OFFERING_PUBLISH),
    validate({ params, body: transition }),
    controller.publish,
  );
  router.post(
    "/offerings/:offeringId/archive",
    permission(PERMISSION_KEY.CATALOG_OFFERING_ARCHIVE),
    validate({ params, body: transition }),
    controller.archive,
  );
  router.get(
    "/offerings/:offeringId/locations",
    permission(PERMISSION_KEY.CATALOG_OFFERING_READ),
    validate({ params, query: offeringLocationListQuerySchema }),
    controller.listLocations,
  );
  router.put(
    "/offerings/:offeringId/locations/:locationId",
    permission(PERMISSION_KEY.CATALOG_OFFERING_UPDATE),
    validate({ params: offeringLocationParamsSchema, body: offeringLocationRequestSchema }),
    controller.setLocation,
  );
  router.delete(
    "/offerings/:offeringId/locations/:locationId",
    permission(PERMISSION_KEY.CATALOG_OFFERING_UPDATE),
    validate({ params: offeringLocationParamsSchema, query: offeringLocationClearQuerySchema }),
    controller.clearLocation,
  );
}

function mountCategories(router: Router, input: CatalogRouterDependencies): void {
  const { categories: controller, permission } = input;
  const params = categoryIdParamsSchema;
  router.get(
    "/categories",
    permission(PERMISSION_KEY.CATALOG_CATEGORY_READ),
    validate({ query: categoryListQuerySchema }),
    controller.list,
  );
  router.get(
    "/categories/:categoryId",
    permission(PERMISSION_KEY.CATALOG_CATEGORY_READ),
    validate({ params }),
    controller.get,
  );
  router.post(
    "/categories",
    permission(PERMISSION_KEY.CATALOG_CATEGORY_CREATE),
    validate({ body: categoryCreateRequestSchema }),
    controller.create,
  );
  router.patch(
    "/categories/:categoryId",
    permission(PERMISSION_KEY.CATALOG_CATEGORY_UPDATE),
    validate({ params, body: categoryUpdateRequestSchema }),
    controller.update,
  );
  router.post(
    "/categories/:categoryId/archive",
    permission(PERMISSION_KEY.CATALOG_CATEGORY_ARCHIVE),
    validate({ params, body: versionedTransitionRequestSchema }),
    controller.archive,
  );
}

function mountModifierGroups(router: Router, input: CatalogRouterDependencies): void {
  const { modifierGroups: controller, permission } = input;
  const params = modifierGroupIdParamsSchema;
  router.get(
    "/modifier-groups",
    permission(PERMISSION_KEY.CATALOG_MODIFIER_GROUP_READ),
    validate({ query: modifierGroupListQuerySchema }),
    controller.list,
  );
  router.get(
    "/modifier-groups/:modifierGroupId",
    permission(PERMISSION_KEY.CATALOG_MODIFIER_GROUP_READ),
    validate({ params }),
    controller.get,
  );
  router.post(
    "/modifier-groups",
    permission(PERMISSION_KEY.CATALOG_MODIFIER_GROUP_CREATE),
    validate({ body: modifierGroupCreateRequestSchema }),
    controller.create,
  );
  router.patch(
    "/modifier-groups/:modifierGroupId",
    permission(PERMISSION_KEY.CATALOG_MODIFIER_GROUP_UPDATE),
    validate({ params, body: modifierGroupUpdateRequestSchema }),
    controller.update,
  );
  router.post(
    "/modifier-groups/:modifierGroupId/archive",
    permission(PERMISSION_KEY.CATALOG_MODIFIER_GROUP_ARCHIVE),
    validate({ params, body: versionedTransitionRequestSchema }),
    controller.archive,
  );
}

/**
 * The catalog routes of `/orgs/{organizationId}` (14-API.md section 5.3), mounted behind the tenant
 * pipeline by routes/v1.ts. Each route names its permission; the entitlement gate has already
 * checked that the module is on. Offerings, categories and add-on groups belong to the
 * organization; only the per-location row is location-scoped.
 */
export function buildCatalogTenantRouter(input: CatalogRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  mountOfferings(router, input);
  mountCategories(router, input);
  mountModifierGroups(router, input);
  router.get(
    "/catalog/synonyms",
    input.permission(PERMISSION_KEY.CATALOG_OFFERING_READ),
    input.synonyms.get,
  );
  router.put(
    "/catalog/synonyms",
    input.permission(PERMISSION_KEY.CATALOG_SYNONYM_UPDATE),
    validate({ body: synonymsUpdateRequestSchema }),
    input.synonyms.update,
  );
  return router;
}
