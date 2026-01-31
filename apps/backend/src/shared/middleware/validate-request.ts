import { NextFunction, Request, Response } from "express";
import { ZodSchema, ZodType } from "zod";
import { catchAsync } from "../utils/catch-async";

/**
 * Platinum Standard: Request Validation Middleware.
 * Decouples schema validation from business controllers.
 */
export const validateRequest = (zodSchema: ZodSchema | ZodType | any) => {
  return catchAsync(
    async (req: Request, _res: Response, next: NextFunction) => {
      const result = await zodSchema.safeParseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        cookies: req.cookies,
      });

      if (!result.success) {
        next(result.error);
      } else {
        // Re-assign validated data to request for controller use if needed
        // req.body = result.data.body;
        next();
      }
    },
  );
};
