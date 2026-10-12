import { describe, expect, it } from "vitest";
import { diffAuditFields } from "./audit-diff.js";

describe("diffAuditFields", () => {
  it("records only the new value for a field that was not set before", () => {
    expect(diffAuditFields({}, { nickname: "Rahim" })).toEqual({ nickname: { to: "Rahim" } });
  });

  it("records the old and the new value for a field that changed", () => {
    expect(diffAuditFields({ nickname: "Rahim" }, { nickname: "Karim" })).toEqual({
      nickname: { from: "Rahim", to: "Karim" },
    });
  });

  it("records a cleared field as to: null, so the entry shows it was emptied", () => {
    expect(diffAuditFields({ nickname: "Rahim" }, { nickname: undefined })).toEqual({
      nickname: { from: "Rahim", to: null },
    });
    expect(diffAuditFields({ nickname: "Rahim" }, {})).toEqual({
      nickname: { from: "Rahim", to: null },
    });
  });

  it("leaves out fields that are equal or unset on both sides", () => {
    expect(diffAuditFields({ kept: "x", unset: undefined }, { kept: "x" })).toEqual({});
    expect(diffAuditFields({ roles: ["a", "b"] }, { roles: ["a", "b"] })).toEqual({});
  });
});
