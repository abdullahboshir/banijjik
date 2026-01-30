import { ConflictError, NotFoundError } from "@shared";

/**
 * Identity Domain Errors
 * Platinum Standard: Business errors that are specific to the Identity domain.
 */

export class EmailAlreadyExistsError extends ConflictError {
  constructor(email: string) {
    super(`User with email "${email}" already exists`, "EMAIL_ALREADY_EXISTS");
  }
}

export class UserNotFoundError extends NotFoundError {
  constructor(identifier: string) {
    super(`User with identifier "${identifier}" not found`, "USER_NOT_FOUND");
  }
}

export class InvalidCredentialsError extends Error {
  // Note: We use Error here and map it to 401 in infrastructure for security,
  // or use a generic "Invalid Credentials" message to avoid email enumeration.
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

export class PasswordTooWeakError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordTooWeakError";
  }
}
