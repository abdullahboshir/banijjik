/**
 * Global API Response Utilities
 * Platinum Standard: Centralized response orchestration for all controllers.
 */
export class ApiResponse {
    static success(res, data, message, statusCode = 200) {
        const response = {
            success: true,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                message,
            },
        };
        res.status(statusCode).json(response);
    }
    static paginated(res, data, page, limit, total, message, statusCode = 200) {
        const totalPages = Math.ceil(total / limit);
        const response = {
            success: true,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                message,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                },
            },
        };
        res.status(statusCode).json(response);
    }
    static error(res, code, message, statusCode = 500, details, stack) {
        const response = {
            success: false,
            error: {
                code,
                message,
                details,
                stack,
            },
            meta: {
                timestamp: new Date().toISOString(),
            },
        };
        res.status(statusCode).json(response);
    }
}
//# sourceMappingURL=api-response.js.map