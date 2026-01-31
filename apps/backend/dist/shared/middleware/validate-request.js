import { catchAsync } from "../utils/catch-async";
/**
 * Platinum Standard: Request Validation Middleware.
 * Decouples schema validation from business controllers.
 */
export const validateRequest = (zodSchema) => {
    return catchAsync(async (req, _res, next) => {
        const result = await zodSchema.safeParseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
            cookies: req.cookies,
        });
        if (!result.success) {
            next(result.error);
        }
        else {
            // Re-assign validated data to request for controller use if needed
            // req.body = result.data.body;
            next();
        }
    });
};
//# sourceMappingURL=validate-request.js.map