import { describe, expect, it } from "vitest";
import { IAM_MESSAGE_KEYS } from "./iam-message-keys.js";
import { PLATFORM_ROLE } from "./platform-role.js";
import { PREFERRED_LOCALE } from "./preferred-locale.js";
import { TOKEN_AUDIENCE } from "./token-audience.js";
import { USER_STATUS } from "./user-status.js";

describe("iam enums", () => {
  it("lists exactly the user statuses of 09 section 4.1", () => {
    expect(Object.keys(USER_STATUS)).toEqual(["ACTIVE", "LOCKED", "DISABLED"]);
  });

  it("lists exactly the platform roles of 09 section 4.1", () => {
    expect(Object.keys(PLATFORM_ROLE)).toEqual(["SUPER_ADMIN", "SUPPORT", "BILLING"]);
  });

  it("lists the three token audiences of ADR-045 and ADR-048", () => {
    expect(Object.keys(TOKEN_AUDIENCE)).toEqual(["ADMIN", "STOREFRONT", "PLATFORM"]);
  });

  it("offers Bangla and English", () => {
    expect(Object.keys(PREFERRED_LOCALE)).toEqual(["bn", "en"]);
  });
});

describe("IAM_MESSAGE_KEYS", () => {
  it("has no duplicates and uses only the errors and validation namespaces", () => {
    expect(new Set(IAM_MESSAGE_KEYS).size).toBe(IAM_MESSAGE_KEYS.length);
    for (const key of IAM_MESSAGE_KEYS) expect(key).toMatch(/^(errors|validation)\.[a-z_]+$/);
  });
});
