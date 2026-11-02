import { ERROR_CODE } from "@banijjik/contracts";
import { asId, type OrganizationId } from "@banijjik/ids";
import { uuidV7Schema } from "@banijjik/validation";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { AppError, sendData, validationFailed } from "../../../../kernel/http/index.js";
import type {
  GetPublicAvailabilityUseCase,
  PublicAvailabilityQuery,
} from "../application/use-cases/get-public-availability.use-case.js";

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;
const MAX_INCLUSIVE_DAYS = 31;

function calendarDayNumber(date: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMs = Date.UTC(year, month - 1, day);
  const check = new Date(utcMs);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return undefined;
  }
  return utcMs / MS_PER_DAY;
}

/** Local copy: the `@banijjik/validation/booking` named schema is undefined while this graph loads. */
const publicAvailabilityQuerySchema = z
  .strictObject({
    offeringId: uuidV7Schema,
    variantId: uuidV7Schema,
    locationId: uuidV7Schema,
    startDate: z.string().regex(LOCAL_DATE),
    endDate: z.string().regex(LOCAL_DATE),
  })
  .superRefine((query, context) => {
    const start = calendarDayNumber(query.startDate);
    const end = calendarDayNumber(query.endDate);
    if (start === undefined) {
      context.addIssue({ code: "custom", path: ["startDate"] });
      return;
    }
    if (end === undefined) {
      context.addIssue({ code: "custom", path: ["endDate"] });
      return;
    }
    const inclusiveDays = end - start + 1;
    if (inclusiveDays < 1 || inclusiveDays > MAX_INCLUSIVE_DAYS) {
      context.addIssue({ code: "custom", path: ["endDate"] });
    }
  });

export interface BookingStorefrontRouterDependencies {
  readonly requireBookingModule: RequestHandler;
  readonly getPublicAvailability: GetPublicAvailabilityUseCase;
  readonly readPublicLocationIds: (organizationId: string) => Promise<readonly string[]>;
}

function notFound(): AppError {
  return new AppError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: "errors.storefront_not_available",
  });
}

function resolveOrgId(): string {
  const { organizationId } = getRequestContext();
  if (organizationId === undefined) throw notFound();
  return organizationId;
}

function parsePublicAvailabilityQuery(): RequestHandler {
  return (request, response, next) => {
    const parsed = publicAvailabilityQuerySchema.safeParse({ ...request.query });
    if (!parsed.success) {
      throw validationFailed(
        parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          messageKey: "validation.custom",
        })),
      );
    }
    response.locals["validated"] = { query: parsed.data };
    next();
  };
}

export function buildBookingStorefrontRouter(
  dependencies: BookingStorefrontRouterDependencies,
): Router {
  const router = Router();
  router.get(
    "/availability",
    dependencies.requireBookingModule,
    parsePublicAvailabilityQuery(),
    async (_request, response) => {
      const organizationId = resolveOrgId();
      const query = response.locals["validated"].query as PublicAvailabilityQuery;
      const publicLocationIds = await dependencies.readPublicLocationIds(organizationId);
      const result = await dependencies.getPublicAvailability.execute({
        organizationId: asId<OrganizationId>(organizationId),
        publicLocationIds,
        query,
      });
      sendData(response, result);
    },
  );
  return router;
}
