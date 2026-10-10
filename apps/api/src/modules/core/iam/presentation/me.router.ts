import { meUpdateRequestSchema } from "@banijjik/validation";
import { Router } from "express";
import { validate } from "../../../../kernel/http/index.js";
import type { MeController } from "./me.controller.js";
import { translateDomainErrors } from "./translate-domain-errors.js";

/** Routes of the signed-in user, mounted at /me behind authenticate() by routes/v1.ts. */
export function buildMeRouter(controller: MeController): Router {
  const router = Router();
  router.get("/", translateDomainErrors(controller.get));
  router.patch(
    "/",
    validate({ body: meUpdateRequestSchema }),
    translateDomainErrors(controller.update),
  );
  return router;
}
