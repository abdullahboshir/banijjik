import { REFRESH_TOKEN_COOKIE_NAME } from "@banijjik/contracts";
import type { LoginBody, UserRegisterBody } from "@banijjik/validation";
import type { Request, RequestHandler } from "express";
import { readClientInfo, readCookie, sendData } from "../../../../kernel/http/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { LoginUseCase } from "../application/use-cases/login.use-case.js";
import type { LogoutAllUseCase } from "../application/use-cases/logout-all.use-case.js";
import type { LogoutUseCase } from "../application/use-cases/logout.use-case.js";
import type { RefreshSessionUseCase } from "../application/use-cases/refresh-session.use-case.js";
import type { RegisterUserUseCase } from "../application/use-cases/register-user.use-case.js";
import { RefreshRaceError } from "../domain/errors.js";
import type { AuthCookies } from "./auth-cookies.js";
import { toMeResponse } from "./me-response.transformer.js";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";

export interface AuthControllerDependencies {
  readonly registerUser: RegisterUserUseCase;
  readonly login: LoginUseCase;
  readonly refreshSession: RefreshSessionUseCase;
  readonly logout: LogoutUseCase;
  readonly logoutAll: LogoutAllUseCase;
  readonly cookies: AuthCookies;
  readonly clock: Clock;
}

function refreshTokenOf(request: Request): string | undefined {
  return readCookie(request, REFRESH_TOKEN_COOKIE_NAME);
}

/** Controllers only translate HTTP to a use case call and back; every rule lives in the use case. */
export class AuthController {
  constructor(private readonly dependencies: AuthControllerDependencies) {}

  readonly register: RequestHandler = async (request, response) => {
    const { registerUser, cookies, clock } = this.dependencies;
    // validate() already parsed the body with the register schema.
    const body: UserRegisterBody = request.body;
    const result = await registerUser.execute({
      name: body.name,
      email: body.email,
      phoneE164: body.phone,
      password: body.password,
      preferredLocale: body.preferredLocale,
      client: readClientInfo(request),
    });
    cookies.set(response, result.issued, clock.now());
    sendData(response, toMeResponse(result.user), { status: 201 });
  };

  readonly login: RequestHandler = async (request, response) => {
    const { login, cookies, clock } = this.dependencies;
    // validate() already parsed the body with the login schema.
    const body: LoginBody = request.body;
    const result = await login.execute({
      identifier: body.identifier,
      password: body.password,
      client: readClientInfo(request),
    });
    cookies.set(response, result.issued, clock.now());
    sendData(response, toMeResponse(result.user));
  };

  readonly refresh: RequestHandler = async (request, response) => {
    const { refreshSession, cookies, clock } = this.dependencies;
    try {
      const issued = await refreshSession.execute({
        refreshToken: refreshTokenOf(request),
        client: readClientInfo(request),
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
    await logout.execute({ refreshToken: refreshTokenOf(request) });
    cookies.clear(response);
    response.status(204).end();
  };

  readonly logoutAll: RequestHandler = async (_request, response) => {
    const { logoutAll, cookies } = this.dependencies;
    await logoutAll.execute({ userId: requireCurrentUserId() });
    cookies.clear(response);
    response.status(204).end();
  };
}
