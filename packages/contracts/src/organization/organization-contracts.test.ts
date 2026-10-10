import { describe, expect, it } from "vitest";
import {
  SYSTEM_ROLE_KEY,
  SYSTEM_ROLE_NAME_MESSAGE_KEYS,
  systemRoleNameKey,
} from "../iam/system-role-key.js";
import { INDUSTRY_TEMPLATE_KEY } from "./industry-template-key.js";
import { LOCATION_STATUS } from "./location-status.js";
import { LOCATION_TYPE } from "./location-type.js";
import { MEMBER_STATUS } from "./member-status.js";
import { ORGANIZATION_DEPLOYMENT } from "./organization-deployment.js";
import { ORGANIZATION_MESSAGE_KEYS } from "./organization-message-keys.js";
import {
  normalizeOrganizationSlug,
  ORGANIZATION_SLUG_PATTERN,
  RESERVED_ORGANIZATION_SLUGS,
} from "./organization-slug-rules.js";
import { ORGANIZATION_STATUS } from "./organization-status.js";

describe("organization enums", () => {
  it("lists exactly the organization statuses and deployments of 09 section 4.2", () => {
    expect(Object.keys(ORGANIZATION_STATUS)).toEqual(["ACTIVE", "SUSPENDED", "CLOSED"]);
    expect(Object.keys(ORGANIZATION_DEPLOYMENT)).toEqual(["SHARED", "DEDICATED"]);
  });

  it("lists exactly the location and member values of 09 sections 4.3 and 4.4", () => {
    expect(Object.keys(LOCATION_TYPE)).toEqual(["STORE", "WAREHOUSE"]);
    expect(Object.keys(LOCATION_STATUS)).toEqual(["ACTIVE", "ARCHIVED"]);
    expect(Object.keys(MEMBER_STATUS)).toEqual(["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"]);
  });

  it("lists the eight industry templates of 12-INDUSTRY-TEMPLATES", () => {
    expect(Object.keys(INDUSTRY_TEMPLATE_KEY)).toEqual([
      "FCOMMERCE",
      "RETAIL",
      "SALON",
      "CLINIC",
      "GYM",
      "COACHING",
      "RESTAURANT",
      "HOSTEL",
    ]);
  });

  it("lists the six system roles of 09 section 4.5 with a name key each", () => {
    expect(Object.keys(SYSTEM_ROLE_KEY)).toEqual([
      "OWNER",
      "MANAGER",
      "CASHIER",
      "STAFF",
      "RIDER",
      "VIEWER",
    ]);
    expect(systemRoleNameKey("OWNER")).toBe("role.owner");
    expect(SYSTEM_ROLE_NAME_MESSAGE_KEYS).toHaveLength(6);
  });
});

describe("slug rules", () => {
  it("normalizes by trimming and lower-casing", () => {
    expect(normalizeOrganizationSlug("  Rahim-Store ")).toBe("rahim-store");
  });

  it("accepts single hyphens between letters and digits only", () => {
    expect(ORGANIZATION_SLUG_PATTERN.test("rahim-store-2")).toBe(true);
    expect(ORGANIZATION_SLUG_PATTERN.test("rahim--store")).toBe(false);
    expect(ORGANIZATION_SLUG_PATTERN.test("-rahim")).toBe(false);
    expect(ORGANIZATION_SLUG_PATTERN.test("rahim-")).toBe(false);
  });

  it("keeps the reserved words lower-case and unique", () => {
    expect(new Set(RESERVED_ORGANIZATION_SLUGS).size).toBe(RESERVED_ORGANIZATION_SLUGS.length);
    for (const word of RESERVED_ORGANIZATION_SLUGS) expect(word).toBe(word.toLowerCase());
  });
});

describe("ORGANIZATION_MESSAGE_KEYS", () => {
  it("has no duplicates and uses only the validation namespace", () => {
    expect(new Set(ORGANIZATION_MESSAGE_KEYS).size).toBe(ORGANIZATION_MESSAGE_KEYS.length);
    for (const key of ORGANIZATION_MESSAGE_KEYS) expect(key).toMatch(/^validation\.[a-z_]+$/);
  });
});
