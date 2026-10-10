import { describe, expect, it } from "vitest";
import { createLogCapture } from "../../test-support/log-capture.js";
import { createLogger } from "./logger.js";

describe("createLogger redaction", () => {
  it("masks passwords, emails, phones, tokens and cookies", () => {
    const logs = createLogCapture();
    const logger = createLogger({ level: "info", destination: logs.destination });

    logger.info(
      {
        user: { email: "a@example.com", password: "p4ss", phoneE164: "+8801700000000" },
        session: { token: "tok-123", secret: "s3cret" },
        authorization: "Bearer abc",
        req: { headers: { cookie: "sid=1", authorization: "Bearer abc" } },
      },
      "sample",
    );

    const text = logs.text();
    for (const secret of ["a@example.com", "p4ss", "+8801700000000", "tok-123", "s3cret"]) {
      expect(text).not.toContain(secret);
    }
    expect(text).not.toContain("sid=1");
    expect(text).not.toContain("Bearer abc");
    expect(logs.lines()[0]?.["service"]).toBe("api");
  });
});
