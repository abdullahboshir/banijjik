import { AuthenticatedUser } from "../domains/core/iam/application/ports/user-context.port";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
