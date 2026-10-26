import { describe, expect, it } from "vitest";
import { initializeSecretBox, openSecret, sealSecret } from "./secret-box.js";
import { createTestConfig } from "../../test-support/test-config.js";

describe("secret-box", () => {
  it("a sealed secret opens with the same binding and fails with another organization's binding", () => {
    initializeSecretBox(createTestConfig().sms.encryptionKey);
    const sealed = sealSecret("fake-secret", "sms:first:adareach.password");
    expect(openSecret(sealed, "sms:first:adareach.password")).toBe("fake-secret");
    expect(() => openSecret(sealed, "sms:second:adareach.password")).toThrow("INTERNAL");
    expect(() => openSecret(sealed, "sms:first:bulksmsbd.apiKey")).toThrow("INTERNAL");
  });

  it("a tampered sealed value fails without naming the value", () => {
    initializeSecretBox(createTestConfig().sms.encryptionKey);
    const sealed = sealSecret("fake-secret", "sms:platform:bulksmsbd.apiKey");
    const tampered = sealed.slice(0, -4) + "AAAA";
    expect(() => openSecret(tampered, "sms:platform:bulksmsbd.apiKey")).toThrow("INTERNAL");
    initializeSecretBox(Buffer.alloc(32, 12).toString("base64"));
    expect(() => openSecret(sealed, "sms:platform:bulksmsbd.apiKey")).toThrow("INTERNAL");
  });
});
