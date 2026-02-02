/**
 * Authentication Middleware Factory
 * Protects routes by verifying JWT tokens and ensuring user existence.
 */
export const createAuthenticateMiddleware = (jwtService, userRepository) => {
    return async (req, res, next) => {
        try {
            // 1. Extract Token
            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required. Please provide a Bearer token.",
                });
            }
            const token = authHeader.split(" ")[1];
            // 2. Verify Token
            const decoded = jwtService.verifyToken(token);
            if (!decoded) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid or expired token.",
                });
            }
            console.log("Decoded:", decoded);
            // 3. Find User (using userId from Hybrid ID Strategy)
            const userId = decoded.userId;
            const user = await userRepository.findById(userId);
            if (!user || !user.canLogin()) {
                return res.status(401).json({
                    success: false,
                    message: "User not found or account deactivated.",
                });
            }
            // 4. Attach User to Request
            req.user = {
                userId: user.userId,
                email: user.email.toString(),
                roles: user.systemRoles,
                organizationId: decoded.organizationId || user.metadata?.organizationId,
                isSuperAdmin: user.isSuperAdmin,
            };
            next();
        }
        catch (error) {
            console.error("[AUTH_MIDDLEWARE_ERROR]:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error during authentication.",
            });
        }
    };
};
//# sourceMappingURL=authenticate.middleware.js.map