import { Request, Response, NextFunction } from "express";

/**
 * Platinum Standard: Global Async Wrapper for Express Handlers.
 * Eliminates the need for try-catch blocks in controllers/middlewares.
 */
export const catchAsync = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};
