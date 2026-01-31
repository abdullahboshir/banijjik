import { NextFunction, Request, Response } from "express";
import { ZodSchema, ZodType } from "zod";
/**
 * Platinum Standard: Request Validation Middleware.
 * Decouples schema validation from business controllers.
 */
export declare const validateRequest: (zodSchema: ZodSchema | ZodType | any) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validate-request.d.ts.map