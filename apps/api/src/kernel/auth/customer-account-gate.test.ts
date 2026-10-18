import { describe, expect, it } from "vitest";
import { MutableClock } from "../../test-support/mutable-clock.js";
import { cacheAccountStatus } from "./customer-account-gate.js";

function countingReader(answer: () => boolean) {
  const calls: string[] = [];
  return {
    calls,
    reader: {
      isActive(customerAccountId: string): Promise<boolean> {
        calls.push(customerAccountId);
        return Promise.resolve(answer());
      },
    },
  };
}

describe("cacheAccountStatus", () => {
  it("reads once a minute per account, and sees a block after the window", async () => {
    const clock = new MutableClock();
    let isActive = true;
    const { reader, calls } = countingReader(() => isActive);
    const gate = cacheAccountStatus(reader, { clock, maxStaleSeconds: 60 });

    expect(await gate.isActive("account-1")).toBe(true);
    isActive = false;
    clock.advanceSeconds(30);
    expect(await gate.isActive("account-1")).toBe(true);
    clock.advanceSeconds(31);
    expect(await gate.isActive("account-1")).toBe(false);
    expect(calls).toEqual(["account-1", "account-1"]);
  });

  it("keeps one answer per account", async () => {
    const { reader, calls } = countingReader(() => true);
    const gate = cacheAccountStatus(reader, { clock: new MutableClock(), maxStaleSeconds: 60 });

    await gate.isActive("account-1");
    await gate.isActive("account-2");

    expect(calls).toEqual(["account-1", "account-2"]);
  });
});
