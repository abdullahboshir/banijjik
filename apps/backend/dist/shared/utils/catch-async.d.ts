import { Request, Response, NextFunction } from "express";
/**
 * Platinum Standard: Global Async Wrapper for Express Handlers.
 * Eliminates the need for try-catch blocks in controllers/middlewares.
 */
export declare const catchAsync: (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=catch-async.d.ts.map