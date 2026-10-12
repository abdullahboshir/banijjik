import { ERROR_CODE } from "@banijjik/contracts";
import type { LoginBody } from "@banijjik/validation";
import type { Request, RequestHandler } from "express";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";
import { AppError, readCookie, sendData } from "../../../../kernel/http/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { ClientInfo } from "../application/session-issuer.js";
import type { LoginUseCase } from "../application/use-cases/login.use-case.js";
import type { LogoutAllUseCase } from "../application/use-cases/logout-all.use-case.js";
import type { LogoutUseCase } from "../application/use-cases/logout.use-case.js";
import type { RefreshSessionUseCase } from "../application/use-cases/refresh-session.use-case.js";
import { RefreshRaceError } from "../domain/errors.js";
import type { AuthCookies } from "./auth-cookies.js";
import { toPlatformSessionResponse } from "./platform-session.transformer.js";

export interface PlatformAuthControllerDependencies {
  readonly login: LoginUseCase;
  readonly refreshSession: RefreshSessionUseCase;
  readonly logout: LogoutUseCase;
  readonly logoutAll: LogoutAllUseCase;
  /** Writes and reads the platform cookie pair (platform_access_token, platform_refresh_token). */
  readonly cookies: AuthCookies;
  readonly clock: Clock;
}

function clientOf(request: Request): ClientInfo {
  return { userAgent: request.get("user-agent"), ipAddress: request.ip };
}

/** The platform counterpart of AuthController: same use cases with the PLATFORM audience, other cookies. */
export class PlatformAuthController {
  constructor(private readonly dependencies: PlatformAuthControllerDependencies) {}

  readonly login: RequestHandler = async (request, response) => {
    const { login, cookies, clock } = this.dependencies;
    // validate() already parsed the body with the login schema.
    const body: LoginBody = request.body;
    const result = await login.execute({
      identifier: body.identifier,
      password: body.password,
      client: clientOf(request),
    });
    // The platform login always returns the operator it checked; anything else is a wiring bug.
    if (result.operator === undefined) {
      throw new AppError({
        code: ERROR_CODE.INTERNAL,
        messageKey: "errors.platform_operator_missing",
      });
    }
    cookies.set(response, result.issued, clock.now());
    sendData(response, toPlatformSessionResponse(result.user, result.operator));
  };

  readonly refresh: RequestHandler = async (request, response) => {
    const { refreshSession, cookies, clock } = this.dependencies;
    try {
      const issued = await refreshSession.execute({
        refreshToken: readCookie(request, cookies.refreshName()),
        client: clientOf(request),
      });
      cookies.set(response, issued, clock.now());
      response.status(204).end();
    } catch (error) {
      // A lost race keeps the cookies: the request that won has just set fresh ones.
      if (!(error instanceof RefreshRaceError)) cookies.clear(response);
      throw error;
    }
  };

  readonly logout: RequestHandler = async (request, response) => {
    const { logout, cookies } = this.dependencies;
    await logout.execute({ refreshToken: readCookie(request, cookies.refreshName()) });
    cookies.clear(response);
    response.status(204).end();
  };

  /** Needs a platform session: routes/platform.ts puts authenticatePlatform() in front of it. */
  readonly logoutAll: RequestHandler = async (_request, response) => {
    const { logoutAll, cookies } = this.dependencies;
    await logoutAll.execute({ userId: requireCurrentUserId() });
    cookies.clear(response);
    response.status(204).end();
  };
}
