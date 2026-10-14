import { Router } from "express";
import type { PublishedIndustryTemplateController } from "./published-industry-template.controller.js";

/** `GET /industry-templates`, mounted with the user routes (`/me`, `/me/orgs`) by routes/v1.ts. */
export function buildPublishedIndustryTemplateRouter(
  controller: PublishedIndustryTemplateController,
): Router {
  const router = Router();
  router.get("/", controller.list);
  return router;
}
