import { describe, expect, it } from "vitest";
import { ERROR_CODE } from "./error-code.js";
import {
  KERNEL_ERROR_MESSAGE_KEYS,
  VALIDATION_FALLBACK_MESSAGE_KEY,
  VALIDATION_MESSAGE_KEYS,
} from "./message-keys.js";

describe("message keys", () => {
  it("has one error key per error code and the transport and stream declaration keys", () => {
    expect(KERNEL_ERROR_MESSAGE_KEYS).toHaveLength(Object.keys(ERROR_CODE).length + 6);
    expect(KERNEL_ERROR_MESSAGE_KEYS).toContain("errors.retry_later");
    expect(KERNEL_ERROR_MESSAGE_KEYS).toContain("errors.invalid_body");
    expect(KERNEL_ERROR_MESSAGE_KEYS).toContain("errors.event_handler_invalid_stream");
    expect(KERNEL_ERROR_MESSAGE_KEYS).toContain("errors.event_handler_stream_mismatch");
  });

  it("includes the fallback key among the validation keys", () => {
    expect(VALIDATION_MESSAGE_KEYS).toContain(VALIDATION_FALLBACK_MESSAGE_KEY);
  });
});
