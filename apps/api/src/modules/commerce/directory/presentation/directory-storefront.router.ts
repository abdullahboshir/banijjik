import { DIRECTORY_SEARCH_RULES, LISTING_VIEWER } from "@banijjik/contracts/directory";
import { paginationQuerySchema } from "@banijjik/validation";
import {
  listingBlockCreateRequestSchema,
  listingNumberParamsSchema,
  listingReportFileRequestSchema,
  listingSearchQuerySchema,
  listingSubmitRequestSchema,
  listingUpsertRequestSchema,
} from "@banijjik/validation/directory";
import { Router, type RequestHandler } from "express";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { requireCurrentCustomerAccountId } from "../../../../kernel/auth/index.js";
import { sendData, validate } from "../../../../kernel/http/index.js";
import { rateLimit, type RateLimiter } from "../../../../kernel/rate-limit/index.js";
import { readUpload, type ReadUploadOptions } from "../../../core/file/index.js";
import type {
  BlockListingUseCase,
  ListMyListingBlocksUseCase,
  UnblockListingUseCase,
} from "../application/use-cases/listing-block.use-cases.js";
import type {
  FileListingReportUseCase,
  GetListingReportReasonsUseCase,
} from "../application/use-cases/listing-report.use-cases.js";
import type { GetMyListingUseCase } from "../application/use-cases/my-listing.use-cases.js";
import type {
  ArchiveMyListingUseCase,
  SubmitMyListingUseCase,
  UpsertMyListingUseCase,
} from "../application/use-cases/my-listing.use-cases.js";
import type {
  GetPublicListingUseCase,
  SearchListingsUseCase,
} from "../application/use-cases/search-listings.use-case.js";
import type { UploadListingPhotoUseCase } from "../application/use-cases/upload-listing-photo.use-case.js";
import { asId, type OrganizationId } from "@banijjik/ids";

const SEARCH_IP_BUCKET = "directory.search.ip";
const SEARCH_ACCOUNT_BUCKET = "directory.search.account";
const DETAIL_IP_BUCKET = "directory.detail.ip";
const DETAIL_ACCOUNT_BUCKET = "directory.detail.account";
const HTTP_CREATED = 201;

export interface DirectoryStorefrontRouterDependencies {
  readonly getMyListing: GetMyListingUseCase;
  readonly upsertMyListing: UpsertMyListingUseCase;
  readonly submitMyListing: SubmitMyListingUseCase;
  readonly archiveMyListing: ArchiveMyListingUseCase;
  readonly uploadListingPhoto: UploadListingPhotoUseCase;
  readonly searchListings: SearchListingsUseCase;
  readonly getPublicListing: GetPublicListingUseCase;
  readonly fileReport: FileListingReportUseCase;
  readonly reportReasons: GetListingReportReasonsUseCase;
  readonly blockListing: BlockListingUseCase;
  readonly unblockListing: UnblockListingUseCase;
  readonly listMyListingBlocks: ListMyListingBlocksUseCase;
  readonly limiter: RateLimiter;
  readonly authenticateCustomer: RequestHandler;
  readonly authenticateCustomerOptional: RequestHandler;
  readonly uploadOptions?: ReadUploadOptions;
}

function organizationIdOf(): OrganizationId {
  return asId<OrganizationId>(String(getRequestContext().organizationId));
}

function mountPublicRoutes(router: Router, input: DirectoryStorefrontRouterDependencies): void {
  mountListingSearch(router, input);
  mountSingleListing(router, input);
}

function mountListingSearch(router: Router, input: DirectoryStorefrontRouterDependencies): void {
  router.get(
    "/listings",
    rateLimit({
      limiter: input.limiter,
      bucket: SEARCH_IP_BUCKET,
      ...DIRECTORY_SEARCH_RULES.perIp,
    }),
    input.authenticateCustomerOptional,
    rateLimit({
      limiter: input.limiter,
      bucket: SEARCH_ACCOUNT_BUCKET,
      ...DIRECTORY_SEARCH_RULES.perAccount,
      keyOf: (request) => getRequestContext().customerAccountId ?? request.ip ?? "anon",
    }),
    validate({ query: listingSearchQuerySchema }),
    async (_request, response) => {
      const query = response.locals["validated"].query as Record<string, unknown> & {
        page: number;
        limit: number;
        listingNumber?: string;
      };
      const viewer =
        getRequestContext().customerAccountId === undefined
          ? LISTING_VIEWER.PUBLIC
          : LISTING_VIEWER.MEMBER;
      sendData(
        response,
        await input.searchListings.execute({
          organizationId: organizationIdOf(),
          viewer,
          ...(getRequestContext().customerAccountId === undefined
            ? {}
            : { customerAccountId: getRequestContext().customerAccountId }),
          page: query.page,
          limit: query.limit,
          ...(query.listingNumber === undefined ? {} : { listingNumber: query.listingNumber }),
          rawQuery: { ...query },
        }),
      );
    },
  );
}

function mountSingleListing(router: Router, input: DirectoryStorefrontRouterDependencies): void {
  // Listing numbers run in sequence, so reading the detail page is the cheapest way to copy the
  // whole directory: it gets the same two limits as search, in their own buckets (M.7 decision 8).
  router.get(
    "/listings/:listingNumber",
    rateLimit({
      limiter: input.limiter,
      bucket: DETAIL_IP_BUCKET,
      ...DIRECTORY_SEARCH_RULES.detailPerIp,
    }),
    input.authenticateCustomerOptional,
    rateLimit({
      limiter: input.limiter,
      bucket: DETAIL_ACCOUNT_BUCKET,
      ...DIRECTORY_SEARCH_RULES.detailPerAccount,
      keyOf: (request) => getRequestContext().customerAccountId ?? request.ip ?? "anon",
    }),
    validate({ params: listingNumberParamsSchema }),
    async (_request, response) => {
      const { listingNumber } = response.locals["validated"].params as { listingNumber: string };
      const viewer =
        getRequestContext().customerAccountId === undefined
          ? LISTING_VIEWER.PUBLIC
          : LISTING_VIEWER.MEMBER;
      sendData(
        response,
        await input.getPublicListing.execute({
          organizationId: organizationIdOf(),
          listingNumber,
          viewer,
          ...(getRequestContext().customerAccountId === undefined
            ? {}
            : { customerAccountId: getRequestContext().customerAccountId }),
        }),
      );
    },
  );
}

