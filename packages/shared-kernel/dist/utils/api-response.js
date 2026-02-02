export class ApiResponse {
    static success(res, data, message = "Success", statusCode = 200) {
        const response = {
            success: true,
            statusCode,
            message,
            data,
            timestamp: new Date().toISOString(),
        };
        res.status(statusCode).json(response);
    }
    static paginated(res, data, page, limit, total, message = "Success", statusCode = 200) {
        const totalPages = Math.ceil(total / limit);
        const response = {
            success: true,
            statusCode,
            message,
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
            },
            timestamp: new Date().toISOString(),
        };
        res.status(statusCode).json(response);
    }
    static error(res, message, errorCode, statusCode = 500) {
        const response = {
            success: false,
            statusCode,
            errorCode,
            message,
            timestamp: new Date().toISOString(),
        };
        res.status(statusCode).json(response);
    }
}
//# sourceMappingURL=api-response.js.map