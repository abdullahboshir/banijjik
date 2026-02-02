/**
 * Global Error Codes
 * Platinum Standard: Shared language for error handling across the monorepo.
 */
export var ErrorCode;
(function (ErrorCode) {
    // Auth & Identity
    ErrorCode["AUTH_INVALID_CREDENTIALS"] = "AUTH_INVALID_CREDENTIALS";
    ErrorCode["AUTH_TOKEN_EXPIRED"] = "AUTH_TOKEN_EXPIRED";
    ErrorCode["AUTH_UNAUTHORIZED"] = "AUTH_UNAUTHORIZED";
    // User/Person
    ErrorCode["USER_ALREADY_EXISTS"] = "USER_ALREADY_EXISTS";
    ErrorCode["USER_NOT_FOUND"] = "USER_NOT_FOUND";
    // Organization
    ErrorCode["ORG_NOT_FOUND"] = "ORG_NOT_FOUND";
    ErrorCode["ORG_ALREADY_MEMBER"] = "ORG_ALREADY_MEMBER";
    // Validation
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    // System
    ErrorCode["INTERNAL_SERVER_ERROR"] = "INTERNAL_SERVER_ERROR";
    ErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
})(ErrorCode || (ErrorCode = {}));
//# sourceMappingURL=error-code.enum.js.map