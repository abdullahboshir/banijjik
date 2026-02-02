export class AppError extends Error {
    constructor(statusCode = 500, message, stack = '') {
        super(message);
        this.statusCode = statusCode;
        this.name = this.constructor.name;
        if (stack) {
            this.stack = stack;
        }
        else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
//# sourceMappingURL=app-error.js.map