function mountMyListingReadWrite(
  router: Router,
  input: DirectoryStorefrontRouterDependencies,
): void {
  router.get("/my/listing", input.authenticateCustomer, async (_request, response) => {
    sendData(
      response,
      await input.getMyListing.execute({
        organizationId: organizationIdOf(),
        customerAccountId: requireCurrentCustomerAccountId(),
      }),
    );
  });

  router.put(
    "/my/listing",
    input.authenticateCustomer,
    validate({ body: listingUpsertRequestSchema }),
    async (_request, response) => {
      sendData(
        response,
        await input.upsertMyListing.execute({
          organizationId: organizationIdOf(),
          customerAccountId: requireCurrentCustomerAccountId(),
          body: response.locals["validated"].body,
        }),
      );
    },
  );

  router.post(
    "/my/listing/submit",
    input.authenticateCustomer,
    validate({ body: listingSubmitRequestSchema }),
    async (_request, response) => {
      const body = response.locals["validated"].body as {
        consents: readonly { consentKey: string }[];
      };
      sendData(
        response,
        await input.submitMyListing.execute({
          organizationId: organizationIdOf(),
          customerAccountId: requireCurrentCustomerAccountId(),
          consents: body.consents,
        }),
      );
    },
  );
}

function mountMyListingLifecycle(
  router: Router,
  input: DirectoryStorefrontRouterDependencies,
): void {
  router.delete("/my/listing", input.authenticateCustomer, async (_request, response) => {
    await input.archiveMyListing.execute({
      organizationId: organizationIdOf(),
      customerAccountId: requireCurrentCustomerAccountId(),
    });
    response.status(204).end();
  });

  router.post("/my/listing/photos", input.authenticateCustomer, async (request, response) => {
    const uploaded = await readUpload(request, input.uploadOptions);
    sendData(
      response,
      await input.uploadListingPhoto.execute({
        organizationId: organizationIdOf(),
        customerAccountId: requireCurrentCustomerAccountId(),
        originalName: uploaded.originalName,
        bytes: uploaded.bytes,
      }),
      { status: HTTP_CREATED },
    );
  });
}

/** A report comes from a signed-in customer only: anonymous reports are spam (M.7 decision 3). */
function mountReports(router: Router, input: DirectoryStorefrontRouterDependencies): void {
  router.get("/listing-report-reasons", input.authenticateCustomer, async (_request, response) => {
    sendData(response, await input.reportReasons.execute({ organizationId: organizationIdOf() }));
  });

  router.post(
    "/listings/:listingNumber/reports",
    input.authenticateCustomer,
    validate({ params: listingNumberParamsSchema, body: listingReportFileRequestSchema }),
    async (_request, response) => {
      const { listingNumber } = response.locals["validated"].params as { listingNumber: string };
      const filed = await input.fileReport.execute({
        organizationId: organizationIdOf(),
        listingNumber,
        reporterCustomerAccountId: requireCurrentCustomerAccountId(),
        body: response.locals["validated"].body,
      });
      sendData(response, filed.report, { status: filed.created ? HTTP_CREATED : 200 });
    },
  );
}

function mountBlocks(router: Router, input: DirectoryStorefrontRouterDependencies): void {
  router.get(
    "/my/listing-blocks",
    input.authenticateCustomer,
    validate({ query: paginationQuerySchema }),
    async (_request, response) => {
      const query = response.locals["validated"].query as { page: number; limit: number };
      const result = await input.listMyListingBlocks.execute({
        organizationId: organizationIdOf(),
        customerAccountId: requireCurrentCustomerAccountId(),
        page: query.page,
        limit: query.limit,
      });
      sendData(response, result);
    },
  );

  router.post(
    "/my/listing-blocks",
    input.authenticateCustomer,
    validate({ body: listingBlockCreateRequestSchema }),
    async (_request, response) => {
      const body = response.locals["validated"].body as { listingNumber: string };
      const result = await input.blockListing.execute({
        organizationId: organizationIdOf(),
        customerAccountId: requireCurrentCustomerAccountId(),
        listingNumber: body.listingNumber,
      });
      sendData(response, result.block, { status: result.created ? HTTP_CREATED : 200 });
    },
  );

  router.delete(
    "/my/listing-blocks/:listingNumber",
    input.authenticateCustomer,
    validate({ params: listingNumberParamsSchema }),
    async (_request, response) => {
      const params = response.locals["validated"].params as { listingNumber: string };
      await input.unblockListing.execute({
        organizationId: organizationIdOf(),
        customerAccountId: requireCurrentCustomerAccountId(),
        listingNumber: params.listingNumber,
      });
      response.status(204).end();
    },
  );
}

export function buildDirectoryStorefrontRouter(
  input: DirectoryStorefrontRouterDependencies,
): Router {
  const router = Router({ mergeParams: true });
  mountPublicRoutes(router, input);
  mountReports(router, input);
  mountBlocks(router, input);
  mountMyListingReadWrite(router, input);
  mountMyListingLifecycle(router, input);
  return router;
}
