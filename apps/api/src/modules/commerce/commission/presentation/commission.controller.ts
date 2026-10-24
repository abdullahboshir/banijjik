import { asId, type CommissionPayoutId, type CommissionRuleId } from "@banijjik/ids";
import type {
  CommissionPayoutCreateBody,
  CommissionPayoutListQuery,
  CommissionPayoutPreviewQuery,
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
  CreateCommissionPayoutUseCase,
  GetCommissionPayoutUseCase,
  ListCommissionPayoutsUseCase,
  PreviewCommissionPayoutUseCase,
} from "../application/use-cases/payout.use-cases.js";
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
  readonly previewPayout: PreviewCommissionPayoutUseCase;
  readonly createPayout: CreateCommissionPayoutUseCase;
  readonly listPayouts: ListCommissionPayoutsUseCase;
  readonly getPayout: GetCommissionPayoutUseCase;
}

function readRuleId(request: Request): CommissionRuleId {
  return asId<CommissionRuleId>(String(request.params["commissionRuleId"]));
}

function readPayoutId(request: Request): CommissionPayoutId {
  return asId<CommissionPayoutId>(String(request.params["commissionPayoutId"]));
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
    const query: CommissionRuleListQuery = response.locals["validated"].query;
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
    const query: CommissionEntryListQuery = response.locals["validated"].query;
    const { allowedLocationIds } = readTenantCaller();
    const result = await this.dependencies.listEntries.execute({ query, allowedLocationIds });
    sendData(response, result.items, {
      meta: { page: query.page, limit: query.limit, hasNext: result.hasNext },
    });
  };

  readonly listMyEntries: RequestHandler = async (_request, response) => {
    const query: CommissionMyEntriesQuery = response.locals["validated"].query;
    const result = await this.dependencies.listMyEntries.execute({
      memberId: readCallerMemberId(),
      query,
    });
    sendData(response, result.items, {
      meta: { page: query.page, limit: query.limit, hasNext: result.hasNext },
    });
  };

  readonly summary: RequestHandler = async (_request, response) => {
    const query: CommissionSummaryQuery = response.locals["validated"].query;
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

  readonly previewPayout: RequestHandler = async (_request, response) => {
    const query: CommissionPayoutPreviewQuery = response.locals["validated"].query;
    const { organizationId, allowedLocationIds } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.previewPayout.execute({ organizationId, query, allowedLocationIds }),
    );
  };

  readonly createPayout: RequestHandler = async (request, response) => {
    const body: CommissionPayoutCreateBody = request.body;
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    const created = await this.dependencies.createPayout.execute({
      organizationId,
      actorUserId,
      allowedLocationIds,
      body,
    });
    sendData(response, created, { status: HTTP_CREATED });
  };

  readonly listPayouts: RequestHandler = async (_request, response) => {
    const query: CommissionPayoutListQuery = response.locals["validated"].query;
    const { allowedLocationIds } = readTenantCaller();
    const result = await this.dependencies.listPayouts.execute({ query, allowedLocationIds });
    sendData(response, result.items, {
      meta: { page: query.page, limit: query.limit, hasNext: result.hasNext },
    });
  };

  readonly getPayout: RequestHandler = async (request, response) => {
    sendData(response, await this.dependencies.getPayout.execute(readPayoutId(request)));
  };
}
