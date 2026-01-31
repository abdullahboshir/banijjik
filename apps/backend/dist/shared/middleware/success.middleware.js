/**
 * Global Success Wrap Middleware (Reference)
 * Platinum Standard: Ensures successful results always follow the ApiResponse format.
 */
export const successResponseMiddleware = (req, res, next) => {
    const originalJson = res.json;
    res.json = function (data) {
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
//# sourceMappingURL=success.middleware.js.map