import { PERMISSION_KEY } from "@banijjik/contracts";
import {
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
import type {
  ApproveListingUseCase,
  GetStaffListingUseCase,
  HideListingUseCase,
  ListDirectoryQueueUseCase,
  RejectListingUseCase,
  UnhideListingUseCase,
} from "../application/use-cases/staff-listing.use-cases.js";

export interface DirectoryTenantRouterDependencies {
  readonly permission: PermissionMiddlewareFactory;
  readonly listQueue: ListDirectoryQueueUseCase;
  readonly getListing: GetStaffListingUseCase;
  readonly approve: ApproveListingUseCase;
  readonly reject: RejectListingUseCase;
  readonly hide: HideListingUseCase;
  readonly unhide: UnhideListingUseCase;
}

function organizationIdOf(): OrganizationId {
  return asId<OrganizationId>(String(getRequestContext().organizationId));
}

function mountQueueAndRead(router: Router, input: DirectoryTenantRouterDependencies): void {
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
  mountQueueAndRead(router, input);
  mountApproveReject(router, input);
  mountHideActions(router, input);
  return router;
}
