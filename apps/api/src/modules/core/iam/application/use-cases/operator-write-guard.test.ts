import { ERROR_CODE, PLATFORM_ROLE, USER_STATUS } from "@banijjik/contracts";
import { asId, newId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { PlatformOperator } from "../../domain/platform-operator.entity.js";
import { guardOperatorWrite } from "./operator-write-guard.js";

const NOW = new Date("2026-10-13T08:00:00.000Z");

function operator(
  roles: readonly (typeof PLATFORM_ROLE)[keyof typeof PLATFORM_ROLE][],
  status: (typeof USER_STATUS)[keyof typeof USER_STATUS] = USER_STATUS.ACTIVE,
): PlatformOperator {
  return PlatformOperator.restore({
    platformOperatorId: newId(),
    userId: asId<UserId>(newId()),
    platformRoles: roles,
    status,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function touching(rows: ReadonlyMap<string, PlatformOperator>) {
  const touched: string[] = [];
  return {
    touched,
    operators: {
      touch: async (platformOperatorId: string) => {
        touched.push(platformOperatorId);
        return rows.get(platformOperatorId);
      },
    },
  };
}

describe("guardOperatorWrite", () => {
  it("refuses an actor who is not active", async () => {
    const actor = operator([PLATFORM_ROLE.SUPER_ADMIN], USER_STATUS.DISABLED);
    const { operators } = touching(new Map([[actor.platformOperatorId, actor]]));
    await expect(guardOperatorWrite(operators, actor.platformOperatorId)).rejects.toMatchObject({
      code: ERROR_CODE.FORBIDDEN,
    });
  });

  it("refuses an actor who is not a super admin", async () => {
    const actor = operator([PLATFORM_ROLE.SUPPORT]);
    const { operators } = touching(new Map([[actor.platformOperatorId, actor]]));
    await expect(guardOperatorWrite(operators, actor.platformOperatorId)).rejects.toMatchObject({
      code: ERROR_CODE.FORBIDDEN,
    });
  });

  it("touches the actor first and then the target", async () => {
    const actor = operator([PLATFORM_ROLE.SUPER_ADMIN]);
    const target = operator([PLATFORM_ROLE.BILLING]);
    const fake = touching(
      new Map([
        [actor.platformOperatorId, actor],
        [target.platformOperatorId, target],
      ]),
    );
    const guarded = await guardOperatorWrite(
      fake.operators,
      actor.platformOperatorId,
      target.platformOperatorId,
    );
    expect(fake.touched).toEqual([actor.platformOperatorId, target.platformOperatorId]);
    expect(guarded.target?.platformOperatorId).toBe(target.platformOperatorId);
  });
});
