import { describe, expect, it } from "vitest";
import { installTestLogger } from "../../test-support/test-databases.js";
import { reportError } from "./report-error.js";

const PHONE = "+8801712345678";
const EMAIL = "rahim@example.com";

function duplicateKeyError(): Error {
  return Object.assign(
    new Error(`E11000 duplicate key error collection: contacts dup key: { phoneE164: "${PHONE}" }`),
    {
      name: "MongoServerError",
      code: 11000,
      keyPattern: { phoneE164: 1 },
      keyValue: { phoneE164: PHONE, email: EMAIL },
    },
  );
}

describe("reportError", () => {
  it("logs neither the phone nor the email of a duplicate-key shaped error (M6)", () => {
    const logs = installTestLogger();

    reportError(duplicateKeyError(), {});

    expect(logs.text()).not.toContain(PHONE);
    expect(logs.text()).not.toContain(EMAIL);
    expect(logs.lines()[0]?.["err"]).toMatchObject({
      name: "MongoServerError",
      message: "MongoServerError 11000",
      code: 11000,
    });
  });

  it("keeps the message and stack of a plain error", () => {
    const logs = installTestLogger();

    reportError(new Error("disk is full"), { requestId: "request-1" });

    expect(logs.lines()[0]).toMatchObject({
      requestId: "request-1",
      err: { name: "Error", message: "disk is full", stack: expect.stringContaining("at ") },
    });
  });

  it("logs a thrown non-error value as text", () => {
    const logs = installTestLogger();

    reportError("plain string", {});

    expect(logs.lines()[0]?.["err"]).toMatchObject({ name: "NonError", message: "plain string" });
  });
});
