import { afterEach, describe, expect, it } from "vitest";
import { startSmsStub, type SmsStubRequest } from "../../../../test-support/sms-http-stub.js";
import { AdaReachSmsDriver } from "./adareach-sms-driver.js";
import { SmsTransientError } from "../application/ports.js";

let stub: Awaited<ReturnType<typeof startSmsStub>> | undefined;
afterEach(async () => {
  await stub?.close();
});
function driver(baseUrl: string, timeoutMs?: number) {
  return new AdaReachSmsDriver(
    {
      baseUrl,
      username: "test-user",
      password: "fake-password",
      senderId: "TEST",
    },
    timeoutMs,
  );
}
const message = { msisdn: "8801712345678", text: "Hello" };
const success = { status: "SUCCESS", errorCode: 0, msgCount: 2, messageId: 123 };
function authentication(request: SmsStubRequest) {
  return request.url === "/auth/tokens";
}

describe("adaReach", () => {
  it("sends Bangla text with contentType 2 and English with 1", async () => {
    stub = await startSmsStub((request) => ({
      body: authentication(request) ? { token: "fake-token" } : success,
    }));
    const sender = driver(stub.baseUrl);
    await sender.send({ ...message, text: "বাংলা" });
    await sender.send(message);
    const sends = stub.requests.filter((request) => request.url === "/sms/send");
    expect(JSON.parse(sends[0]?.body ?? "{}")).toEqual({
      sender: "TEST",
      receiver: [message.msisdn],
      content: "বাংলা",
      msgType: "T",
      requestType: "S",
      contentType: 2,
    });
    expect(JSON.parse(sends[1]?.body ?? "{}")).toMatchObject({ content: "Hello", contentType: 1 });
  });

  it("logs in once and reuses the token", async () => {
    stub = await startSmsStub((request) => ({
      body: authentication(request) ? { token: "fake-token" } : success,
    }));
    const sender = driver(stub.baseUrl);
    await sender.send(message);
    await sender.send(message);
    expect(stub.requests.filter(authentication)).toHaveLength(1);
    expect(stub.requests[1]?.headers.authorization).toBe("Bearer fake-token");
  });

  it("re-logs in once on 401", async () => {
    let sends = 0;
    stub = await startSmsStub((request) => {
      if (authentication(request)) return { body: { token: "fake-token" } };
      sends += 1;
      return { status: sends === 1 ? 401 : 200, body: success };
    });
    await expect(driver(stub.baseUrl).send(message)).resolves.toMatchObject({
      outcome: "SENT",
      parts: 2,
      providerMessageId: "123",
    });
    expect(stub.requests.filter(authentication)).toHaveLength(2);
  });

  it("treats a 403 HTML page as a permanent refusal", async () => {
    stub = await startSmsStub((request) =>
      authentication(request)
        ? { body: { token: "fake-token" } }
        : { status: 403, contentType: "text/html", rawBody: "<h1>IP blocked</h1>" },
    );
    await expect(driver(stub.baseUrl).send(message)).resolves.toMatchObject({
      outcome: "REFUSED",
      failureReason: "PROVIDER_REFUSED",
    });
    expect(stub.requests.filter(authentication)).toHaveLength(1);
  });

  it("re-logs in once on a 401 without a JSON body", async () => {
    let sends = 0;
    stub = await startSmsStub((request) => {
      if (authentication(request)) return { body: { token: "fake-token" } };
      sends += 1;
      if (sends === 1)
        return { status: 401, contentType: "text/html", rawBody: "<h1>Expired</h1>" };
      return { body: success };
    });
    await expect(driver(stub.baseUrl).send(message)).resolves.toMatchObject({ outcome: "SENT" });
    expect(stub.requests.filter(authentication)).toHaveLength(2);
  });

  it("maps 1506 to BALANCE_LOW and 1503 to SENDER_NOT_ALLOWED without throwing", async () => {
    let code = 1506;
    stub = await startSmsStub((request) => ({
      body: authentication(request) ? { token: "fake-token" } : { errorCode: code },
    }));
    const sender = driver(stub.baseUrl);
    await expect(sender.send(message)).resolves.toMatchObject({ failureReason: "BALANCE_LOW" });
    code = 1503;
    await expect(sender.send(message)).resolves.toMatchObject({
      failureReason: "SENDER_NOT_ALLOWED",
    });
  });

  it("throws a transient error on 5xx, on 1502 and after the 10 s timeout", async () => {
    let mode = "server";
    stub = await startSmsStub((request) => {
      if (authentication(request)) return { body: { token: "fake-token" } };
      if (mode === "server") return { status: 503 };
      if (mode === "timeout") return { delayMs: 100 };
      return { body: { errorCode: 1502 } };
    });
    const sender = driver(stub.baseUrl, 20);
    await expect(sender.send(message)).rejects.toBeInstanceOf(SmsTransientError);
    mode = "throttle";
    await expect(sender.send(message)).rejects.toBeInstanceOf(SmsTransientError);
    mode = "timeout";
    await expect(sender.send(message)).rejects.toBeInstanceOf(SmsTransientError);
  });
});
