import { describe, expect, it } from "vitest";
import { DATABASE_KIND } from "./database-kind.js";
import { SEQUENCE_KEY } from "./sequence-key.js";
import { SEQUENCE_KEY_MODE, SEQUENCE_MODE } from "./sequence-mode.js";
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
      "PUBLIC_FILE",
      "REPORT_REBUILD",
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
      "LISTING",
      "EXPENSE",
      "TRANSFER",
      "ZREPORT",
      "RETURN",
      "CUSTOM_ACCOUNT",
      "CREDIT_PURCHASE",
      "COMMISSION_PAYOUT",
    ]);
  });

  it("has the two database kinds", () => {
    expect(Object.keys(DATABASE_KIND)).toEqual(["PLATFORM", "TENANT"]);
  });

  it("gives every sequence key a mode and makes only invoices, journals and Z-reports gapless", () => {
    expect(Object.keys(SEQUENCE_KEY_MODE).sort()).toEqual(Object.keys(SEQUENCE_KEY).sort());
    const gapless = Object.entries(SEQUENCE_KEY_MODE)
      .filter(([, mode]) => mode === SEQUENCE_MODE.GAPLESS)
      .map(([key]) => key);
    expect(gapless.sort()).toEqual(["INVOICE", "JOURNAL", "ZREPORT"]);
  });
});
