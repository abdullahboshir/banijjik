import { Router, type RequestHandler } from "express";
import {
  requireCurrentUserId,
  requirePlatformOperatorId,
  requirePlatformRoles,
} from "../../../../kernel/auth/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type { GetMeUseCase } from "../application/use-cases/get-me.use-case.js";
import { toPlatformSessionResponse } from "./platform-session.transformer.js";

/**
 * `GET /platform/me`: the signed-in operator, so the panel can draw itself after a reload.
 * Mounted behind `authenticatePlatform`, which put the operator and its roles into the context.
 */
export function buildPlatformMeRouter(getMe: GetMeUseCase): Router {
  const get: RequestHandler = async (_request, response) => {
    const user = await getMe.execute({ userId: requireCurrentUserId() });
    sendData(
      response,
      toPlatformSessionResponse(user, {
        platformOperatorId: requirePlatformOperatorId(),
        platformRoles: requirePlatformRoles(),
      }),
    );
  };
  const router = Router();
  router.get("/me", get);
  return router;
}
