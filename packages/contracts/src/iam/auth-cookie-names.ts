/** Cookie names shared by the iam module (which sets them) and the kernel (which reads the access cookie). */
export const ACCESS_TOKEN_COOKIE_NAME = "access_token";
export const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

/**
 * The platform panel has its own cookies, so an operator can be signed in to both apps and a
 * token of one audience never reaches the other (ADR-048). Paths are in the iam module.
 */
export const PLATFORM_ACCESS_TOKEN_COOKIE_NAME = "platform_access_token";
export const PLATFORM_REFRESH_TOKEN_COOKIE_NAME = "platform_refresh_token";
