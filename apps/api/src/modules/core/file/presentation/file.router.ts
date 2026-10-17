import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  fileContentQuerySchema,
  fileIdParamsSchema,
  publicFileParamsSchema,
} from "@banijjik/validation";
import { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { FileController } from "./file.controller.js";

/**
 * File endpoints behind the tenant pipeline (14-API.md). The upload route has no body parser of
 * its own to mount: the multipart stream is read by the controller (ADR-109).
 */
export function buildFileRouter(
  controller: FileController,
  permission: PermissionMiddlewareFactory,
): Router {
  const router = Router({ mergeParams: true });
  router.post("/files", permission(PERMISSION_KEY.FILE_ASSET_CREATE), controller.upload);
  router.get(
    "/files/:fileId",
    permission(PERMISSION_KEY.FILE_ASSET_READ),
    validate({ params: fileIdParamsSchema }),
    controller.get,
  );
  router.get(
    "/files/:fileId/content",
    permission(PERMISSION_KEY.FILE_ASSET_READ),
    validate({ params: fileIdParamsSchema, query: fileContentQuerySchema }),
    controller.content,
  );
  router.delete(
    "/files/:fileId",
    permission(PERMISSION_KEY.FILE_ASSET_DELETE),
    validate({ params: fileIdParamsSchema }),
    controller.remove,
  );
  return router;
}

/** Mounted outside the tenant pipeline: no session, no organization in the path. PUBLIC files only. */
export function buildPublicFileRouter(controller: FileController): Router {
  const router = Router();
  router.get(
    "/files/:fileId/:variant",
    validate({ params: publicFileParamsSchema }),
    controller.publicContent,
  );
  return router;
}
