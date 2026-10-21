import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  directoryListingsQuerySchema,
  directoryQueueQuerySchema,
  listingIdParamsSchema,
  listingRejectRequestSchema,
  listingTransitionRequestSchema,
} from "@banijjik/validation/directory";
import { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { sendData, validate } from "../../../../kernel/http/index.js";
import { asId, type ListingId, type OrganizationId } from "@banijjik/ids";
import type { ListingStatus } from "@banijjik/contracts/directory";
import type {
  ApproveListingUseCase,
  GetDirectoryConfigUseCase,
  GetStaffListingUseCase,
  HideListingUseCase,
  ListDirectoryQueueUseCase,
  ListStaffListingsUseCase,
  RejectListingUseCase,
  UnhideListingUseCase,
} from "../application/use-cases/staff-listing.use-cases.js";
import type { CountListingUnlocksUseCase } from "../application/use-cases/count-listing-unlocks.use-case.js";

export interface DirectoryTenantRouterDependencies {
  readonly permission: PermissionMiddlewareFactory;
  readonly getConfig: GetDirectoryConfigUseCase;
  readonly listQueue: ListDirectoryQueueUseCase;
  readonly listListings: ListStaffListingsUseCase;
  readonly getListing: GetStaffListingUseCase;
  readonly approve: ApproveListingUseCase;
  readonly reject: RejectListingUseCase;
  readonly hide: HideListingUseCase;
  readonly unhide: UnhideListingUseCase;
  /** Answers 404 when the credit module is off for the organization (the counter port is null). */
  readonly countUnlocks: CountListingUnlocksUseCase;
}

function organizationIdOf(): OrganizationId {
  return asId<OrganizationId>(String(getRequestContext().organizationId));
}

function mountConfig(router: Router, input: DirectoryTenantRouterDependencies): void {
  const read = input.permission(PERMISSION_KEY.DIRECTORY_LISTING_READ);
  router.get("/directory/config", read, async (_request, response) => {
    sendData(response, await input.getConfig.execute({ organizationId: organizationIdOf() }));
  });
}

function mountQueue(router: Router, input: DirectoryTenantRouterDependencies): void {
  const read = input.permission(PERMISSION_KEY.DIRECTORY_LISTING_READ);
  router.get(
    "/directory/queue",
    read,
    validate({ query: directoryQueueQuerySchema }),
    async (_request, response) => {
      const query = response.locals["validated"].query as {
        page: number;
        limit: number;
        status?: "SUBMITTED" | "APPROVED" | "REJECTED" | "HIDDEN";
      };
      sendData(
        response,
        await input.listQueue.execute({
          organizationId: organizationIdOf(),
          page: query.page,
          limit: query.limit,
          ...(query.status === undefined ? {} : { status: query.status }),
        }),
      );
    },
  );
}

function mountStaffList(router: Router, input: DirectoryTenantRouterDependencies): void {
  const read = input.permission(PERMISSION_KEY.DIRECTORY_LISTING_READ);
  router.get(
    "/directory/listings",
    read,
    validate({ query: directoryListingsQuerySchema }),
    async (_request, response) => {
      const query = response.locals["validated"].query as {
        page: number;
        limit: number;
        status?: ListingStatus;
        listingNumber?: string;
        from?: Date;
        to?: Date;
      };
      sendData(
        response,
        await input.listListings.execute({
          organizationId: organizationIdOf(),
          page: query.page,
          limit: query.limit,
          ...(query.status === undefined ? {} : { status: query.status }),
          ...(query.listingNumber === undefined ? {} : { listingNumber: query.listingNumber }),
          ...(query.from === undefined ? {} : { from: query.from }),
          ...(query.to === undefined ? {} : { to: query.to }),
        }),
      );
    },
  );
}

function mountStaffDetail(router: Router, input: DirectoryTenantRouterDependencies): void {
  const read = input.permission(PERMISSION_KEY.DIRECTORY_LISTING_READ);
  router.get(
    "/directory/listings/:listingId",
    read,
    validate({ params: listingIdParamsSchema }),
    async (_request, response) => {
      const { listingId } = response.locals["validated"].params as { listingId: string };
      sendData(
        response,
        await input.getListing.execute({
          organizationId: organizationIdOf(),
          listingId: asId<ListingId>(listingId),
        }),
      );
    },
  );
  router.get(
    "/directory/listings/:listingId/unlock-count",
    read,
    validate({ params: listingIdParamsSchema }),
    async (_request, response) => {
      const { listingId } = response.locals["validated"].params as { listingId: string };
      sendData(
        response,
        await input.countUnlocks.execute({
          organizationId: organizationIdOf(),
          listingId: asId<ListingId>(listingId),
        }),
      );
    },
  );
}

function mountApproveReject(router: Router, input: DirectoryTenantRouterDependencies): void {
  const review = input.permission(PERMISSION_KEY.DIRECTORY_LISTING_REVIEW);
  router.post(
    "/directory/listings/:listingId/approve",
    review,
    validate({ params: listingIdParamsSchema, body: listingTransitionRequestSchema }),
    async (_request, response) => {
      const { listingId } = response.locals["validated"].params as { listingId: string };
      const body = response.locals["validated"].body as { version: number };
      sendData(
        response,
        await input.approve.execute({
          organizationId: organizationIdOf(),
          listingId: asId<ListingId>(listingId),
          version: body.version,
          actorUserId: requireCurrentUserId(),
        }),
      );
    },
  );
  router.post(
    "/directory/listings/:listingId/reject",
    review,
    validate({ params: listingIdParamsSchema, body: listingRejectRequestSchema }),
    async (_request, response) => {
      const { listingId } = response.locals["validated"].params as { listingId: string };
      sendData(
        response,
        await input.reject.execute({
          organizationId: organizationIdOf(),
          listingId: asId<ListingId>(listingId),
          body: response.locals["validated"].body,
          actorUserId: requireCurrentUserId(),
        }),
      );
    },
  );
}

function mountHideActions(router: Router, input: DirectoryTenantRouterDependencies): void {
  const hide = input.permission(PERMISSION_KEY.DIRECTORY_LISTING_HIDE);
  router.post(
    "/directory/listings/:listingId/hide",
    hide,
    validate({ params: listingIdParamsSchema, body: listingTransitionRequestSchema }),
    async (_request, response) => {
      const { listingId } = response.locals["validated"].params as { listingId: string };
      const body = response.locals["validated"].body as { version: number };
      sendData(
        response,
        await input.hide.execute({
          organizationId: organizationIdOf(),
          listingId: asId<ListingId>(listingId),
          version: body.version,
          actorUserId: requireCurrentUserId(),
        }),
      );
    },
  );
  router.post(
    "/directory/listings/:listingId/unhide",
    hide,
    validate({ params: listingIdParamsSchema, body: listingTransitionRequestSchema }),
    async (_request, response) => {
      const { listingId } = response.locals["validated"].params as { listingId: string };
      const body = response.locals["validated"].body as { version: number };
      sendData(
        response,
        await input.unhide.execute({
          organizationId: organizationIdOf(),
          listingId: asId<ListingId>(listingId),
          version: body.version,
          actorUserId: requireCurrentUserId(),
        }),
      );
    },
  );
}

export function buildDirectoryTenantRouter(input: DirectoryTenantRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  mountConfig(router, input);
  mountQueue(router, input);
  mountStaffList(router, input);
  mountStaffDetail(router, input);
  mountApproveReject(router, input);
  mountHideActions(router, input);
  return router;
}
