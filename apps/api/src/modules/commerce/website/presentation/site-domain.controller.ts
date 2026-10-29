import type {
  CreateSiteDomainBody,
  SelectCanonicalSiteDomainBody,
  VerifySiteDomainBody,
} from "@banijjik/validation/website";
import type { RequestHandler } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  ListSiteDomainsUseCase,
  RemoveSiteDomainUseCase,
  RequestSiteDomainUseCase,
  SelectCanonicalSiteDomainUseCase,
  VerifySiteDomainUseCase,
} from "../application/use-cases/site-domain.use-cases.js";

export interface SiteDomainControllerDependencies {
  readonly request: RequestSiteDomainUseCase;
  readonly verify: VerifySiteDomainUseCase;
  readonly remove: RemoveSiteDomainUseCase;
  readonly selectCanonical: SelectCanonicalSiteDomainUseCase;
  readonly list: ListSiteDomainsUseCase;
}

export class SiteDomainController {
  constructor(private readonly dependencies: SiteDomainControllerDependencies) {}

  readonly create: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const body = response.locals["validated"].body as CreateSiteDomainBody;
    sendData(
      response,
      await this.dependencies.request.execute({
        actorUserId: caller.actorUserId,
        hostname: body.hostname,
      }),
      { status: 202 },
    );
  };

  readonly verify: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const { siteDomainId } = response.locals["validated"].params as { siteDomainId: string };
    const body = response.locals["validated"].body as VerifySiteDomainBody;
    sendData(
      response,
      await this.dependencies.verify.execute({
        actorUserId: caller.actorUserId,
        siteDomainId,
        version: body.version,
      }),
    );
  };

  readonly remove: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const { siteDomainId } = response.locals["validated"].params as { siteDomainId: string };
    const query = response.locals["validated"].query as { version: number };
    sendData(
      response,
      await this.dependencies.remove.execute({
        actorUserId: caller.actorUserId,
        siteDomainId,
        version: query.version,
      }),
    );
  };

  readonly selectCanonical: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const { siteDomainId } = response.locals["validated"].params as { siteDomainId: string };
    const body = response.locals["validated"].body as SelectCanonicalSiteDomainBody;
    sendData(
      response,
      await this.dependencies.selectCanonical.execute({
        actorUserId: caller.actorUserId,
        siteDomainId,
        version: body.version,
        expectedSiteVersion: body.expectedSiteVersion,
      }),
    );
  };

  readonly list: RequestHandler = async (_request, response) => {
    const query = response.locals["validated"].query as { page: number; limit: number };
    sendData(response, await this.dependencies.list.execute(query));
  };
}
