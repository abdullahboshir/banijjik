import { describe, expect, it } from "vitest";
import { createTranslator } from "@banijjik/i18n";
import { roleNamesOf } from "./role-names";

const { t } = createTranslator({ locale: "bn", brandName: "Example" });

describe("roleNamesOf", () => {
  it("translates system role keys and joins them", () => {
    expect(roleNamesOf(["OWNER", "MANAGER"], t)).toBe("মালিক, ম্যানেজার");
  });

  it("leaves out custom roles, which have no catalog name", () => {
    expect(roleNamesOf(["custom.0198a", "VIEWER"], t)).toBe(t("role.viewer"));
  });

  it("returns an empty string when there are no roles", () => {
    expect(roleNamesOf([], t)).toBe("");
  });
});
