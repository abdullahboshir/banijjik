import { describe, expect, it } from "vitest";
import { enrollmentActionsFor } from "./enrollment-action-items";

const everything = { canUpdate: true, canRenew: true, canCancel: true };

describe("enrollmentActionsFor", () => {
  it("offers activate and cancel on a pending enrollment", () => {
    expect(
      enrollmentActionsFor({ status: "PENDING", freezeAllowed: true, permissions: everything }),
    ).toEqual(["activate", "cancel"]);
  });

  it("offers freeze, renew and cancel on an active enrollment whose plan allows freezing", () => {
    expect(
      enrollmentActionsFor({ status: "ACTIVE", freezeAllowed: true, permissions: everything }),
    ).toEqual(["freeze", "renew", "cancel"]);
  });

  it("hides freeze when the plan does not allow it", () => {
    expect(
      enrollmentActionsFor({ status: "ACTIVE", freezeAllowed: false, permissions: everything }),
    ).toEqual(["renew", "cancel"]);
  });

  it("offers unfreeze on a frozen enrollment and activate on an overdue one", () => {
    const frozen = enrollmentActionsFor({
      status: "FROZEN",
      freezeAllowed: true,
      permissions: everything,
    });
    const overdue = enrollmentActionsFor({
      status: "OVERDUE",
      freezeAllowed: true,
      permissions: everything,
    });
    expect(frozen).toEqual(["unfreeze", "cancel"]);
    expect(overdue).toContain("activate");
  });

  it("offers nothing on a finished enrollment", () => {
    for (const status of ["EXPIRED", "COMPLETED", "CANCELLED"] as const) {
      expect(
        enrollmentActionsFor({ status, freezeAllowed: true, permissions: everything }),
      ).toEqual([]);
    }
  });

  it("leaves out an action the caller has no permission for", () => {
    const readOnly = { canUpdate: false, canRenew: false, canCancel: true };
    expect(
      enrollmentActionsFor({ status: "ACTIVE", freezeAllowed: true, permissions: readOnly }),
    ).toEqual(["cancel"]);
  });
});
