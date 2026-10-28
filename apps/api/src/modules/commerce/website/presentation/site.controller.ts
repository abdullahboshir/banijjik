import type {
  PublishSiteRequest,
  SaveSiteDraftRequest,
  SiteLayoutPageRequest,
  SiteThemeUpdateRequest,
} from "@banijjik/contracts/website";
import type { RequestHandler } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type { SiteSectionAvailability } from "../application/ports/site-publication-ports.js";
import type {
  GetSiteDraftUseCase,
  ListSiteVersionsUseCase,
} from "../application/use-cases/read-site.use-case.js";
import type {
  PublishSiteUseCase,
  UnpublishSiteUseCase,
} from "../application/use-cases/publish-site.use-case.js";
import type { RestoreSiteUseCase } from "../application/use-cases/restore-site.use-case.js";
import type { SaveSiteDraftUseCase } from "../application/use-cases/save-site.use-case.js";
import type {
  CreateSiteLayoutPageUseCase,
  ListSiteLayoutPagesUseCase,
  UpdateSiteLayoutPageUseCase,
  UpdateSiteThemeUseCase,
} from "../application/use-cases/site-layout.use-case.js";

export interface SiteControllerDependencies {
  readonly getDraft: GetSiteDraftUseCase;
  readonly saveDraft: SaveSiteDraftUseCase;
  readonly listPages: ListSiteLayoutPagesUseCase;
  readonly updateTheme: UpdateSiteThemeUseCase;
  readonly createPage: CreateSiteLayoutPageUseCase;
  readonly updatePage: UpdateSiteLayoutPageUseCase;
  readonly publish: PublishSiteUseCase;
  readonly unpublish: UnpublishSiteUseCase;
  readonly listVersions: ListSiteVersionsUseCase;
  readonly restore: RestoreSiteUseCase;
  /**
   * `PATCH /site` is the one command whose body already is the whole document, so the controller
   * reads the effective sections for it; every part endpoint asks the same port inside its use case.
   */
  readonly sections: SiteSectionAvailability;
}

/** The tenant API of card 4.1: the document, its parts, its publication and its history. */
export class SiteController {
  constructor(private readonly dependencies: SiteControllerDependencies) {}

  readonly readDraft: RequestHandler = async (_request, response) => {
    sendData(response, await this.dependencies.getDraft.execute());
  };

  readonly saveDraft: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const body = response.locals["validated"].body as SaveSiteDraftRequest;
    sendData(
      response,
      await this.dependencies.saveDraft.execute({
        actorUserId: caller.actorUserId,
        body,
        effectiveSectionKeys: await this.dependencies.sections.effectiveSectionKeys(),
      }),
    );
  };

  readonly readPages: RequestHandler = async (_request, response) => {
    sendData(response, await this.dependencies.listPages.execute());
  };

  readonly updateTheme: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const body = response.locals["validated"].body as SiteThemeUpdateRequest;
    sendData(
      response,
      await this.dependencies.updateTheme.execute({ actorUserId: caller.actorUserId, body }),
    );
  };

  readonly createPage: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const body = response.locals["validated"].body as SiteLayoutPageRequest;
    sendData(
      response,
      await this.dependencies.createPage.execute({ actorUserId: caller.actorUserId, body }),
      { status: 201 },
    );
  };

  readonly updatePage: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const { pageId } = response.locals["validated"].params as { pageId: string };
    const body = response.locals["validated"].body as SiteLayoutPageRequest;
    sendData(
      response,
      await this.dependencies.updatePage.execute({
        actorUserId: caller.actorUserId,
        pageId,
        body,
      }),
    );
  };

  readonly publish: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const body = response.locals["validated"].body as PublishSiteRequest;
    sendData(
      response,
      await this.dependencies.publish.execute({ actorUserId: caller.actorUserId, body }),
    );
  };

  readonly unpublish: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const body = response.locals["validated"].body as PublishSiteRequest;
    sendData(
      response,
      await this.dependencies.unpublish.execute({ actorUserId: caller.actorUserId, body }),
    );
  };

  readonly readVersions: RequestHandler = async (_request, response) => {
    const query = response.locals["validated"].query as { page: number; limit: number };
    sendData(response, await this.dependencies.listVersions.execute(query));
  };

  /** The snapshot is named in the path, so the body cannot point at a different version. */
  readonly restore: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const { websiteVersionId } = response.locals["validated"].params as {
      websiteVersionId: string;
    };
    const { expectedVersion } = response.locals["validated"].body as { expectedVersion: number };
    sendData(
      response,
      await this.dependencies.restore.execute({
        actorUserId: caller.actorUserId,
        body: { expectedVersion, websiteVersionId },
      }),
    );
  };
}
