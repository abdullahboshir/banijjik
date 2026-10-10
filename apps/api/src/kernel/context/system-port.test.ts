import { SYSTEM_REASON } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { installTestLogger } from "../../test-support/test-databases.js";
import { getSystemReason } from "./run-as-system.js";
import { asSystemPort } from "./system-port.js";

class ReasonProbe {
  readonly label = "probe";

  async reasonSeenByMethod(): Promise<string | undefined> {
    return getSystemReason();
  }

  async failing(): Promise<void> {
    throw new Error("port failure");
  }
}

describe("asSystemPort", () => {
  it("runs every method inside runAsSystem with the given reason", async () => {
    installTestLogger();
    const port = asSystemPort(SYSTEM_REASON.AUTH_LOOKUP, new ReasonProbe());

    expect(await port.reasonSeenByMethod()).toBe("AUTH_LOOKUP");
  });

  it("leaves the plain object untouched, so the original is not a bypass", async () => {
    installTestLogger();
    const plain = new ReasonProbe();
    asSystemPort(SYSTEM_REASON.AUTH_LOOKUP, plain);

    expect(await plain.reasonSeenByMethod()).toBeUndefined();
  });

  it("passes errors through and keeps plain properties readable", async () => {
    installTestLogger();
    const port = asSystemPort(SYSTEM_REASON.SEED, new ReasonProbe());

    expect(port.label).toBe("probe");
    await expect(port.failing()).rejects.toThrow("port failure");
  });
});
