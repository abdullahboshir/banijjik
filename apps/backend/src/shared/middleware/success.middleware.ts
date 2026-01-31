import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../presentation";

/**
 * Global Success Wrap Middleware (Reference)
 * Platinum Standard: Ensures successful results always follow the ApiResponse format.
 */
export const successResponseMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const originalJson = res.json;

  res.json = function (data: any) {
    // Avoid double wrapping
    if (data && typeof data === "object" && "success" in data) {
      return originalJson.call(this, data);
    }

    const wrapped = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
    return originalJson.call(this, wrapped);
  };

  next();
};
