import type { SitePageKey, SitePageUpsertRequest } from "@banijjik/contracts/website";
import type { RequestHandler } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  ListSitePagesUseCase,
  UpsertSitePageUseCase,
} from "../application/use-cases/site-page.use-cases.js";

export interface WebsiteControllerDependencies {
  readonly listPages: ListSitePagesUseCase;
  readonly upsertPage: UpsertSitePageUseCase;
}

export class WebsiteController {
  constructor(private readonly dependencies: WebsiteControllerDependencies) {}

  readonly listPages: RequestHandler = async (_request, response) => {
    sendData(response, await this.dependencies.listPages.execute());
  };

  readonly upsertPage: RequestHandler = async (_request, response) => {
    const { pageKey } = response.locals["validated"].params as { pageKey: SitePageKey };
    const body = response.locals["validated"].body as SitePageUpsertRequest;
    const caller = readTenantCaller();
    sendData(
      response,
      await this.dependencies.upsertPage.execute({
        organizationId: caller.organizationId,
        actorUserId: caller.actorUserId,
        pageKey,
        body,
      }),
    );
  };
}
