import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  creditAccountIdParamsSchema,
  creditAdjustRequestSchema,
  creditEntriesQuerySchema,
  creditPackArchiveRequestSchema,
  creditPackCreateRequestSchema,
  creditPackIdParamsSchema,
  creditPackUpdateRequestSchema,
  creditPacksQuerySchema,
  creditPurchaseIdParamsSchema,
  creditPurchaseRejectRequestSchema,
  creditPurchasesStaffQuerySchema,
  creditPurchaseVerifyRequestSchema,
} from "@banijjik/validation/credit";
import type { CreditPackCreateRequest, CreditPackUpdateRequest } from "@banijjik/contracts/credit";
import { Router, type RequestHandler } from "express";
import { asId, type CreditPurchaseId, type CustomerAccountId, type UserId } from "@banijjik/ids";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";
import { sendData, validate } from "../../../../kernel/http/index.js";
import type {
  AdjustCreditsUseCase,
  ArchiveCreditPackUseCase,
  CreateCreditPackUseCase,
  GetCreditPurchaseStaffUseCase,
  GetMyCreditsUseCase,
  ListCreditPacksUseCase,
  ListCreditPurchasesStaffUseCase,
  RejectCreditPurchaseUseCase,
  UpdateCreditPackUseCase,
  VerifyCreditPurchaseUseCase,
} from "../application/index.js";

const HTTP_CREATED = 201;

export interface CreditTenantRouterDependencies {
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
  readonly adjustCredits: AdjustCreditsUseCase;
  readonly getAccount: GetMyCreditsUseCase;
  readonly listPacks: ListCreditPacksUseCase;
  readonly createPack: CreateCreditPackUseCase;
  readonly updatePack: UpdateCreditPackUseCase;
  readonly archivePack: ArchiveCreditPackUseCase;
  readonly listPurchases: ListCreditPurchasesStaffUseCase;
  readonly getPurchase: GetCreditPurchaseStaffUseCase;
  readonly verifyPurchase: VerifyCreditPurchaseUseCase;
  readonly rejectPurchase: RejectCreditPurchaseUseCase;
  /** OWNER members adjust without an approval token (M.4 decision 6). */
  readonly isOwner: (userId: UserId) => Promise<boolean>;
}

interface PageQuery {
  readonly page: number;
  readonly limit: number;
}

function offsetOf(query: PageQuery): { limit: number; offset: number; page: number } {
  return { limit: query.limit, offset: (query.page - 1) * query.limit, page: query.page };
}

function customerAccountIdOf(validated: unknown): CustomerAccountId {
  return asId<CustomerAccountId>((validated as { customerAccountId: string }).customerAccountId);
}

function creditPackIdOf(validated: unknown): string {
  return (validated as { creditPackId: string }).creditPackId;
}

export function buildCreditTenantRouter(input: CreditTenantRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  mountPackRoutes(router, input);
  mountAccountRoutes(router, input);
  mountPurchaseRoutes(router, input);
  return router;
}

function mountPackRoutes(router: Router, input: CreditTenantRouterDependencies): void {
  const read = input.permission(PERMISSION_KEY.CREDIT_PACK_READ);
  const write = input.permission(PERMISSION_KEY.CREDIT_PACK_UPDATE);

  router.get(
    "/credit/packs",
    read,
    validate({ query: creditPacksQuerySchema }),
    async (_request, response) => {
      const query = response.locals["validated"].query as PageQuery;
      sendData(response, await input.listPacks.execute(offsetOf(query)));
    },
  );

  router.post(
    "/credit/packs",
    write,
    input.idempotency,
    validate({ body: creditPackCreateRequestSchema }),
    async (_request, response) => {
      const body = response.locals["validated"].body as CreditPackCreateRequest;
      sendData(response, await input.createPack.execute(body, requireCurrentUserId()), {
        status: HTTP_CREATED,
      });
    },
  );

  router.patch(
    "/credit/packs/:creditPackId",
    write,
    validate({ params: creditPackIdParamsSchema, body: creditPackUpdateRequestSchema }),
    async (_request, response) => {
      const body = response.locals["validated"].body as CreditPackUpdateRequest;
      sendData(
        response,
        await input.updatePack.execute(
          creditPackIdOf(response.locals["validated"].params),
          body,
          requireCurrentUserId(),
        ),
      );
    },
  );

  router.post(
    "/credit/packs/:creditPackId/archive",
    write,
    input.idempotency,
    validate({ params: creditPackIdParamsSchema, body: creditPackArchiveRequestSchema }),
    async (_request, response) => {
      const body = response.locals["validated"].body as { version: number };
      sendData(
        response,
        await input.archivePack.execute(
          creditPackIdOf(response.locals["validated"].params),
          body.version,
          requireCurrentUserId(),
        ),
      );
    },
  );
}

