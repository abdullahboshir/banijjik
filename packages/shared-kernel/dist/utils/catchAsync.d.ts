import type { NextFunction, Request, RequestHandler, Response } from 'express';
export declare const catchAsync: (fn: RequestHandler) => (req: Request, res: Response, next: NextFunction) => void;
export default catchAsync;
//# sourceMappingURL=catchAsync.d.ts.map