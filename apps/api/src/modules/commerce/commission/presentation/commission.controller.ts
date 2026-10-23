import { asId, type CommissionRuleId } from "@banijjik/ids";
import type {
  CommissionEntryListQuery,
  CommissionMyEntriesQuery,
  CommissionRuleArchiveBody,
  CommissionRuleCreateBody,
  CommissionRuleListQuery,
  CommissionRuleUpdateBody,
  CommissionSummaryQuery,
} from "@banijjik/validation/commission";
import type { Request, RequestHandler } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { forbidden, sendData } from "../../../../kernel/http/index.js";
import type {
  GetCommissionSummaryUseCase,
  ListCommissionEntriesUseCase,
  ListMyCommissionEntriesUseCase,
} from "../application/use-cases/entry.use-cases.js";
import type {
  ArchiveCommissionRuleUseCase,
  CreateCommissionRuleUseCase,
  ListCommissionRulesUseCase,
  UpdateCommissionRuleUseCase,
} from "../application/use-cases/rule.use-cases.js";

const HTTP_CREATED = 201;

export interface CommissionControllerDependencies {
  readonly listRules: ListCommissionRulesUseCase;
  readonly createRule: CreateCommissionRuleUseCase;
  readonly updateRule: UpdateCommissionRuleUseCase;
  readonly archiveRule: ArchiveCommissionRuleUseCase;
  readonly listEntries: ListCommissionEntriesUseCase;
  readonly listMyEntries: ListMyCommissionEntriesUseCase;
  readonly summary: GetCommissionSummaryUseCase;
}

function readRuleId(request: Request): CommissionRuleId {
  return asId<CommissionRuleId>(String(request.params["commissionRuleId"]));
}

/** The member of the signed-in session; a session without one cannot own commission. */
function readCallerMemberId(): string {
  const { memberId } = getRequestContext();
  if (memberId === undefined) throw forbidden();
  return memberId;
}

export class CommissionController {
  constructor(private readonly dependencies: CommissionControllerDependencies) {}

  readonly listRules: RequestHandler = async (_request, response) => {
    const query = response.locals["validated"].query as CommissionRuleListQuery;
    const result = await this.dependencies.listRules.execute(query);
    sendData(response, result.items, {
      meta: { page: query.page, limit: query.limit, hasNext: result.hasNext },
    });
  };

  readonly createRule: RequestHandler = async (request, response) => {
    const body: CommissionRuleCreateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const created = await this.dependencies.createRule.execute({
      organizationId,
      actorUserId,
      body,
    });
    sendData(response, created, { status: HTTP_CREATED });
  };

  readonly updateRule: RequestHandler = async (request, response) => {
    const body: CommissionRuleUpdateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.updateRule.execute({
        organizationId,
        actorUserId,
        commissionRuleId: readRuleId(request),
        body,
      }),
    );
  };

  readonly archiveRule: RequestHandler = async (request, response) => {
    const body: CommissionRuleArchiveBody = request.body;
    const { actorUserId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.archiveRule.execute({
        actorUserId,
        commissionRuleId: readRuleId(request),
        version: body.version,
      }),
    );
  };

  readonly listEntries: RequestHandler = async (_request, response) => {
    const query = response.locals["validated"].query as CommissionEntryListQuery;
    const { allowedLocationIds } = readTenantCaller();
    const result = await this.dependencies.listEntries.execute({ query, allowedLocationIds });
    sendData(response, result.items, {
      meta: { page: query.page, limit: query.limit, hasNext: result.hasNext },
    });
  };

  readonly listMyEntries: RequestHandler = async (_request, response) => {
    const query = response.locals["validated"].query as CommissionMyEntriesQuery;
    const result = await this.dependencies.listMyEntries.execute({
      memberId: readCallerMemberId(),
      query,
    });
    sendData(response, result.items, {
      meta: { page: query.page, limit: query.limit, hasNext: result.hasNext },
    });
  };

  readonly summary: RequestHandler = async (_request, response) => {
    const query = response.locals["validated"].query as CommissionSummaryQuery;
    const { organizationId, allowedLocationIds } = readTenantCaller();
    const result = await this.dependencies.summary.execute({
      organizationId,
      query,
      allowedLocationIds,
    });
    sendData(response, result.items, {
      meta: { page: query.page, limit: query.limit, hasNext: result.hasNext },
    });
  };
}
