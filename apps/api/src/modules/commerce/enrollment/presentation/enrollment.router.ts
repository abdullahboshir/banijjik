import { paginationQuerySchema } from "@banijjik/validation";
import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  enrollmentCreateRequestSchema,
  enrollmentVersionRequestSchema,
  enrollmentIdParamsSchema,
  enrollmentListQuerySchema,
  checkInCreateRequestSchema,
  checkInListQuerySchema,
  type EnrollmentCreateBody,
  type EnrollmentListQuery,
  type CheckInCreateBody,
  type CheckInListQuery,
} from "@banijjik/validation/enrollment";
import type { EnrollmentAction } from "@banijjik/contracts/enrollment";
import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData, validate } from "../../../../kernel/http/index.js";
import type { EnrollmentDependencies } from "../application/dependencies.js";
import { detail, readEnrollment } from "../application/dependencies.js";
import { createEnrollment } from "../application/create-enrollment.js";
import { transitionEnrollment } from "../application/transition-enrollment.js";
import { createCheckIn } from "../application/check-in.js";

export function buildEnrollmentRouter(input: {
  dependencies: EnrollmentDependencies;
  permission: PermissionMiddlewareFactory;
  idempotency: RequestHandler;
}): Router {
  const router = Router({ mergeParams: true });
  const { dependencies, permission, idempotency } = input;
  router.get(
    "/enrollments",
    permission(PERMISSION_KEY.ENROLLMENT_ENROLLMENT_READ),
    validate({ query: enrollmentListQuerySchema }),
    async (request, response) => {
      const query = response.locals["validated"].query as EnrollmentListQuery;
      const page = await dependencies.repository.list(query);
      sendData(response, page.items, {
        meta: { page: query.page, limit: query.limit, hasNext: page.hasNext },
      });
    },
  );
  router.get(
    "/enrollments/:enrollmentId",
    permission(PERMISSION_KEY.ENROLLMENT_ENROLLMENT_READ),
    validate({ params: enrollmentIdParamsSchema }),
    async (request, response) => {
      sendData(
        response,
        await detail(dependencies, readTenantCaller(), String(request.params.enrollmentId)),
      );
    },
  );
  router.post(
    "/enrollments",
    permission(PERMISSION_KEY.ENROLLMENT_ENROLLMENT_CREATE),
    validate({ body: enrollmentCreateRequestSchema }),
    idempotency,
    async (request, response) => {
      sendData(
        response,
        await createEnrollment(
          dependencies,
          readTenantCaller(),
          request.body as EnrollmentCreateBody,
        ),
        { status: 201 },
      );
    },
  );
  mountPeriods(router, input);
  mountTransitions(router, input);
  mountCheckIns(router, input);
  return router;
}
function mountTransitions(
  router: Router,
  input: {
    dependencies: EnrollmentDependencies;
    permission: PermissionMiddlewareFactory;
    idempotency: RequestHandler;
  },
) {
  const routes: readonly [EnrollmentAction, Parameters<PermissionMiddlewareFactory>[0]][] = [
    ["activate", PERMISSION_KEY.ENROLLMENT_ENROLLMENT_UPDATE],
    ["freeze", PERMISSION_KEY.ENROLLMENT_ENROLLMENT_UPDATE],
    ["unfreeze", PERMISSION_KEY.ENROLLMENT_ENROLLMENT_UPDATE],
    ["cancel", PERMISSION_KEY.ENROLLMENT_ENROLLMENT_CANCEL],
    ["renew", PERMISSION_KEY.ENROLLMENT_ENROLLMENT_RENEW],
  ];
  for (const [action, key] of routes) {
    router.post(
      `/enrollments/:enrollmentId/${action}`,
      input.permission(key),
      validate({ params: enrollmentIdParamsSchema, body: enrollmentVersionRequestSchema }),
      input.idempotency,
      async (request, response) => {
        const { version } = request.body as { version: number };
        const result = await transitionEnrollment(input.dependencies, {
          ...readTenantCaller(),
          enrollmentId: String(request.params.enrollmentId),
          version,
          action,
        });
        sendData(response, result);
      },
    );
  }
}

function mountCheckIns(
  router: Router,
  input: {
    dependencies: EnrollmentDependencies;
    permission: PermissionMiddlewareFactory;
    idempotency: RequestHandler;
  },
) {
  const { dependencies, permission } = input;
  router.post(
    "/check-ins",
    permission(PERMISSION_KEY.ENROLLMENT_CHECK_IN_CREATE),
    validate({ body: checkInCreateRequestSchema }),
    input.idempotency,
    async (request, response) => {
      sendData(
        response,
        await createCheckIn(dependencies, readTenantCaller(), request.body as CheckInCreateBody),
        { status: 201 },
      );
    },
  );
  router.get(
    "/check-ins",
    permission(PERMISSION_KEY.ENROLLMENT_ENROLLMENT_READ),
    validate({ query: checkInListQuerySchema }),
    async (request, response) => {
      const query = response.locals["validated"].query as CheckInListQuery;
      const page = await dependencies.repository.checkIns(query);
      sendData(response, page.items, {
        meta: { page: query.page, limit: query.limit, hasNext: page.hasNext },
      });
    },
  );
}

function mountPeriods(
  router: Router,
  input: { dependencies: EnrollmentDependencies; permission: PermissionMiddlewareFactory },
) {
  router.get(
    "/enrollments/:enrollmentId/periods",
    input.permission(PERMISSION_KEY.ENROLLMENT_ENROLLMENT_READ),
    validate({ params: enrollmentIdParamsSchema, query: paginationQuerySchema }),
    async (request, response) => {
      const enrollmentId = String(request.params.enrollmentId);
      await readEnrollment(input.dependencies, readTenantCaller(), enrollmentId);
      const query = response.locals["validated"].query as { page: number; limit: number };
      const page = await input.dependencies.repository.periodPage(enrollmentId, query);
      sendData(response, page.items, { meta: { ...query, hasNext: page.hasNext } });
    },
  );
}
