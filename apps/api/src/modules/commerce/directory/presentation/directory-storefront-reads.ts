import { asId, type OrganizationId } from "@banijjik/ids";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type { Router, RequestHandler } from "express";
import type {
  GetStorefrontDirectoryFormUseCase,
  GetStorefrontDirectoryStatsUseCase,
} from "../application/use-cases/storefront-directory-reads.use-cases.js";

/** Public form definition and home statistics are cacheable for a minute (M.6a decisions 3 and 5). */
const READ_CACHE_CONTROL = "public, max-age=60";

export interface DirectoryReadsDependencies {
  readonly requireDirectoryModule: RequestHandler;
  readonly getForm: GetStorefrontDirectoryFormUseCase;
  readonly getStats: GetStorefrontDirectoryStatsUseCase;
}

function organizationIdOf(): OrganizationId {
  return asId<OrganizationId>(String(getRequestContext().organizationId));
}

/** `GET /directory/form` and `GET /directory/stats`: answer 404 while the directory module is off. */
export function mountDirectoryReads(router: Router, input: DirectoryReadsDependencies): void {
  router.get("/directory/form", input.requireDirectoryModule, async (_request, response) => {
    response.set("Cache-Control", READ_CACHE_CONTROL);
    sendData(response, await input.getForm.execute(organizationIdOf()));
  });
  router.get("/directory/stats", input.requireDirectoryModule, async (_request, response) => {
    response.set("Cache-Control", READ_CACHE_CONTROL);
    sendData(response, await input.getStats.execute(organizationIdOf()));
  });
}
