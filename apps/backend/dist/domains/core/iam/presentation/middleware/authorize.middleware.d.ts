import { Request, Response, NextFunction } from "express";
/**
 * Authorization Middleware Guards
 * Handles RBAC (Role Based Access Control) and Permission checks.
 */
export declare const authorize: {
    /**
     * Restrict access to Super Admins only
     */
    requireSuperAdmin: () => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
    /**
     * Restrict access to specific roles
     * @param roles Array of role keys/IDs
     */
    requireAnyRole: (roles: string[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
    /**
     * Restrict access based on granular permission
     * @param permission Permission string (e.g., 'ORGANIZATION:EDIT')
     */
    requirePermission: (permission: string) => (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
};
//# sourceMappingURL=authorize.middleware.d.ts.map