import { describe, expect, it } from "vitest";
import { DATABASE_KIND } from "./database-kind.js";
import { SEQUENCE_KEY } from "./sequence-key.js";
import { SYSTEM_REASON } from "./system-reason.js";

describe("system enums", () => {
  it("lists exactly the system reasons of 05-CONVENTIONS", () => {
    expect(Object.keys(SYSTEM_REASON)).toEqual([
      "AUTH_LOOKUP",
      "PERMISSION_RESOLUTION",
      "CONTEXT_SETUP",
      "SEED",
      "PLATFORM_ADMIN",
      "MIGRATION",
      "WEBHOOK_ROUTING",
      "SCHEDULED_JOB",
    ]);
  });

  it("lists exactly the sequence keys of 09-DOMAIN-MODEL section 5.8", () => {
    expect(Object.keys(SEQUENCE_KEY)).toEqual([
      "ORDER",
      "BOOKING",
      "ENROLLMENT",
      "PAYMENT",
      "INVOICE",
      "JOURNAL",
      "MEMBER",
      "EXPENSE",
      "TRANSFER",
      "ZREPORT",
      "RETURN",
    ]);
  });

  it("has the two database kinds", () => {
    expect(Object.keys(DATABASE_KIND)).toEqual(["PLATFORM", "TENANT"]);
  });
});
