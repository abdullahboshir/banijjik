import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { SmsTransientError } from "../application/ports.js";
import { smsPost } from "./sms-http.js";

const SHORT_TIMEOUT_MS = 100;

let server: Server | undefined;

/** Answers with the status and the first byte of a JSON body, then never finishes the body. */
async function startStallingServer(status: number): Promise<string> {
  server = createServer((_request, response) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.write("{");
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}/smsapi`;
}

afterEach(async () => {
  server?.closeAllConnections();
  await new Promise((resolve) => server?.close(resolve));
  server = undefined;
});

describe("smsPost", () => {
  it("treats a body that stalls past the timeout as a transient fault", async () => {
    const url = await startStallingServer(200);

    await expect(smsPost(url, { body: "text" }, SHORT_TIMEOUT_MS)).rejects.toBeInstanceOf(
      SmsTransientError,
    );
  });

  it("keeps a refusal whose body stalls past the timeout a permanent refusal", async () => {
    const url = await startStallingServer(403);

    await expect(smsPost(url, { body: "text" }, SHORT_TIMEOUT_MS)).resolves.toEqual({
      status: 403,
      body: {},
    });
  });
});
