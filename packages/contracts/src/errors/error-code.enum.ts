/**
 * Global Error Codes
 * Platinum Standard: Shared language for error handling across the monorepo.
 */
export enum ErrorCode {
  // Auth & Identity
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',
  
  // User/Person
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  
  // Organization
  ORG_NOT_FOUND = 'ORG_NOT_FOUND',
  ORG_ALREADY_MEMBER = 'ORG_ALREADY_MEMBER',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // System
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}
