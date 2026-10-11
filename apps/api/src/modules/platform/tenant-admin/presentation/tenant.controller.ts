import type { PlatformOrganizationListQuery, PlatformReasonBody } from "@banijjik/validation";
import type { RequestHandler, Response } from "express";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  GetTenantUseCase,
  ListTenantsUseCase,
  ReactivateTenantUseCase,
  SuspendTenantUseCase,
} from "../application/use-cases/tenant-admin.use-cases.js";
import { toDetailResponse, toSummaryResponse } from "./tenant.transformer.js";

export interface TenantControllerDependencies {
  readonly listTenants: ListTenantsUseCase;
  readonly getTenant: GetTenantUseCase;
  readonly suspendTenant: SuspendTenantUseCase;
  readonly reactivateTenant: ReactivateTenantUseCase;
}

function organizationIdOf(response: Response): string {
  // Safe: validate({ params: platformOrganizationParamsSchema }) produced this value on these routes.
  return (response.locals["validated"].params as { organizationId: string }).organizationId;
}

export class TenantController {
  constructor(private readonly dependencies: TenantControllerDependencies) {}

  readonly list: RequestHandler = async (_request, response) => {
    // Safe: validate({ query: platformOrganizationListQuerySchema }) produced this value on this route.
    const query = response.locals["validated"].query as PlatformOrganizationListQuery;
    const page = await this.dependencies.listTenants.execute({
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.q,
    });
    sendData(response, page.items.map(toSummaryResponse), {
      meta: { page: query.page, limit: query.limit, hasNext: page.hasNext },
    });
  };

  readonly get: RequestHandler = async (_request, response) => {
    const detail = await this.dependencies.getTenant.execute({
      organizationId: organizationIdOf(response),
    });
    sendData(response, toDetailResponse(detail));
  };

  readonly suspend: RequestHandler = async (request, response) => {
    // validate() already parsed the body with the reason schema.
    const body: PlatformReasonBody = request.body;
    const result = await this.dependencies.suspendTenant.execute({
      organizationId: organizationIdOf(response),
      actorUserId: requireCurrentUserId(),
      reason: body.reason,
    });
    sendData(response, { organizationId: organizationIdOf(response), ...result });
  };

  readonly reactivate: RequestHandler = async (request, response) => {
    // validate() already parsed the body with the reason schema.
    const body: PlatformReasonBody = request.body;
    const result = await this.dependencies.reactivateTenant.execute({
      organizationId: organizationIdOf(response),
      actorUserId: requireCurrentUserId(),
      reason: body.reason,
    });
    sendData(response, { organizationId: organizationIdOf(response), ...result });
  };
}
