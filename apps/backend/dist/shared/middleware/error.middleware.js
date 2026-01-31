import { DomainError } from "../errors";
import { ApiResponse } from "../presentation";
import { logger } from "../utils";
/**
 * Global Error Middleware
 * Platinum Standard: Catches all errors and maps them to standard ApiResponse.
 */
export const globalErrorMiddleware = (error, req, res, next) => {
    // 1. Log error for observability
    logger.error(`${req.method} ${req.url}:`, {
        message: error.message,
        stack: error.stack,
    });
    // 2. Map DomainError to ApiResponse
    if (error instanceof DomainError) {
        return ApiResponse.error(res, error.code, error.message, error.statusCode, error.details, process.env.NODE_ENV === "development" ? error.stack : undefined);
    }
    // 3. Handle Generic Errors (Internal Server Error)
    const internalErrorCode = "INTERNAL_SERVER_ERROR";
    const internalErrorMessage = "An unexpected error occurred";
    return ApiResponse.error(res, internalErrorCode, internalErrorMessage, 500, null, process.env.NODE_ENV === "development" ? error.stack : undefined);
};
//# sourceMappingURL=error.middleware.js.map