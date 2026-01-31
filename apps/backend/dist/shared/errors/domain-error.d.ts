/**
 * Base class for all Domain Errors
 * Platinum Standard: Business errors that the Infrastructure knows how to map.
 */
export declare abstract class DomainError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly details?: any;
    constructor(message: string, code: string, statusCode?: number, details?: any);
}
/**
 * Specialized technical Errors (Optional but useful for Shared Kernel)
 */
export declare class ValidationError extends DomainError {
    constructor(message: string, details?: any);
}
export declare class NotFoundError extends DomainError {
    constructor(message: string, code?: string);
}
export declare class UnauthorizedError extends DomainError {
    constructor(message?: string);
}
export declare class ForbiddenError extends DomainError {
    constructor(message?: string);
}
export declare class ConflictError extends DomainError {
    constructor(message: string, code?: string);
}
//# sourceMappingURL=domain-error.d.ts.map