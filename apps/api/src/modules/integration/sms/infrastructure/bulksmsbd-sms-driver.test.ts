import { afterEach, describe, expect, it } from "vitest";
import { startSmsStub } from "../../../../test-support/sms-http-stub.js";
import { BulkSmsBdSmsDriver } from "./bulksmsbd-sms-driver.js";
import { SmsTransientError } from "../application/ports.js";

let stub: Awaited<ReturnType<typeof startSmsStub>> | undefined;
afterEach(async () => {
  await stub?.close();
});

function driver(baseUrl: string, timeoutMs?: number) {
  return new BulkSmsBdSmsDriver({ baseUrl, apiKey: "fake-api-key", senderId: "TEST" }, timeoutMs);
}
const message = { msisdn: "8801712345678", text: "Hello" };

describe("BulkSMSBD", () => {
  it("sends the exact English request with the key in the form body", async () => {
    stub = await startSmsStub(() => ({ body: { response_code: 202 } }));
    await driver(stub.baseUrl).send(message);
    expect(stub.requests[0]).toMatchObject({
      method: "POST",
      url: "/smsapi",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(Object.fromEntries(new URLSearchParams(stub.requests[0]?.body))).toEqual({
      api_key: "fake-api-key",
      type: "text",
      number: message.msisdn,
      senderid: "TEST",
      message: "Hello",
    });
  });

  it("sends the exact Bangla request with type unicode", async () => {
    stub = await startSmsStub(() => ({ body: { response_code: 202 } }));
    await driver(stub.baseUrl).send({ ...message, text: "বাংলা বার্তা" });
    expect(stub.requests[0]?.url).toBe("/smsapi");
    expect(Object.fromEntries(new URLSearchParams(stub.requests[0]?.body))).toEqual({
      api_key: "fake-api-key",
      type: "unicode",
      number: message.msisdn,
      senderid: "TEST",
      message: "বাংলা বার্তা",
    });
  });

  it("treats 202 as sent and 1007 as BALANCE_LOW", async () => {
    let code = 202;
    stub = await startSmsStub(() => ({ body: { response_code: code } }));
    const sender = driver(stub.baseUrl);
    await expect(sender.send(message)).resolves.toMatchObject({ outcome: "SENT" });
    code = 1007;
    await expect(sender.send(message)).resolves.toEqual({
      outcome: "REFUSED",
      failureReason: "BALANCE_LOW",
      providerErrorCode: 1007,
    });
  });

  it("treats a 403 HTML page as a permanent refusal, not a retry", async () => {
    stub = await startSmsStub(() => ({
      status: 403,
      contentType: "text/html",
      rawBody: "<h1>IP blocked</h1>",
    }));
    await expect(driver(stub.baseUrl).send(message)).resolves.toMatchObject({
      outcome: "REFUSED",
      failureReason: "PROVIDER_REFUSED",
    });
  });

  it("throws a transient error on 5xx and timeout", async () => {
    let timeout = false;
    stub = await startSmsStub(() => (timeout ? { delayMs: 100 } : { status: 503 }));
    const sender = driver(stub.baseUrl, 20);
    await expect(sender.send(message)).rejects.toBeInstanceOf(SmsTransientError);
    timeout = true;
    await expect(sender.send(message)).rejects.toBeInstanceOf(SmsTransientError);
  });
});
