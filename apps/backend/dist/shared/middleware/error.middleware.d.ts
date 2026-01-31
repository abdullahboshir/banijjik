import { Request, Response, NextFunction } from "express";
/**
 * Global Error Middleware
 * Platinum Standard: Catches all errors and maps them to standard ApiResponse.
 */
export declare const globalErrorMiddleware: (error: any, req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=error.middleware.d.ts.map