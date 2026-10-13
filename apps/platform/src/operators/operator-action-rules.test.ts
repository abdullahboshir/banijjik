import { PLATFORM_PERMISSION_KEY, USER_STATUS } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { BILLING, SUPER_ADMIN } from "../test-support/fixtures";
import { operatorActionsFor, type OperatorActionRow } from "./operator-action-rules";

const OTHER_ID = "01900000-0000-7000-8000-000000000099";

function row(status: OperatorActionRow["status"]): OperatorActionRow {
  return { platformOperatorId: OTHER_ID, status };
}

describe("operatorActionsFor", () => {
  it("offers no actions on the signed-in operator's own row", () => {
    const ownRow = {
      platformOperatorId: SUPER_ADMIN.platformOperatorId,
      status: USER_STATUS.ACTIVE,
    };
    expect(operatorActionsFor(ownRow, SUPER_ADMIN)).toEqual([]);
  });

  it("offers change roles and disable on another active operator", () => {
    expect(operatorActionsFor(row(USER_STATUS.ACTIVE), SUPER_ADMIN)).toEqual([
      "changeRoles",
      "disable",
    ]);
  });

  it("offers change roles and enable on a disabled operator", () => {
    expect(operatorActionsFor(row(USER_STATUS.DISABLED), SUPER_ADMIN)).toEqual([
      "changeRoles",
      "enable",
    ]);
  });

  it("offers nothing to a viewer without operator.write", () => {
    const reader = {
      platformOperatorId: BILLING.platformOperatorId,
      permissions: [PLATFORM_PERMISSION_KEY.OPERATOR_READ],
    };
    expect(operatorActionsFor(row(USER_STATUS.ACTIVE), reader)).toEqual([]);
  });
});
