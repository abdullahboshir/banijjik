import { defineEnum } from "../define-enum.js";

/** Which app an access token is for (ADR-045, ADR-048). A token for one audience is refused by the others. */
export const TOKEN_AUDIENCE = defineEnum(["ADMIN", "STOREFRONT", "PLATFORM"]);

export type TokenAudience = (typeof TOKEN_AUDIENCE)[keyof typeof TOKEN_AUDIENCE];
