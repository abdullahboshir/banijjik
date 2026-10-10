import { describe, expect, it } from "vitest";
import { ERROR_CODE } from "../errors/error-code.js";
import { isErrorCode } from "./api-envelope.js";

describe("isErrorCode", () => {
  it("accepts every code in ERROR_CODE", () => {
    for (const code of Object.values(ERROR_CODE)) expect(isErrorCode(code)).toBe(true);
  });

  it("rejects an unknown string and non-strings", () => {
    expect(isErrorCode("TEAPOT")).toBe(false);
    expect(isErrorCode(undefined)).toBe(false);
    expect(isErrorCode(500)).toBe(false);
  });
});
