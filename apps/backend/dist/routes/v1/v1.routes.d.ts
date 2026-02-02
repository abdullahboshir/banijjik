import { authorize } from "@iam/presentation";
declare const authenticate: (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => Promise<import("express").Response<any, Record<string, any>> | undefined>;
export declare const v1Routes: import("express-serve-static-core").Router;
export { authenticate, authorize };
//# sourceMappingURL=v1.routes.d.ts.map