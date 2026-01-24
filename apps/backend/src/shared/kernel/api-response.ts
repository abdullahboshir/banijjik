import { ApiResponse } from '@banijjik/contracts';

/**
 * Global API Response Utilities
 * Platinum Standard: Uses the interface from @banijjik/contracts for single source of truth.
 */
export type { ApiResponse };

/**
 * Utility to create a success response
 */
export const createSuccessResponse = <T>(data: T, meta?: any): ApiResponse<T> => ({
  success: true,
  data,
  meta: {
    timestamp: new Date().toISOString(),
    ...meta,
  },
});

/**
 * Utility to create an error response
 */
export const createErrorResponse = (
  code: string,
  message: string,
  details?: any,
  stack?: string
): ApiResponse => ({
  success: false,
  error: {
    code,
    message,
    details,
    stack,
  },
  meta: {
    timestamp: new Date().toISOString(),
  },
});
