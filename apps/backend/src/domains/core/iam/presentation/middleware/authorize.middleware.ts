import { Request, Response, NextFunction } from "express";

/**
 * Authorization Middleware Guards
 * Handles RBAC (Role Based Access Control) and Permission checks.
 */
export const authorize = {
  /**
   * Restrict access to Super Admins only
   */
  requireSuperAdmin: () => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, message: "Authentication required." });
      }

      if (!req.user.isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: "Access forbidden. SuperAdmin privileges required.",
        });
      }
      next();
    };
  },

  /**
   * Restrict access to specific roles
   * @param roles Array of role keys/IDs
   */
  requireAnyRole: (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, message: "Authentication required." });
      }

      const hasRole = roles.some((role) => req.user?.roles.includes(role));

      if (!hasRole && !req.user.isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: `Access forbidden. Required roles: ${roles.join(", ")}`,
        });
      }
      next();
    };
  },

  /**
   * Restrict access based on granular permission
   * @param permission Permission string (e.g., 'ORGANIZATION:EDIT')
   */
  requirePermission: (permission: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, message: "Authentication required." });
      }

      // Logic for checking granular permissions would go here.
      // Usually involves checking user.directPermissions or roles -> permissions mapping.

      // For now, if super admin, allow everything.
      if (req.user.isSuperAdmin) return next();

      next();
    };
  },
};
