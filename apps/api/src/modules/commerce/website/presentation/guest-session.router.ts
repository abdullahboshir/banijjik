import { ERROR_CODE } from "@banijjik/contracts";
import {
  GUEST_SESSION_ABSOLUTE_EXPIRY_DAYS,
  SF_GUEST_COOKIE_NAME,
  formatGuestCookie,
  parseGuestCookie,
  type GuestSessionEntity,
} from "@banijjik/contracts/website";
import { Router, type Request, type RequestHandler, type Response } from "express";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { AppError, readCookie, sendData, validate } from "../../../../kernel/http/index.js";
import { rateLimit, type RateLimiter } from "../../../../kernel/rate-limit/index.js";
import { createGuestSessionBodySchema } from "@banijjik/validation/website";
import type { CreateGuestSessionUseCase } from "../application/use-cases/create-guest-session.use-case.js";
import type { ResolveGuestSessionUseCase } from "../application/use-cases/resolve-guest-session.use-case.js";

const GUEST_SESSION_RATE_LIMIT_BUCKET = "storefront.guest_session.ip";
const GUEST_SESSION_PER_HOUR = 10;
const ONE_HOUR_SECONDS = 3600;

export interface GuestSessionRequest extends Request {
  guestSession?: GuestSessionEntity;
}

export interface GuestSessionRouterDependencies {
  readonly createGuestSession: CreateGuestSessionUseCase;
  readonly resolveGuestSession: ResolveGuestSessionUseCase;
  readonly requireWebsiteModule: RequestHandler;
  readonly limiter: RateLimiter;
  readonly isProduction?: boolean | undefined;
}

function resolveOrgId(): string {
  const { organizationId } = getRequestContext();
  if (!organizationId) {
    throw new AppError({
      code: ERROR_CODE.NOT_FOUND,
      messageKey: "errors.storefront_not_available",
    });
  }
  return organizationId;
}

function clearGuestCookie(response: Response, isProduction?: boolean): void {
  response.clearCookie(SF_GUEST_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
  });
}

export function createGuestSessionAuthMiddleware(
  resolveUseCase: ResolveGuestSessionUseCase,
  isProduction?: boolean,
): RequestHandler {
  return async (request: GuestSessionRequest, response, next) => {
    const rawCookie = readCookie(request, SF_GUEST_COOKIE_NAME);
    const parsed = parseGuestCookie(rawCookie);
    if (!parsed) {
      throw new AppError({
        code: ERROR_CODE.UNAUTHENTICATED,
        messageKey: "errors.unauthenticated",
      });
    }

    const organizationId = resolveOrgId();
    const outcome = await resolveUseCase.execute({
      organizationId,
      guestSessionId: parsed.guestSessionId,
      rawSecret: parsed.rawSecret,
    });

    if (outcome.kind === "CROSS_ORG") {
      throw new AppError({
        code: ERROR_CODE.FORBIDDEN,
        messageKey: "errors.forbidden",
      });
    }

    if (outcome.kind === "EXPIRED") {
      clearGuestCookie(response, isProduction);
      throw new AppError({
        code: ERROR_CODE.WEBSITE_GUEST_SESSION_EXPIRED,
        messageKey: "errors.website_guest_session_expired",
      });
    }

    if (outcome.kind === "INVALID") {
      clearGuestCookie(response, isProduction);
      throw new AppError({
        code: ERROR_CODE.UNAUTHENTICATED,
        messageKey: "errors.unauthenticated",
      });
    }

    request.guestSession = outcome.session;
    next();
  };
}

export function buildGuestSessionRouter(dependencies: GuestSessionRouterDependencies): Router {
  const router = Router();
  const { isProduction, limiter, requireWebsiteModule, createGuestSession, resolveGuestSession } =
    dependencies;
  const authenticateGuest = createGuestSessionAuthMiddleware(resolveGuestSession, isProduction);

  router.post(
    "/guest-session",
    requireWebsiteModule,
    rateLimit({
      limiter,
      bucket: GUEST_SESSION_RATE_LIMIT_BUCKET,
      limit: GUEST_SESSION_PER_HOUR,
      windowSeconds: ONE_HOUR_SECONDS,
    }),
    validate({ body: createGuestSessionBodySchema }),
    async (_request, response) => {
      const organizationId = resolveOrgId();
      const result = await createGuestSession.execute(organizationId);

      response.cookie(
        SF_GUEST_COOKIE_NAME,
        formatGuestCookie(result.guestSessionId, result.rawSecret),
        {
          httpOnly: true,
          secure: isProduction,
          sameSite: "lax",
          maxAge: GUEST_SESSION_ABSOLUTE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
          path: "/",
        },
      );

      sendData(
        response,
        {
          guestSessionId: result.guestSessionId,
          expiresAt: result.expiresAt.toISOString(),
        },
        { status: 201 },
      );
    },
  );

  router.get(
    "/guest-session/me",
    requireWebsiteModule,
    authenticateGuest,
    (request: GuestSessionRequest, response) => {
      const session = request.guestSession;
      if (!session) {
        throw new AppError({
          code: ERROR_CODE.UNAUTHENTICATED,
          messageKey: "errors.unauthenticated",
        });
      }
      sendData(response, {
        guestSessionId: session.guestSessionId,
        expiresAt: session.expiresAt.toISOString(),
      });
    },
  );

  return router;
}
