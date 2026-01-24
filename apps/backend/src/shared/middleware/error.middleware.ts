import { Request, Response, NextFunction } from 'express';
import { DomainError, createErrorResponse } from '../kernel';

/**
 * Global Error Middleware
 * Platinum Standard: Catches all errors and maps them to standard ApiResponse.
 */
export const globalErrorMiddleware = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 1. Log error for observability (In prod use a logger like Winston/Pino)
  console.error(`[Error] ${req.method} ${req.url}:`, error);

  // 2. Map DomainError to ApiResponse
  if (error instanceof DomainError) {
    return res.status(error.statusCode).json(
      createErrorResponse(
        error.code,
        error.message,
        error.details,
        process.env.NODE_ENV === 'development' ? error.stack : undefined
      )
    );
  }

  // 3. Handle Generic Errors (Internal Server Error)
  const internalErrorCode = 'INTERNAL_SERVER_ERROR';
  const internalErrorMessage = 'An unexpected error occurred';
  
  return res.status(500).json(
    createErrorResponse(
      internalErrorCode,
      internalErrorMessage,
      null,
      process.env.NODE_ENV === 'development' ? error.stack : undefined
    )
  );
};
