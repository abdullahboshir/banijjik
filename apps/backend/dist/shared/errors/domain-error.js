/**
 * Base class for all Domain Errors
 * Platinum Standard: Business errors that the Infrastructure knows how to map.
 */
export class DomainError extends Error {
    constructor(message, code, statusCode = 400, details) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
/**
 * Specialized technical Errors (Optional but useful for Shared Kernel)
 */
export class ValidationError extends DomainError {
    constructor(message, details) {
        super(message, 'VALIDATION_ERROR', 400, details);
    }
}
export class NotFoundError extends DomainError {
    constructor(message, code = 'NOT_FOUND') {
        super(message, code, 404);
    }
}
export class UnauthorizedError extends DomainError {
    constructor(message = 'Unauthorized access') {
        super(message, 'UNAUTHORIZED', 401);
    }
}
export class ForbiddenError extends DomainError {
    constructor(message = 'Access denied') {
        super(message, 'FORBIDDEN', 403);
    }
}
export class ConflictError extends DomainError {
    constructor(message, code = 'CONFLICT') {
        super(message, code, 409);
    }
}
//# sourceMappingURL=domain-error.js.map