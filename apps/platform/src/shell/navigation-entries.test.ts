import { describe, expect, it } from "vitest";
import { BILLING, SUPER_ADMIN, SUPPORT } from "../test-support/fixtures";
import { banglaTranslator } from "../test-support/render-helpers";
import { navigationEntriesFor } from "./navigation-entries";

const { t } = banglaTranslator();

function hrefsFor(operator: Parameters<typeof navigationEntriesFor>[0]): string[] {
  return navigationEntriesFor(operator, t).map((entry) => entry.href);
}

describe("navigationEntriesFor", () => {
  it("shows tenants, packages, industries, the audit log, failed events and operators to a super admin", () => {
    expect(hrefsFor(SUPER_ADMIN)).toEqual([
      "/tenants",
      "/packages",
      "/industry-templates",
      "/audit",
      "/failed-events",
      "/operators",
      "/sms-gateway",
    ]);
  });

  it("hides the audit log from support and billing, who lack platform.audit.read", () => {
    expect(hrefsFor(SUPPORT)).toEqual([
      "/tenants",
      "/packages",
      "/industry-templates",
      "/sms-gateway",
    ]);
    expect(hrefsFor(BILLING)).toEqual(["/tenants", "/packages", "/industry-templates"]);
  });

  it("follows the permissions it is given, not the role name", () => {
    const onlyAudit = { ...SUPPORT, permissions: ["platform.audit.read" as const] };
    expect(hrefsFor(onlyAudit)).toEqual(["/audit"]);
  });

  it("shows nothing to an operator without permissions", () => {
    expect(hrefsFor({ permissions: [] })).toEqual([]);
  });

  it("labels every entry in Bangla", () => {
    const labels = navigationEntriesFor(SUPER_ADMIN, t).map((entry) => entry.label);
    expect(labels).toEqual([
      "টেন্যান্ট",
      "প্যাকেজ",
      "ইন্ডাস্ট্রি",
      "অডিট লগ",
      "ব্যর্থ ইভেন্ট",
      "অপারেটর",
      "এসএমএস",
    ]);
  });
});