function mountAccountRoutes(router: Router, input: CreditTenantRouterDependencies): void {
  const read = input.permission(PERMISSION_KEY.CREDIT_ACCOUNT_READ);
  const adjust = input.permission(PERMISSION_KEY.CREDIT_ACCOUNT_ADJUST);

  router.get(
    "/credit/accounts/:customerAccountId",
    read,
    validate({ params: creditAccountIdParamsSchema, query: creditEntriesQuerySchema }),
    async (_request, response) => {
      const query = response.locals["validated"].query as PageQuery;
      sendData(
        response,
        await input.getAccount.execute(
          customerAccountIdOf(response.locals["validated"].params),
          offsetOf(query),
        ),
      );
    },
  );

  router.post(
    "/credit/accounts/:customerAccountId/adjust",
    adjust,
    input.idempotency,
    validate({ params: creditAccountIdParamsSchema, body: creditAdjustRequestSchema }),
    async (_request, response) => {
      const body = response.locals["validated"].body as {
        credits: number;
        reason: string;
        approvalToken?: string;
      };
      const actorUserId = requireCurrentUserId();
      sendData(
        response,
        await input.adjustCredits.execute({
          customerAccountId: customerAccountIdOf(response.locals["validated"].params),
          credits: body.credits,
          reason: body.reason,
          actorUserId,
          isOwner: await input.isOwner(actorUserId),
          ...(body.approvalToken === undefined ? {} : { approvalToken: body.approvalToken }),
        }),
      );
    },
  );
}

function mountPurchaseReadRoutes(router: Router, input: CreditTenantRouterDependencies): void {
  const read = input.permission(PERMISSION_KEY.CREDIT_PURCHASE_READ);

  router.get(
    "/credit/purchases",
    read,
    validate({ query: creditPurchasesStaffQuerySchema }),
    async (_request, response) => {
      const query = response.locals["validated"].query as {
        page: number;
        limit: number;
        status?: import("@banijjik/contracts/credit").CreditPurchaseStatus;
        q?: string;
      };
      sendData(
        response,
        await input.listPurchases.execute({
          status: query.status,
          q: query.q,
          offset: (query.page - 1) * query.limit,
          limit: query.limit,
        }),
      );
    },
  );

  router.get(
    "/credit/purchases/:creditPurchaseId",
    read,
    validate({ params: creditPurchaseIdParamsSchema }),
    async (_request, response) => {
      const params = response.locals["validated"].params as { creditPurchaseId: string };
      sendData(
        response,
        await input.getPurchase.execute(asId<CreditPurchaseId>(params.creditPurchaseId)),
      );
    },
  );
}

function mountPurchaseActionRoutes(router: Router, input: CreditTenantRouterDependencies): void {
  const verify = input.permission(PERMISSION_KEY.CREDIT_PURCHASE_VERIFY);

  router.post(
    "/credit/purchases/:creditPurchaseId/verify",
    verify,
    input.idempotency,
    validate({ params: creditPurchaseIdParamsSchema, body: creditPurchaseVerifyRequestSchema }),
    async (_request, response) => {
      const params = response.locals["validated"].params as { creditPurchaseId: string };
      const body = response.locals["validated"].body as {
        version: number;
        approvalToken?: string;
      };
      const actorUserId = requireCurrentUserId();
      sendData(
        response,
        await input.verifyPurchase.execute({
          creditPurchaseId: asId<CreditPurchaseId>(params.creditPurchaseId),
          version: body.version,
          actorUserId,
          isOwner: await input.isOwner(actorUserId),
          ...(body.approvalToken === undefined ? {} : { approvalToken: body.approvalToken }),
        }),
      );
    },
  );

  router.post(
    "/credit/purchases/:creditPurchaseId/reject",
    verify,
    validate({ params: creditPurchaseIdParamsSchema, body: creditPurchaseRejectRequestSchema }),
    async (_request, response) => {
      const params = response.locals["validated"].params as { creditPurchaseId: string };
      const body = response.locals["validated"].body as {
        version: number;
        reason: string;
      };
      const actorUserId = requireCurrentUserId();
      sendData(
        response,
        await input.rejectPurchase.execute({
          creditPurchaseId: asId<CreditPurchaseId>(params.creditPurchaseId),
          version: body.version,
          reason: body.reason,
          actorUserId,
        }),
      );
    },
  );
}

function mountPurchaseRoutes(router: Router, input: CreditTenantRouterDependencies): void {
  mountPurchaseReadRoutes(router, input);
  mountPurchaseActionRoutes(router, input);
}
