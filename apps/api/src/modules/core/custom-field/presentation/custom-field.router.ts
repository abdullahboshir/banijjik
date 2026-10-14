import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  customFieldArchiveRequestSchema,
  customFieldDefinitionCreateRequestSchema,
  customFieldDefinitionParamsSchema,
  customFieldDefinitionUpdateRequestSchema,
  customFieldListQuerySchema,
  customFieldPreferenceBatchRequestSchema,
} from "@banijjik/validation";
import { Router } from "express";
import {
  requireAllLocations,
  type PermissionMiddlewareFactory,
} from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { CustomFieldController } from "./custom-field.controller.js";

/**
 * Custom field endpoints (14-API.md). Writes need the permission at every location:
 * a field belongs to the organization, not to one location (ADR-102).
 */
export function buildCustomFieldRouter(
  controller: CustomFieldController,
  permission: PermissionMiddlewareFactory,
): Router {
  const router = Router({ mergeParams: true });
  router.get(
    "/custom-fields",
    permission(PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_READ),
    validate({ query: customFieldListQuerySchema }),
    controller.list,
  );
  router.post(
    "/custom-fields",
    permission(PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_CREATE),
    requireAllLocations(),
    validate({ body: customFieldDefinitionCreateRequestSchema }),
    controller.create,
  );
  router.patch(
    "/custom-fields/preferences",
    permission(PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_UPDATE),
    requireAllLocations(),
    validate({ body: customFieldPreferenceBatchRequestSchema }),
    controller.preferences,
  );
  router.patch(
    "/custom-fields/:customFieldDefinitionId",
    permission(PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_UPDATE),
    requireAllLocations(),
    validate({
      params: customFieldDefinitionParamsSchema,
      body: customFieldDefinitionUpdateRequestSchema,
    }),
    controller.update,
  );
  router.post(
    "/custom-fields/:customFieldDefinitionId/archive",
    permission(PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_ARCHIVE),
    requireAllLocations(),
    validate({ params: customFieldDefinitionParamsSchema, body: customFieldArchiveRequestSchema }),
    controller.archive,
  );
  return router;
}
