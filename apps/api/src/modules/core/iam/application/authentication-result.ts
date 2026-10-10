import type { PlatformOperator } from "../domain/platform-operator.entity.js";
import type { User } from "../domain/user.entity.js";
import type { IssuedSession } from "./session-issuer.js";

/** What register and login return: who is now signed in, and the tokens for their cookies. */
export interface AuthenticationResult {
  readonly user: User;
  readonly issued: IssuedSession;
  /** Set by the platform login only. */
  readonly operator?: PlatformOperator;
}
